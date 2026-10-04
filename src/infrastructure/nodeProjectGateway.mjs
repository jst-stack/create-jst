import { spawn, execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { lstat, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

const executeFile = promisify(execFile)
const installCommands = {
	npm: ['install', '--no-audit', '--no-fund'],
	pnpm: ['install'],
}
const pnpmAction = 'pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0'
const textExtensions = new Set(['.md', '.mjs', '.yaml', '.yml'])

export function createNodeProjectGateway({ nodeExecutable, signal }) {
	return {
		assertDestinationIsEmpty,
		assertRuntimeSupported,
		cleanupDestination,
		commitDestination,
		configureExample,
		configurePackageManager: (destination, packageManager) => configurePackageManager(destination, packageManager, signal),
		configureTemplate,
		initializeGit,
		installDependencies,
		prepareDestination,
		removeGitMetadata,
		validateTemplate,
	}

	async function assertDestinationIsEmpty(destination) {
		if (!existsSync(destination)) {
			return
		}
		const stat = await lstat(destination)
		if (!stat.isDirectory()) {
			throw new Error(`Destination is not a directory: ${destination}`)
		}
		if ((await readdir(destination)).length > 0) {
			throw new Error(`Destination is not empty: ${destination}`)
		}
	}

	function cleanupDestination(destination) {
		return rm(destination, { force: true, recursive: true })
	}

	async function commitDestination(temporaryDestination, destination) {
		await rm(destination, { force: true, recursive: true })
		await rename(temporaryDestination, destination)
	}

	function configureTemplate(specification) {
		return run(nodeExecutable, [
			'scripts/setup-template.mjs',
			'--yes',
			'--quiet',
			'--name', specification.name,
			'--title', specification.title,
			'--description', specification.description,
			'--lang', specification.language,
			'--color-scheme', specification.colorScheme,
			'--primary-color', specification.primaryColor,
			'--style', specification.style,
		], specification.destination, { signal })
	}

	function initializeGit(destination) {
		return run('git', ['init', '--initial-branch=main'], destination, { signal })
	}

	function installDependencies(destination, packageManager, { gitHooks = true } = {}) {
		return run(packageManager, installCommands[packageManager], destination, {
			env: gitHooks ? undefined : { ...process.env, HUSKY: '0' },
			shell: process.platform === 'win32',
			signal,
		})
	}

	async function validateTemplate(specification) {
		const contract = JSON.parse(await readFile(join(specification.destination, 'jst.template.json'), 'utf8'))
		if (contract.schemaVersion !== 1) {
			throw new Error(`Unsupported template contract schema: ${contract.schemaVersion}.`)
		}
		const selected = {
			colorSchemes: specification.colorScheme,
			primaryColors: specification.primaryColor,
			styles: specification.style,
		}
		for (const [option, value] of Object.entries(selected)) {
			if (!contract.options?.[option]?.includes(value)) {
				throw new Error(`Template ${contract.templateVersion} does not support ${option}: ${value}.`)
			}
		}
	}
}

async function configureExample(specification) {
	const manifestPath = join(specification.destination, 'package.json')
	const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
	manifest.name = specification.name
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, '\t')}\n`)
}

function removeGitMetadata(destination) {
	return rm(join(destination, '.git'), { force: true, recursive: true })
}

async function assertRuntimeSupported(destination) {
	const manifest = JSON.parse(await readFile(join(destination, 'package.json'), 'utf8'))
	const required = manifest.engines?.node
	const match = /^>=(\d+)\.(\d+)\.(\d+) <(\d+)$/u.exec(required ?? '')
	if (!match) {
		return
	}
	const current = process.versions.node.split('.').map(Number)
	const minimum = match.slice(1, 4).map(Number)
	const maximumMajor = Number(match[4])
	if (current[0] < maximumMajor && compareVersions(current, minimum) >= 0) {
		return
	}
	throw new Error(`This template requires Node.js ${required}; detected ${process.versions.node}. Upgrade Node and run create-jst again.`)
}

function compareVersions(left, right) {
	for (let index = 0; index < right.length; index += 1) {
		if (left[index] !== right[index]) {
			return left[index] - right[index]
		}
	}
	return 0
}

async function configurePackageManager(destination, packageManager, signal) {
	const manifestPath = join(destination, 'package.json')
	const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
	delete manifest.packageManager
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, '\t')}\n`)
	await rm(join(destination, 'package-lock.json'), { force: true })

	let version
	try {
		({ stdout: version } = await executeFile(packageManager, ['--version'], {
			cwd: destination,
			shell: process.platform === 'win32',
			signal,
		}))
	}
	catch {
		throw new Error(`Could not run ${packageManager}. Install it or choose another package manager.`)
	}
	if (packageManager === 'pnpm') {
		manifest.scripts = replaceManifestCommands(manifest.scripts)
	}
	const packageManagerEntry = ['packageManager', `${packageManager}@${version.trim()}`]
	const entries = Object.entries(manifest).flatMap(entry => entry[0] === 'engines' ? [packageManagerEntry, entry] : [entry])
	if (!manifest.engines) {
		entries.push(packageManagerEntry)
	}
	await writeFile(manifestPath, `${JSON.stringify(Object.fromEntries(entries), null, '\t')}\n`)
	if (packageManager === 'pnpm') {
		await writeFile(
			join(destination, 'pnpm-workspace.yaml'),
			`minimumReleaseAge: 10080
minimumReleaseAgeExcludePrune: true
minimumReleaseAgeExclude:
  - '@jst-stack/eslint-plugin'

trustPolicy: no-downgrade
trustPolicyIgnoreAfter: 10080
shellEmulator: true

packages:
  - .
`,
		)
		await replaceProjectCommands(destination)
	}
}

