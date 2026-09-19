import { spawn, execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { lstat, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import degit from 'degit'

const exec = promisify(execFile)
const installCommands = {
	bun: ['install'],
	npm: ['install', '--no-audit', '--no-fund'],
	pnpm: ['install'],
	yarn: ['install'],
}

export async function ensureDestinationIsEmpty(destination) {
	if (!existsSync(destination)) return
	const stat = await lstat(destination)
	if (!stat.isDirectory()) throw new Error(`Destination is not a directory: ${destination}`)
	if ((await readdir(destination)).length > 0) throw new Error(`Destination is not empty: ${destination}`)
}

export async function scaffoldProject(options, reporter) {
	reporter.start()
	reporter.step(`Downloading ${options.template}`)
	await degit(options.template, { disableCache: true, force: false, verbose: false }).clone(options.destination)

	reporter.step(`Configuring ${options.title}`)
	await run(process.execPath, setupArguments(options), options.destination)

	if (options.packageManager !== 'npm') {
		reporter.step(`Preparing ${options.packageManager}`)
		await configurePackageManager(options.destination, options.packageManager)
	}

	if (options.initGit) {
		reporter.step('Initialising Git')
		await run('git', ['init', '--initial-branch=main'], options.destination)
	}

	if (options.install) {
		reporter.step(`Installing dependencies with ${options.packageManager}`)
		await run(options.packageManager, installCommands[options.packageManager], options.destination, true)
	}

	reporter.success(options)
}

function setupArguments(options) {
	return [
		'scripts/setup-template.mjs',
		'--yes',
		'--name', options.name,
		'--title', options.title,
		'--description', options.description,
		'--lang', options.language,
		'--color-scheme', options.colorScheme,
		'--primary-color', options.primaryColor,
		'--demo', options.demo,
	]
}

async function configurePackageManager(destination, packageManager) {
	let version
	try {
		({ stdout: version } = await exec(packageManager, ['--version']))
	}
	catch {
		throw new Error(`Could not run ${packageManager}. Install it or choose another package manager.`)
	}
	const manifestPath = join(destination, 'package.json')
	const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
	manifest.packageManager = `${packageManager}@${version.trim()}`
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, '\t')}\n`)
	await rm(join(destination, 'package-lock.json'), { force: true })
}

function run(command, args, cwd, inheritOutput = false) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { cwd, stdio: inheritOutput ? 'inherit' : 'pipe' })
		let stderr = ''
		child.stderr?.on('data', chunk => {
			stderr += chunk
		})
		child.once('error', error => reject(new Error(`Could not run ${command}: ${error.message}`)))
		child.once('close', code => {
			if (code === 0) resolve()
			else reject(new Error(`${command} ${args.join(' ')} failed.${stderr ? `\n${stderr.trim()}` : ''}`))
		})
	})
}
