import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createNodeMigrationGateway } from '../src/infrastructure/nodeMigrationGateway.mjs'

test('writeTransaction restores every migration-owned file byte-for-byte when verification fails', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'create-jst-rollback-'))
	const gateway = createNodeMigrationGateway()
	try {
		const originalConfig = "export default [jst.configs['strict']]\n"
		await writeFile(join(directory, 'eslint.config.js'), originalConfig)
		const migratedFiles = new Map([
			['eslint.config.js', "import policy from './jst.config.ts'\nexport default [jst.createConfig(policy)]\n"],
			['jst.config.ts', "import { defineConfig } from '@jst-stack/eslint-plugin'\nexport default defineConfig({})\n"],
		])
		await assert.rejects(
			gateway.writeTransaction(directory, migratedFiles, async () => {
				throw new Error('check failed')
			}),
			/check failed/u,
		)
		assert.equal(await readFile(join(directory, 'eslint.config.js'), 'utf8'), originalConfig)
		await assert.rejects(readFile(join(directory, 'jst.config.ts'), 'utf8'), { code: 'ENOENT' })
	} finally {
		await rm(directory, { recursive: true, force: true })
	}
})

test('writeTransaction leaves files untouched when verification succeeds', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'create-jst-commit-'))
	const gateway = createNodeMigrationGateway()
	try {
		await writeFile(join(directory, 'eslint.config.js'), "export default [jst.configs['strict']]\n")
		const migratedFiles = new Map([['eslint.config.js', "export default [jst.createConfig(policy)]\n"]])
		await gateway.writeTransaction(directory, migratedFiles, async () => undefined)
		assert.equal(await readFile(join(directory, 'eslint.config.js'), 'utf8'), "export default [jst.createConfig(policy)]\n")
	} finally {
		await rm(directory, { recursive: true, force: true })
	}
})
