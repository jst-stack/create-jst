import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import test from 'node:test'

import { run } from '../src/cli.mjs'
import { createTemplate } from './fixtures/cleanTemplate.mjs'

test('refuses to generate a project on a Node.js version the template cannot run', async () => {
	const root = await mkdtemp(join(tmpdir(), 'create-jst-node-'))
	const project = join(root, 'project')
	const output = []
	const environment = {
		cwd: () => process.cwd(),
		env: {},
		exitCode: 0,
		off() {},
		once() {},
		stdout: { isTTY: false, write: (chunk) => output.push(chunk) },
		versions: { node: '22.14.0' },
	}
	try {
		await run([project, '--yes'], environment)
		assert.equal(environment.exitCode, 1)
		assert.match(output.join(''), /requires Node.js >=24.15.0 <25; this process runs Node.js 22.14.0./u)
		await assert.rejects(readFile(join(project, 'package.json')), { code: 'ENOENT' })
	} finally {
		await rm(root, { force: true, recursive: true })
	}
})

test('scaffolds on an unsupported Node.js when installation is deferred', async () => {
	const root = await mkdtemp(join(tmpdir(), 'create-jst-node-deferred-'))
	const project = join(root, 'project')
	const output = []
	const environment = {
		cwd: () => process.cwd(),
		env: {},
		exitCode: 0,
		off() {},
		once() {},
		stdin: { isTTY: false },
		stdout: { isTTY: false, write: (chunk) => output.push(chunk) },
		versions: { node: '22.14.0' },
	}
	try {
		const template = await createTemplate(root)
		await run([project, '--yes', '--no-install', '--no-git', '--template', template], environment)
		assert.equal(environment.exitCode, 0, output.join(''))
		const manifest = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'))
		assert.equal(manifest.engines.node, '>=24.15.0 <25')
	} finally {
		await rm(root, { force: true, recursive: true })
	}
})

test('plans on an unsupported Node.js without touching the destination', async () => {
	const root = await mkdtemp(join(tmpdir(), 'create-jst-node-plan-'))
	const project = join(root, 'project')
	const output = []
	const environment = {
		cwd: () => process.cwd(),
		env: {},
		exitCode: 0,
		off() {},
		once() {},
		stdin: { isTTY: false },
		stdout: { isTTY: false, write: (chunk) => output.push(chunk) },
		versions: { node: '22.14.0' },
	}
	try {
		await run([project, '--yes', '--dry-run'], environment)
		assert.equal(environment.exitCode, 0, output.join(''))
		assert.match(output.join(''), /plan only/u)
		await assert.rejects(readFile(join(project, 'package.json')), { code: 'ENOENT' })
	} finally {
		await rm(root, { force: true, recursive: true })
	}
})
