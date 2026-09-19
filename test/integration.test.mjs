import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const cli = new URL('../src/cli.mjs', import.meta.url)

test('creates a clean, configured project and protects non-empty destinations', async () => {
	const root = await mkdtemp(join(tmpdir(), 'create-jst-'))
	const project = join(root, 'project')
	try {
		await exec(process.execPath, [cli.pathname, project, '--yes', '--no-install', '--no-git'])
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
		const { stdout } = await exec(process.execPath, [cli.pathname, project, '--yes', '--dry-run', '--package-manager', 'pnpm'])
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
		await writeFile(join(root, 'pnpm'), '#!/bin/sh\necho 9.15.0\n')
		await chmod(join(root, 'pnpm'), 0o755)
		await exec(process.execPath, [cli.pathname, project, '--yes', '--no-install', '--no-git', '--package-manager', 'pnpm'], {
			env: { ...process.env, PATH: `${root}:${process.env.PATH}` },
		})
		const manifest = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'))
		assert.equal(manifest.packageManager, 'pnpm@9.15.0')
		await assert.rejects(readFile(join(project, 'package-lock.json')), { code: 'ENOENT' })
	}
	finally {
		await rm(root, { force: true, recursive: true })
	}
}, { timeout: 60_000 })
