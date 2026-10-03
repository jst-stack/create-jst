import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import process from 'node:process'
import { URL } from 'node:url'
import test from 'node:test'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const cli = new URL('../src/cli.mjs', import.meta.url)

test('creates a clean, configured project and protects non-empty destinations', async () => {
	const root = await mkdtemp(join(tmpdir(), 'create-jst-'))
	const project = join(root, 'project')
	try {
		const template = await createTemplate(root)
		await exec(process.execPath, [cli.pathname, project, '--yes', '--no-install', '--no-git', '--template', template])
		const manifest = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'))
		assert.equal(manifest.name, 'project')
		assert.equal(manifest.packageManager, 'npm@11.6.2')
		await assert.rejects(readFile(join(project, 'scripts', 'setup-template.mjs')), { code: 'ENOENT' })

		const blocked = join(root, 'blocked')
		await writeFile(blocked, 'not a directory')
		await assert.rejects(
			exec(process.execPath, [cli.pathname, blocked, '--yes']),
			error => error.stdout.includes('Destination is not a directory'),
		)
	}
	finally {
		await rm(root, { force: true, recursive: true })
	}
}, { timeout: 60_000 })

test('dry runs without creating the destination', async () => {
	const root = await mkdtemp(join(tmpdir(), 'create-jst-dry-'))
	const project = join(root, 'project')
	try {
		const template = await createTemplate(root)
		const { stdout } = await exec(process.execPath, [cli.pathname, project, '--yes', '--dry-run', '--package-manager', 'pnpm', '--template', template])
		assert.match(stdout, /plan only/)
		await assert.rejects(readFile(join(project, 'package.json')), { code: 'ENOENT' })
	}
	finally {
		await rm(root, { force: true, recursive: true })
	}
})

test('runs when npm exposes the CLI through a symbolic link', async () => {
	const root = await mkdtemp(join(tmpdir(), 'create-jst-bin-'))
	const binary = join(root, 'create-jst')
	try {
		await symlink(cli.pathname, binary)
		const { stdout } = await exec(process.execPath, [binary, '--help'])
		assert.match(stdout, /npm create jst@latest/)
	}
	finally {
		await rm(root, { force: true, recursive: true })
	}
})

test('configures a selected package manager without installing dependencies', async () => {
	const root = await mkdtemp(join(tmpdir(), 'create-jst-pm-'))
	const project = join(root, 'project')
	try {
		const template = await createTemplate(root)
		await writeFile(join(root, 'pnpm'), `#!/bin/sh
printf '%s' "$PWD" > "${join(root, 'pnpm-cwd')}"
echo 9.15.0
`)
		await chmod(join(root, 'pnpm'), 0o755)
		await exec(process.execPath, [cli.pathname, project, '--yes', '--no-install', '--no-git', '--package-manager', 'pnpm', '--template', template], {
			env: { ...process.env, PATH: `${root}:${process.env.PATH}` },
})

test('creates the showcase example without requiring template setup', async () => {
	const root = await mkdtemp(join(tmpdir(), 'create-jst-showcase-'))
	const project = join(root, 'project')
	try {
		const template = join(root, 'showcase')
		await mkdir(template)
		await writeFile(join(template, 'package.json'), '{"name":"jst-showcase","scripts":{"check":"echo ok"}}\n')
		await writeFile(join(template, 'README.md'), 'npm ci\nnpm run check\n')

		await exec(process.execPath, [cli.pathname, project, '--yes', '--example', 'showcase', '--no-install', '--no-git', '--template', template])

		const manifest = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'))
		assert.equal(manifest.name, 'project')
		assert.equal(await readFile(join(project, 'README.md'), 'utf8'), 'npm ci\nnpm run check\n')
	}
	finally {
		await rm(root, { force: true, recursive: true })
	}
})
		const manifest = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'))
		assert.equal(manifest.packageManager, 'pnpm@9.15.0')
		assert.match(basename(await readFile(join(root, 'pnpm-cwd'), 'utf8')), /^\.project-\d+-\d+\.tmp$/)
		assert.equal(
			await readFile(join(project, 'pnpm-workspace.yaml'), 'utf8'),
			'minimumReleaseAge: 10080\nminimumReleaseAgeExcludePrune: true\ntrustPolicy: no-downgrade\ntrustPolicyIgnoreAfter: 10080\nshellEmulator: true\n',
		)
		await assert.rejects(readFile(join(project, 'package-lock.json')), { code: 'ENOENT' })
	}
	finally {
		await rm(root, { force: true, recursive: true })
	}
}, { timeout: 60_000 })

async function createTemplate(root) {
	const template = join(root, 'template')
	await mkdir(join(template, 'scripts'), { recursive: true })
	await writeFile(join(template, 'package.json'), `${JSON.stringify({
		engines: { node: '>=24.15.0 <25' },
		name: 'jst-template',
		packageManager: 'npm@11.6.2',
		scripts: { 'template:setup': 'node scripts/setup-template.mjs' },
	}, null, '\t')}\n`)
	await writeFile(join(template, 'package-lock.json'), '{}\n')
	await writeFile(join(template, 'jst.template.json'), '{"schemaVersion":1,"templateVersion":"test","options":{"colorSchemes":["light","dark","auto"],"primaryColors":["lime"],"styles":["css","scss"]}}\n')
	await writeFile(join(template, 'scripts/setup-template.mjs'), `
import { readFile, rm, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'

const { values } = parseArgs({ options: {
  name: { type: 'string' }, style: { type: 'string' }, yes: { type: 'boolean' },
  title: { type: 'string' }, description: { type: 'string' }, lang: { type: 'string' },
  'color-scheme': { type: 'string' }, 'primary-color': { type: 'string' },
} })
const manifest = JSON.parse(await readFile('package.json', 'utf8'))
manifest.name = values.name
delete manifest.scripts['template:setup']
await writeFile('package.json', JSON.stringify(manifest, null, '\\t') + '\\n')
await writeFile('jst.config.ts', \`export default { styles: { moduleExtension: '\${values.style}' } } as const\\n\`)
await rm('scripts/setup-template.mjs')
`)
	return template
}
