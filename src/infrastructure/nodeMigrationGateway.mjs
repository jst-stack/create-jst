import { execFile } from 'node:child_process'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

const executeFile = promisify(execFile)

export function createNodeMigrationGateway() {
	return {
		async assertSafeGitState(directory) {
			try {
				const { stdout } = await executeFile('git', ['status', '--porcelain'], { cwd: directory })
				if (stdout.trim()) {
					throw new Error('Migration requires a clean Git working tree.')
				}
			}
			catch (error) {
				if (error.message === 'Migration requires a clean Git working tree.') {
					throw error
				}
				throw new Error('Migration requires the project to be inside a Git repository.', { cause: error })
			}
		},
		async readMigrationFiles(directory, migrations) {
			const names = new Set(migrations.flatMap(migration => migration.files))
			const files = new Map()
			for (const name of names) {
				files.set(name, await readFile(join(directory, name), 'utf8'))
			}
			return files
		},
		async verify(directory) {
			const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
			const packageManager = manifest.packageManager?.startsWith('pnpm@') ? 'pnpm' : 'npm'
			return executeFile(packageManager, ['run', 'check'], {
				cwd: directory,
				shell: process.platform === 'win32',
			})
		},
		async writeTransaction(directory, files, verify) {
			const originals = new Map()
			for (const name of files.keys()) {
				try {
					originals.set(name, await readFile(join(directory, name), 'utf8'))
				}
				catch (error) {
					if (error.code !== 'ENOENT') {
						throw error
					}
				}
			}
			try {
				for (const [name, content] of files) {
					await writeFile(join(directory, name), content)
				}
				await verify()
			}
			catch (error) {
				for (const name of files.keys()) {
					if (originals.has(name)) {
						await writeFile(join(directory, name), originals.get(name))
					}
					else {
						await rm(join(directory, name), { force: true })
					}
				}
				throw error
			}
		},
	}
}
