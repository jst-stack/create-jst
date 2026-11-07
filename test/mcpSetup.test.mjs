import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createMcpSetup } from '../src/application/mcpSetup.mjs'
import { createNodeMcpGateway } from '../src/infrastructure/nodeMcpGateway.mjs'
import { run } from '../src/cli.mjs'

test('previews project stack and setup actions without side effects', async () => {
	const calls = []
	const setup = createMcpSetup({
		gateway: {
			inspectProject: async (projectRoot) => ({ projectRoot, name: 'orbit', stack: ['zustand@^5'], stackTruncated: false }),
			installGlobal: async () => calls.push('install'),
			registerPi: async () => calls.push('register'),
		},
	})

	const result = await setup.execute({ projectRoot: '/work/orbit', dryRun: true })

	assert.deepEqual(result.stack, ['zustand@^5'])
	assert.deepEqual(result.steps, ['npm install --global @jst-stack/mcp', 'jst-mcp init'])
	assert.deepEqual(calls, [])
})

test('installs the global package before registering Pi', async () => {
	const calls = []
	const setup = createMcpSetup({
		gateway: {
			inspectProject: async () => ({ projectRoot: '/work/orbit', name: 'orbit', stack: [], stackTruncated: false }),
			installGlobal: async () => calls.push('install'),
			registerPi: async () => {
				calls.push('register')
				return { steps: ['registered'] }
			},
		},
	})

	const result = await setup.execute({ projectRoot: '/work/orbit' })

	assert.deepEqual(calls, ['install', 'register'])
	assert.deepEqual(result.steps, ['registered'])
})

test('detects the current project stack and rejects non-JST projects', async () => {
	const root = await mkdtemp(join(tmpdir(), 'create-jst-mcp-'))
	try {
		await mkdir(join(root, 'skills/frontend-architecture'), { recursive: true })
		await writeFile(join(root, 'jst.config.ts'), 'export default {}\n')
		await writeFile(join(root, 'skills/frontend-architecture/SKILL.md'), '# Architecture\n')
		await writeFile(join(root, 'package.json'), JSON.stringify({
			name: 'orbit',
			scripts: { 'create:slice': 'node scripts/create-slice.mjs' },
			dependencies: { zustand: '^5.0.0' },
			devDependencies: { tailwindcss: '^4.0.0' },
		}))

		const project = await createNodeMcpGateway().inspectProject(root)
		assert.deepEqual(project.stack, ['tailwindcss@^4.0.0', 'zustand@^5.0.0'])
		await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'not-jst' }))
		await assert.rejects(createNodeMcpGateway().inspectProject(root), /create:slice/u)
	} finally {
		await rm(root, { force: true, recursive: true })
	}
})

test('dispatches the MCP setup subcommand without entering project creation', async () => {
	const output = []
	const environment = {
		cwd: () => '/work/orbit',
		env: {},
		stdin: { isTTY: false },
		stdout: { isTTY: false, write: value => output.push(value) },
	}
	const application = {
		mcpSetup: { execute: async input => input },
	}

	await run(['mcp', 'setup', '--dry-run'], environment, application)

	assert.deepEqual(JSON.parse(output[0]), {
		projectRoot: '/work/orbit',
		dryRun: true,
	})
})
