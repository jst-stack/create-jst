import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, delimiter, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import test from 'node:test'
import { promisify } from 'node:util'

import { createPackageManagerStub, createTemplate } from './fixtures/cleanTemplate.mjs'

const exec = promisify(execFile)
const cliPath = fileURLToPath(new URL('../src/cli.mjs', import.meta.url))

test(
	'creates a clean, configured project and protects non-empty destinations',
	async () => {
		const root = await mkdtemp(join(tmpdir(), 'create-jst-'))
		const project = join(root, 'project')
		try {
			const template = await createTemplate(root)
			const { stdout } = await exec(process.execPath, [cliPath, project, '--yes', '--no-install', '--no-git', '--template', template])
			const manifest = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'))
			assert.equal(manifest.name, 'project')
			assert.equal(manifest.packageManager, 'npm@11.6.2')
			assert.match(stdout, /npm install/u)
			assert.match(stdout, /npm run create:slice -- feature firstFeature/u)
			assert.match(stdout, /npm run validate/u)
			assert.match(stdout, /npm run check:release/u)
			await assert.rejects(readFile(join(project, 'scripts', 'setup-template.mjs')), { code: 'ENOENT' })

			const blocked = join(root, 'blocked')
			await writeFile(blocked, 'not a directory')
			await assert.rejects(exec(process.execPath, [cliPath, blocked, '--yes', '--no-install']), (error) =>
				error.stdout.includes('Destination is not a directory'),
			)
		} finally {
			await rm(root, { force: true, recursive: true })
		}
	},
	{ timeout: 60_000 },
)

test('dry runs without creating the destination', async () => {
	const root = await mkdtemp(join(tmpdir(), 'create-jst-dry-'))
	const project = join(root, 'project')
	try {
		const template = await createTemplate(root)
		const { stdout } = await exec(process.execPath, [
			cliPath,
			project,
			'--yes',
			'--dry-run',
			'--package-manager',
			'pnpm',
			'--template',
			template,
		])
		assert.match(stdout, /plan only/)
		await assert.rejects(readFile(join(project, 'package.json')), { code: 'ENOENT' })
	} finally {
		await rm(root, { force: true, recursive: true })
	}
})

test('runs when npm exposes the CLI through a symbolic link', async () => {
	const root = await mkdtemp(join(tmpdir(), 'create-jst-bin-'))
	const binary = join(root, 'create-jst')
	try {
		await symlink(cliPath, binary)
		const { stdout } = await exec(process.execPath, [binary, '--help'])
		assert.match(stdout, /npm create jst@latest/)
	} finally {
		await rm(root, { force: true, recursive: true })
	}
})

test(
	'configures a selected package manager without installing dependencies',
	async () => {
		const root = await mkdtemp(join(tmpdir(), 'create-jst-pm-'))
		const project = join(root, 'project')
		try {
			const template = await createTemplate(root)
			await createPackageManagerStub(root)
			await exec(
				process.execPath,
				[cliPath, project, '--yes', '--no-install', '--no-git', '--package-manager', 'pnpm', '--template', template],
				{
					env: { ...process.env, PATH: `${root}${delimiter}${process.env.PATH}` },
				},
			)
			const manifest = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'))
			assert.equal(manifest.packageManager, 'pnpm@9.15.0')
			assert.equal(manifest.scripts.check, 'pnpm run lint')
			assert.match(basename(await readFile(join(root, 'pnpm-cwd'), 'utf8')), /^\.project-\d+-\d+\.tmp$/)
			assert.equal(
				await readFile(join(project, 'pnpm-workspace.yaml'), 'utf8'),
				`minimumReleaseAge: 10080
minimumReleaseAgeExcludePrune: true
minimumReleaseAgeExclude:
  - '@eslint-react/*'
  - '@jst-stack/*'
  - 'eslint-plugin-react-*'

trustPolicy: no-downgrade
trustPolicyIgnoreAfter: 10080
shellEmulator: true

packages:
  - .
`,
			)
			assert.match(await readFile(join(project, 'README.md'), 'utf8'), /pnpm run check/u)
			const workflow = await readFile(join(project, '.github/workflows/ci.yml'), 'utf8')
			assert.match(workflow, /pnpm\/action-setup@ea17c68/u)
			assert.match(workflow, /cache: pnpm/u)
			assert.match(workflow, /pnpm install --frozen-lockfile/u)
			assert.doesNotMatch(workflow, /npm install -g/u)
			const dockerfile = await readFile(join(project, 'Dockerfile'), 'utf8')
			assert.match(dockerfile, /RUN corepack enable/u)
			assert.match(dockerfile, /COPY package\.json pnpm-lock\.yaml pnpm-workspace\.yaml/u)
			assert.match(dockerfile, /CMD \["pnpm", "start"\]/u)
			await assert.rejects(readFile(join(project, 'package-lock.json')), { code: 'ENOENT' })
		} finally {
			await rm(root, { force: true, recursive: true })
		}
	},
	{ timeout: 60_000 },
)

test('creates the showcase example without requiring template setup', async () => {
	const root = await mkdtemp(join(tmpdir(), 'create-jst-showcase-'))
	const project = join(root, 'project')
	try {
		const template = join(root, 'showcase')
		await mkdir(template)
		await writeFile(join(template, 'package.json'), '{"name":"jst-showcase","scripts":{"check":"echo ok"}}\n')
		await writeFile(join(template, 'README.md'), 'npm ci\nnpm run check\n')

		await exec(process.execPath, [cliPath, project, '--yes', '--example', 'showcase', '--no-install', '--no-git', '--template', template])

		const manifest = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'))
		assert.equal(manifest.name, 'project')
		assert.equal(await readFile(join(project, 'README.md'), 'utf8'), 'npm ci\nnpm run check\n')
	} finally {
		await rm(root, { force: true, recursive: true })
	}
})
