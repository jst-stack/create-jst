import assert from 'node:assert/strict'
import test from 'node:test'
import { detectPackageManager, parseCommandLine, resolveProjectRequest } from '../src/ui/command.mjs'
import { normalizePackageName, toTitle } from '../src/domain/projectSpecification.mjs'

test('parses a non-interactive project command', () => {
	const result = parseCommandLine(['my-app', '--yes', '--package-manager', 'pnpm', '--no-install'])
	assert.deepEqual(result.positionals, ['my-app'])
	assert.equal(result.values['package-manager'], 'pnpm')
	assert.equal(result.values['no-install'], true)
})

test('normalizes a directory name to a package name', () => {
	assert.equal(normalizePackageName('My JST App!'), 'my-jst-app')
})

test('derives a readable application title', () => {
	assert.equal(toTitle('@jst-stack/my-jst_app'), 'My Jst App')
})

test('detects the package manager that invoked the initializer', () => {
	assert.equal(detectPackageManager({ npm_config_user_agent: 'pnpm/10.0.0 npm/? node/v24.0.0 darwin arm64' }), 'pnpm')
	assert.equal(detectPackageManager({ npm_config_user_agent: 'yarn/4.0.0 npm/? node/v24.0.0 darwin arm64' }), 'yarn')
	assert.equal(detectPackageManager({}), 'npm')
})

test('resolves the auto package manager choice from the invoking client', async () => {
	const request = await resolveProjectRequest(
		parseCommandLine(['my-app', '--yes', '--package-manager', 'auto']),
		{ cwd: () => '/tmp', env: { npm_config_user_agent: 'pnpm/10.0.0 npm/? node/v24.0.0' }, stdin: { isTTY: false }, stdout: { write() {} } },
	)
	assert.equal(request.specification.packageManager, 'pnpm')
})
