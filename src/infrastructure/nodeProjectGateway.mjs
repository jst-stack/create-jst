import { spawn, execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { lstat, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

const executeFile = promisify(execFile)
const installCommands = {
	npm: ['install', '--no-audit', '--no-fund'],
	pnpm: ['install'],
}

export function createNodeProjectGateway({ nodeExecutable, signal }) {
	return {
		assertDestinationIsEmpty,
		cleanupDestination,
		commitDestination,
		configureExample,
		configurePackageManager: (destination, packageManager) => configurePackageManager(destination, packageManager, signal),
		configureTemplate,
		initializeGit,
		installDependencies,
		prepareDestination,
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
			'--name', specification.name,
			'--title', specification.title,
			'--description', specification.description,
			'--lang', specification.language,
			'--color-scheme', specification.colorScheme,
			'--primary-color', specification.primaryColor,
			'--style', specification.style,
		], specification.destination, signal)
	}

	async function configureExample(specification) {
		const manifestPath = join(specification.destination, 'package.json')
		const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
		manifest.name = specification.name
		await writeFile(manifestPath, `${JSON.stringify(manifest, null, '\t')}\n`)
	}

	function initializeGit(destination) {
		return run('git', ['init', '--initial-branch=main'], destination, signal)
	}

	function installDependencies(destination, packageManager) {
		return run(packageManager, installCommands[packageManager], destination, signal)
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
`,
		)
		await replaceReadmeCommands(destination, 'pnpm')
	}
}

async function replaceReadmeCommands(destination, packageManager) {
	const path = join(destination, 'README.md')
	try {
		const readme = await readFile(path, 'utf8')
		await writeFile(path, readme.replaceAll('npm run ', `${packageManager} run `).replaceAll('npm ci', `${packageManager} install --frozen-lockfile`))
	}
	catch (error) {
		if (error?.code !== 'ENOENT') {
			throw error
		}
	}
}

async function prepareDestination(destination) {
	const temporaryDestination = join(dirname(destination), `.${basename(destination)}-${process.pid}-${Date.now()}.tmp`)
	await rm(temporaryDestination, { force: true, recursive: true })
	return temporaryDestination
}

function run(command, args, cwd, signal) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { cwd, signal, stdio: 'inherit' })
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
