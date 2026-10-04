import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import test from 'node:test'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const cliPath = fileURLToPath(new URL('../src/cli.mjs', import.meta.url))

test('generated project installs and passes its complete quality gate', async (context) => {
	const packageManager = process.env.JST_TEST_PACKAGE_MANAGER
	if (!packageManager) {
		context.skip('Set JST_TEST_PACKAGE_MANAGER to npm or pnpm.')
		return
	}

	const temporaryRoot = await mkdtemp(join(await realpath(tmpdir()), `create-jst-${packageManager}-`))
	const projectRoot = join(temporaryRoot, 'app')
	const templateArguments = process.env.JST_TEST_TEMPLATE
		? ['--template', process.env.JST_TEST_TEMPLATE]
		: []

	try {
		await execute(process.execPath, [
			cliPath,
			projectRoot,
			'--yes',
			'--package-manager', packageManager,
			...templateArguments,
		], { timeout: 600_000 })

		const manifest = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))
		assert.match(manifest.packageManager, new RegExp(`^${packageManager}@`, 'u'))
		await execute(packageManager, ['run', 'check'], {
			cwd: projectRoot,
			shell: process.platform === 'win32',
			timeout: 600_000,
		})

		await execute(packageManager, ['run', 'create:slice', '--', 'feature', 'readingList', '--stateful'], {
			cwd: projectRoot,
			shell: process.platform === 'win32',
			timeout: 600_000,
		})
		await execute(packageManager, ['run', 'validate'], {
			cwd: projectRoot,
			shell: process.platform === 'win32',
			timeout: 600_000,
		})

		await execute('git', ['config', 'user.name', 'JST Canary'], { cwd: projectRoot })
		await execute('git', ['config', 'user.email', 'jst-canary@example.invalid'], { cwd: projectRoot })
		await execute('git', ['add', '.'], { cwd: projectRoot })
		await execute('git', ['commit', '-m', 'test: generated project'], { cwd: projectRoot, timeout: 600_000 })

		const entryPath = join(projectRoot, 'src', 'features', 'readingList', 'readingList.entry.tsx')
		const entry = await readFile(entryPath, 'utf8')
		await writeFile(entryPath, entry.replace(
			'function ReadingListEntryViewModel() {',
			"function ReadingListEntryViewModel() {\n\tlocalStorage.setItem('invalid-effect', 'blocked')",
		))
		await execute('git', ['add', entryPath], { cwd: projectRoot })
		await assert.rejects(
			execute('git', ['commit', '-m', 'test: invalid effect'], { cwd: projectRoot, timeout: 600_000 }),
			error => /no-unguarded-browser-global-in-render-or-hook-init|effects-at-boundary/u.test(
				`${error.stdout}\n${error.stderr}`,
			),
		)
	}
	finally {
		await rm(temporaryRoot, { force: true, recursive: true })
	}
}, { timeout: 1_200_000 })
