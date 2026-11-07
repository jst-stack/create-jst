import { execFile, spawn } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

const executeFile = promisify(execFile)
const packageName = '@jst-stack/mcp'
const stackLimit = 40

export function createNodeMcpGateway({ timeout = 600_000 } = {}) {
	return { inspectProject, installGlobal, registerPi }

	async function inspectProject(projectRoot) {
		const root = resolve(projectRoot)
		let manifest
		try {
			manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
		} catch {
			throw new Error(`Could not read package.json in ${root}. Run this command from a JST project.`)
		}
		if (typeof manifest.scripts?.['create:slice'] !== 'string') {
			throw new Error(`No create:slice script found in ${root}; this is not a JST project.`)
		}
		await Promise.all([
			access(join(root, 'jst.config.ts')),
			access(join(root, 'skills/frontend-architecture/SKILL.md')),
		])
		const packages = [
			...Object.entries(manifest.dependencies ?? {}),
			...Object.entries(manifest.devDependencies ?? {}),
		]
			.filter(([name, version]) => typeof name === 'string' && typeof version === 'string')
			.map(([name, version]) => `${name}@${version}`)
			.sort()
		return {
			projectRoot: root,
			name: manifest.name ?? 'jst-project',
			stack: packages.slice(0, stackLimit),
			stackTruncated: packages.length > stackLimit,
		}
	}

	async function installGlobal() {
		const command = process.platform === 'win32' ? 'npm.cmd' : 'npm'
		await run(command, ['install', '--global', packageName], timeout)
	}

	async function registerPi(projectRoot) {
		const command = process.platform === 'win32' ? 'npm.cmd' : 'npm'
		const { stdout } = await executeFile(command, ['root', '--global'], {
			shell: process.platform === 'win32',
			timeout,
		})
		const serverPath = join(stdout.trim(), '@jst-stack', 'mcp', 'dist', 'bin', 'jst-mcp.js')
		await access(serverPath)
		const { stdout: result } = await executeFile(process.execPath, [serverPath, 'init'], {
			cwd: projectRoot,
			timeout,
		})
		return JSON.parse(result)
	}
}

function run(command, args, timeout) {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(command, args, {
			shell: process.platform === 'win32',
			stdio: 'inherit',
			timeout,
			windowsHide: true,
		})
		child.once('error', error => reject(new Error(`Could not run ${command}: ${error.message}`, { cause: error })))
		child.once('close', (code, signal) => {
			if (code === 0) {
				resolvePromise()
				return
			}
			reject(new Error(signal ? `${command} timed out after ${timeout}ms.` : `${command} exited with code ${code}.`))
		})
	})
}
