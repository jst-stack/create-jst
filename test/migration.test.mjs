import assert from 'node:assert/strict'
import test from 'node:test'
import { createProjectMigrator } from '../src/application/projectMigrator.mjs'
import { resolveMigrationPath } from '../src/domain/migrationCatalog.mjs'

test('resolves a deterministic migration path', () => {
	assert.deepEqual(resolveMigrationPath('0.3.0').map(({ from, to }) => [from, to]), [['0.3.0', '0.4.0']])
	assert.throws(() => resolveMigrationPath('0.2.0'), /No supported migration path/)
})

test('keeps dry runs read-only', async () => {
	let writes = 0
	const migrator = createProjectMigrator({ gateway: {
		assertSafeGitState: async () => undefined,
		readMigrationFiles: async () => new Map([['eslint.config.js', "export default [jst.configs['strict']]\n"]]),
		writeTransaction: async () => { writes += 1 },
	} })
	const result = await migrator.execute({ directory: '/project', dryRun: true, from: '0.3.0', migrations: resolveMigrationPath('0.3.0'), to: '0.4.0' })
	assert.equal(writes, 0)
	assert.deepEqual(result.changedFiles, ['eslint.config.js', 'jst.config.ts'])
})