function replaceManifestCommands(scripts = {}) {
	return Object.fromEntries(Object.entries(scripts).map(([name, command]) => [name, replacePnpmCommands(command)]))
}

async function replaceProjectCommands(directory) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name)
		if (entry.isDirectory()) {
			await replaceProjectCommands(path)
		}
		else if (textExtensions.has(extname(entry.name)) || entry.name === 'Dockerfile') {
			const source = await readFile(path, 'utf8')
			const converted = entry.name === 'Dockerfile' ? replacePnpmDockerfile(source) : replacePnpmText(source)
			if (converted !== source) {
				await writeFile(path, converted)
			}
		}
	}
}

function replacePnpmText(source) {
	let result = replacePnpmCommands(source)
	result = result.replaceAll('cache: npm', 'cache: pnpm')
	result = result.replace(/^([ \t]*)- uses: actions\/setup-node@/mu, `$1- uses: ${pnpmAction}\n$&`)
	return result.replace(/^\s*- run: npm install -g npm@[^\n]+\n/mu, '')
}

function replacePnpmCommands(source) {
	return source
		.replaceAll('npm ci', 'pnpm install --frozen-lockfile')
		.replaceAll('npm run ', 'pnpm run ')
		.replaceAll('npx ', 'pnpm exec ')
}

function replacePnpmDockerfile(source) {
	return replacePnpmCommands(source)
		.replaceAll(/^(FROM [^\n]+)$/gmu, '$1\nRUN corepack enable')
		.replaceAll('COPY package.json package-lock.json ./', 'COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./')
		.replaceAll('pnpm install --frozen-lockfile --omit=dev', 'pnpm install --prod --frozen-lockfile')
		.replaceAll('npm cache clean --force', 'pnpm store prune')
		.replaceAll('CMD ["npm", "start"]', 'CMD ["pnpm", "start"]')
}

async function prepareDestination(destination) {
	const temporaryDestination = join(dirname(destination), `.${basename(destination)}-${process.pid}-${Date.now()}.tmp`)
	await rm(temporaryDestination, { force: true, recursive: true })
	return temporaryDestination
}

function run(command, args, cwd, { env, shell = false, signal } = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { cwd, env, shell, signal, stdio: 'inherit' })
		child.once('error', error => reject(new Error(`Could not run ${command}: ${error.message}`)))
		child.once('close', code => {
			if (code === 0) {
				resolve()
				return
			}
			reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}.`))
		})
	})
}
