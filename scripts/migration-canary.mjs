import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import { promisify } from 'node:util'
import { migrations, resolveMigrationPath } from '../src/domain/migrationCatalog.mjs'

const execute = promisify(execFile)
const jstCli = fileURLToPath(new URL('../src/jst.mjs', import.meta.url))
const packageManager = process.env.JST_TEST_PACKAGE_MANAGER

if (!packageManager || !['npm', 'pnpm'].includes(packageManager)) {
	throw new Error('Set JST_TEST_PACKAGE_MANAGER to npm or pnpm.')
}

const [migration] = migrations
const from = migration.from
const to = migration.to
assert.deepEqual(
	resolveMigrationPath(from).map(({ from: start, to: end }) => [start, end]),
	[[from, to]],
)

const temporaryRoot = await mkdtemp(join(await realpath(tmpdir()), `create-jst-migrate-${packageManager}-`))
const projectRoot = join(temporaryRoot, 'app')
const artifactDirectory = join(temporaryRoot, 'artifacts')

try {
	await run()
} catch (error) {
	await writeFailureArtifacts(error)
	throw error
} finally {
	await rm(temporaryRoot, { recursive: true, force: true })
}

async function run() {
	const userFiles = await prepareBaseline()

	report('migration', `dry-run ${from} → ${to}`)
	const dryRun = await migrate('--dry-run')
	assert.match(dryRun.stdout, new RegExp(`Would migrate ${from} → ${to}: eslint\\.config\\.js, jst\\.config\\.ts`, 'u'))
	assert.equal(await gitStatus(), '', 'dry-run must not modify the working tree')

	await exerciseRollback()

	report('migration', `migrating ${from} → ${to}`)
	const result = await migrate()
	assert.match(result.stdout, new RegExp(`Migrated ${from} → ${to}: eslint\\.config\\.js, jst\\.config\\.ts`, 'u'))

	report('migration', 'asserting only migration-owned files changed')
	await assertUserFilesIntact(userFiles)
	const status = await gitStatus()
	assert.equal(status.split('\n').filter(Boolean).length, 2, `unexpected changes:\n${status}`)
	assert.match(status, /^ M eslint\.config\.js$/mu)
	assert.match(status, /^\?\? jst\.config\.ts$/mu)

	report('verification', 'running migrated project check')
	await execute(packageManager, ['run', 'check'], {
		cwd: projectRoot,
		shell: process.platform === 'win32',
		timeout: 600_000,
	})

	report('done', `migration canary passed for ${packageManager}`)
}

async function prepareBaseline() {
	report('generation', `scaffolding released template with ${packageManager}`)
	await execute(
		'npm',
		['create', 'jst@latest', 'app', '--', '--yes', '--no-git', '--package-manager', packageManager],
		{ cwd: temporaryRoot, shell: process.platform === 'win32', timeout: 600_000 },
	)
	report('generation', `reconstructing ${from} state from the migration contract`)
	await reverseMigration()
	report('generation', 'adding a user-owned file')
	await writeFile(join(projectRoot, 'notes.txt'), 'user-owned note\n')
	report('generation', 'committing baseline')
	await gitInit()
	await gitCommit('test: migration canary baseline')
	return snapshotTrackedFiles()
}

async function exerciseRollback() {
	report('rollback', 'forcing post-migration verification failure')
	await writeFile(join(projectRoot, 'src/broken.ts'), 'const broken = ;\n')
	await gitCommit('test: deliberately broken source')
	const originalConfig = await readFile(join(projectRoot, 'eslint.config.js'), 'utf8')
	const failedMigration = await migrate().then(
		() => null,
		(error) => error,
	)
	assert.ok(failedMigration, 'migration must fail when verification fails')
	assert.doesNotMatch(
		`${failedMigration.stdout}\n${failedMigration.stderr}`,
		/clean Git working tree|not a Git repository/u,
	)
	assert.equal(await readFile(join(projectRoot, 'eslint.config.js'), 'utf8'), originalConfig)
	await assert.rejects(readFile(join(projectRoot, 'jst.config.ts'), 'utf8'), { code: 'ENOENT' })
	await rm(join(projectRoot, 'src/broken.ts'), { force: true })
	await gitCommit('test: drop broken source')
}

