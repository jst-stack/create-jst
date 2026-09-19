import { spawn, execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { lstat, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const executeFile = promisify(execFile)
const installCommands = {
	bun: ['install'],
	npm: ['install', '--no-audit', '--no-fund'],
	pnpm: ['install'],
	yarn: ['install'],
}

export function createNodeProjectGateway({ nodeExecutable }) {
	return {
		assertDestinationIsEmpty,
		configurePackageManager,
		configureTemplate,
		initializeGit,
		installDependencies,
	}

	async function assertDestinationIsEmpty(destination) {
		if (!existsSync(destination)) return
		const stat = await lstat(destination)
		if (!stat.isDirectory()) throw new Error(`Destination is not a directory: ${destination}`)
		if ((await readdir(destination)).length > 0) throw new Error(`Destination is not empty: ${destination}`)
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
			'--demo', specification.demo,
		], specification.destination)
	}

	async function configurePackageManager(destination, packageManager) {
		let version
		try {
			({ stdout: version } = await executeFile(packageManager, ['--version']))
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

	function initializeGit(destination) {
		return run('git', ['init', '--initial-branch=main'], destination)
	}

	function installDependencies(destination, packageManager) {
		return run(packageManager, installCommands[packageManager], destination)
	}
}

function run(command, args, cwd) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { cwd, stdio: 'pipe' })
		let stdout = ''
		let stderr = ''
		child.stdout?.on('data', chunk => {
			stdout += chunk
		})
		child.stderr?.on('data', chunk => {
			stderr += chunk
		})
		child.once('error', error => reject(new Error(`Could not run ${command}: ${error.message}`)))
		child.once('close', code => {
			if (code === 0) resolve()
			else reject(new Error(`${command} ${args.join(' ')} failed.${[stdout, stderr].filter(Boolean).join('\n').trim() ? `\n${[stdout, stderr].filter(Boolean).join('\n').trim()}` : ''}`))
		})
	})
}
