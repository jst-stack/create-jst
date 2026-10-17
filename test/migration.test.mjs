import assert from 'node:assert/strict'
import test from 'node:test'
import { createProjectMigrator } from '../src/application/projectMigrator.mjs'
import { migrations, resolveMigrationPath } from '../src/domain/migrationCatalog.mjs'

test('resolves a deterministic migration path', () => {
	assert.deepEqual(
		resolveMigrationPath('0.3.0').map(({ from, to }) => [from, to]),
		[['0.3.0', '0.4.0']],
	)
	assert.throws(() => resolveMigrationPath('0.2.0'), /No supported migration path/)
})

test('keeps dry runs read-only', async () => {
	let writes = 0
	const migrator = createProjectMigrator({
		gateway: {
			assertSafeGitState: async () => undefined,
			readMigrationFiles: async () => new Map([['eslint.config.js', 'export default [jst.configs.recommended]\n']]),
			writeTransaction: async () => {
				writes += 1
			},
		},
	})
	const result = await migrator.execute({
		directory: '/project',
		dryRun: true,
		from: '0.3.0',
		migrations: resolveMigrationPath('0.3.0'),
		to: '0.4.0',
	})
	assert.equal(writes, 0)
	assert.deepEqual(result.changedFiles, ['eslint.config.js', 'jst.config.ts'])
})

test('migration writes jst.config.ts importing from the package root', () => {
	const files = new Map([['eslint.config.js', 'export default [jst.configs.recommended]\n']])
	migrations[0].apply(files)
	assert.match(files.get('jst.config.ts'), /@jst-stack\/eslint-plugin'\n/u)
	assert.doesNotMatch(files.get('jst.config.ts'), /eslint-plugin\/policy/u)
})

test('terminates safely for adversarial migration versions', () => {
	const versions = ['', '0', '0.3', '0.3.0\0', '../0.3.0', 'v0.3.0', '999.999.999']
	for (let index = 0; index < 256; index += 1) {
		versions.push(`${index}.${255 - index}.${index % 17}`)
	}
	for (const version of versions) {
		assert.throws(() => resolveMigrationPath(version), /No supported migration path/u)
	}
	assert.deepEqual(resolveMigrationPath('0.4.0'), [])
})