async function reverseMigration() {
	const configPath = join(projectRoot, 'eslint.config.js')
	const source = await readFile(configPath, 'utf8')
	const importLine = "import policy from './jst.config.ts'\n"
	assert.ok(source.includes(importLine), 'template must import policy from jst.config.ts')
	assert.match(source, /jst\.createConfig\(policy\)/u, 'template must use jst.createConfig(policy)')
	await writeFile(
		configPath,
		source.replace(importLine, '').replace(/jst\.createConfig\(policy\)/gu, 'jst.configs.recommended'),
	)
	await rm(join(projectRoot, 'jst.config.ts'), { force: true })
}

async function gitInit() {
	await execute('git', ['init', '--initial-branch=main'], { cwd: projectRoot })
	await execute('git', ['config', 'user.name', 'JST Canary'], { cwd: projectRoot })
	await execute('git', ['config', 'user.email', 'jst-canary@example.invalid'], { cwd: projectRoot })
}

async function gitCommit(message) {
	await execute('git', ['add', '-A'], { cwd: projectRoot })
	await execute('git', ['commit', '--no-verify', '-m', message], { cwd: projectRoot, timeout: 600_000 })
}

async function gitStatus() {
	const { stdout } = await execute('git', ['status', '--porcelain'], { cwd: projectRoot })
	return stdout
}

function migrate(...args) {
	return execute(process.execPath, [jstCli, 'migrate', '--from', from, ...args], {
		cwd: projectRoot,
		timeout: 600_000,
	})
}

async function snapshotTrackedFiles() {
	const { stdout } = await execute('git', ['ls-files', '-z'], { cwd: projectRoot })
	const paths = stdout.split('\0').filter(Boolean)
	const files = new Map()
	for (const path of paths) {
		files.set(path, await readFile(join(projectRoot, path)))
	}
	return files
}

async function assertUserFilesIntact(snapshot) {
	for (const [path, content] of snapshot) {
		if (path === 'eslint.config.js') {
			continue
		}
		assert.deepEqual(await readFile(join(projectRoot, path)), content, `${path} changed during migration`)
	}
}

function report(stage, message) {
	process.stdout.write(`[${stage}] ${message}\n`)
}

async function writeFailureArtifacts(error) {
	try {
		await mkdir(artifactDirectory, { recursive: true })
		await writeFile(
			join(artifactDirectory, 'versions.json'),
			`${JSON.stringify({ from, to, packageManager, node: process.version, error: error.message }, null, '\t')}\n`,
		)
		await writeFile(join(artifactDirectory, 'manifests.json'), await collectManifests())
		await writeFile(join(artifactDirectory, 'diff.txt'), await capture(['git', 'diff'], { cwd: projectRoot }))
		await writeFile(join(artifactDirectory, 'migration.log'), `${error.stdout ?? ''}\n${error.stderr ?? ''}\n`)
	} catch (artifactError) {
		process.stderr.write(`[artifacts] ${artifactError.message}\n`)
	}
}

async function collectManifests() {
	const manifests = {}
	for (const name of ['package.json', 'jst.compatibility.json', 'jst.template.json']) {
		try {
			manifests[name] = await readFile(join(projectRoot, name), 'utf8')
		} catch {
			manifests[name] = null
		}
	}
	return `${JSON.stringify(manifests, null, '\t')}\n`
}

async function capture(command, options) {
	try {
		const { stdout } = await execute(command[0], command.slice(1), options)
		return stdout
	} catch (error) {
		return `${error.stdout ?? ''}\n${error.stderr ?? ''}\n`
	}
}
