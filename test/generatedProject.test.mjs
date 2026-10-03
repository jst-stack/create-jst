import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { URL } from 'node:url'
import test from 'node:test'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const cli = new URL('../src/cli.mjs', import.meta.url)

test('generated project installs and passes its complete quality gate', async (context) => {
	const packageManager = process.env.JST_TEST_PACKAGE_MANAGER
	if (!packageManager) {
		context.skip('Set JST_TEST_PACKAGE_MANAGER to npm or pnpm.')
		return
	}

	const temporaryRoot = await mkdtemp(join(tmpdir(), `create-jst-${packageManager}-`))
	const projectRoot = join(temporaryRoot, 'app')

	try {
		await execute(process.execPath, [
			cli.pathname,
			projectRoot,
			'--yes',
			'--no-git',
			'--package-manager', packageManager,
		], { timeout: 600_000 })

		const manifest = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))
		assert.match(manifest.packageManager, new RegExp(`^${packageManager}@`, 'u'))
		await execute(packageManager, ['run', 'check'], { cwd: projectRoot, timeout: 600_000 })
	}
	finally {
		await rm(temporaryRoot, { force: true, recursive: true })
	}
}, { timeout: 1_200_000 })
