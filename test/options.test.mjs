import assert from 'node:assert/strict'
import test from 'node:test'
import { detectPackageManager, parseCommandLine, resolveProjectRequest } from '../src/ui/command.mjs'
import { normalizePackageName, SHOWCASE_SOURCE, TEMPLATE_SOURCE, toTitle } from '../src/domain/projectSpecification.mjs'

test('parses a non-interactive project command', () => {
	const result = parseCommandLine(['my-app', '--yes', '--package-manager', 'pnpm', '--style', 'scss', '--no-install'])
	assert.deepEqual(result.positionals, ['my-app'])
	assert.equal(result.values['package-manager'], 'pnpm')
	assert.equal(result.values['no-install'], true)
	assert.equal(result.values.style, 'scss')
})

test('normalizes a directory name to a package name', () => {
	assert.equal(normalizePackageName('My JST App!'), 'my-jst-app')
})

test('derives a readable application title', () => {
	assert.equal(toTitle('@jst-stack/my-jst_app'), 'My Jst App')
})

test('detects the package manager that invoked the initializer', () => {
	assert.equal(detectPackageManager({ npm_config_user_agent: 'pnpm/10.0.0 npm/? node/v24.0.0 darwin arm64' }), 'pnpm')
	assert.equal(detectPackageManager({ npm_config_user_agent: 'yarn/4.0.0 npm/? node/v24.0.0 darwin arm64' }), 'npm')
	assert.equal(detectPackageManager({}), 'npm')
})

test('resolves the auto package manager choice from the invoking client', async () => {
	const request = await resolveProjectRequest(parseCommandLine(['my-app', '--yes', '--package-manager', 'auto']), {
		cwd: () => '/tmp',
		env: { npm_config_user_agent: 'pnpm/10.0.0 npm/? node/v24.0.0' },
		stdin: { isTTY: false },
		stdout: { write() {} },
	})
	assert.equal(request.specification.packageManager, 'pnpm')
})

test('pins clean and showcase requests to immutable sources', async () => {
	const environment = { cwd: () => '/tmp', env: {}, stdin: { isTTY: false }, stdout: { write() {} } }
	const clean = await resolveProjectRequest(parseCommandLine(['clean-app', '--yes']), environment)
	const showcase = await resolveProjectRequest(parseCommandLine(['demo-app', '--yes', '--example', 'showcase']), environment)

	assert.equal(clean.specification.template, TEMPLATE_SOURCE)
	assert.equal(clean.specification.example, 'clean')
	assert.equal(showcase.specification.template, SHOWCASE_SOURCE)
	assert.equal(showcase.specification.example, 'showcase')
})

test('normalizes adversarial project names to stable npm-safe values', () => {
	let state = 0x5eed_c0de
	for (let index = 0; index < 512; index += 1) {
		state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
		const length = state % 48
		let candidate = ''
		for (let offset = 0; offset < length; offset += 1) {
			state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
			candidate += String.fromCodePoint(32 + (state % 95))
		}
		const normalized = normalizePackageName(candidate)
		assert.match(normalized, /^[a-z0-9][a-z0-9._-]*$/u)
		assert.equal(normalizePackageName(normalized), normalized)
	}
})

test('rejects conflicting and unknown adversarial CLI options', () => {
	for (const args of [
		['app', '--git', '--no-git'],
		['app', '--no-install', '--skip-install'],
		['first', 'second'],
		['app', '--example', '__unknown__'],
	]) {
		const command = parseCommandLine(args)
		assert.rejects(() => resolveProjectRequest(command, { cwd: () => '/tmp', env: {}, stdin: { isTTY: false }, stdout: { write() {} } }))
	}
	assert.throws(() => parseCommandLine(['app', '--__unknown__']), /Unknown option/u)
})
