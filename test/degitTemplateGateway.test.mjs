import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import { createDegitTemplateGateway } from '../src/infrastructure/degitTemplateGateway.mjs'

const exec = promisify(execFile)
const gitConfiguration = ['-c', 'user.name=create-jst', '-c', 'user.email=create-jst@example.com']

test(
	'clones a pinned commit that is not a branch or tag tip',
	async () => {
		const root = await mkdtemp(join(tmpdir(), 'create-jst-gateway-'))
		const remote = join(root, 'remote')
		try {
			await exec('git', ['init', '--quiet', remote])
			await writeFile(join(remote, 'package.json'), '{"name":"pinned"}\n')
			await exec('git', ['add', '.'], { cwd: remote })
			await exec('git', [...gitConfiguration, 'commit', '--quiet', '-m', 'first'], { cwd: remote })
			await writeFile(join(remote, 'package.json'), '{"name":"pinned","version":"1.0.0"}\n')
			await exec('git', ['add', '.'], { cwd: remote })
			await exec('git', [...gitConfiguration, 'commit', '--quiet', '-m', 'second'], { cwd: remote })
			const { stdout } = await exec('git', ['rev-parse', 'HEAD~1'], { cwd: remote })
			const pinned = stdout.trim()

			const gateway = createDegitTemplateGateway({ resolveRemote: () => `file://${remote}` })
			const destination = join(root, 'clone')
			await gateway.clone(`jst-stack/showcase#${pinned}`, destination)

			assert.deepEqual(JSON.parse(await readFile(join(destination, 'package.json'), 'utf8')), { name: 'pinned' })
			await assert.rejects(readFile(join(destination, '.git', 'HEAD')), { code: 'ENOENT' })
		} finally {
			await rm(root, { force: true, recursive: true })
		}
	},
	{ timeout: 60_000 },
)

test(
	'reports a pinned commit that the remote does not contain',
	async () => {
		const root = await mkdtemp(join(tmpdir(), 'create-jst-gateway-'))
		const remote = join(root, 'remote')
		try {
			await exec('git', ['init', '--quiet', remote])
			await writeFile(join(remote, 'package.json'), '{"name":"pinned"}\n')
			await exec('git', ['add', '.'], { cwd: remote })
			await exec('git', [...gitConfiguration, 'commit', '--quiet', '-m', 'first'], { cwd: remote })

			const gateway = createDegitTemplateGateway({ resolveRemote: () => `file://${remote}` })
			await assert.rejects(
				gateway.clone(`jst-stack/showcase#${'0'.repeat(40)}`, join(root, 'clone')),
				/Could not download jst-stack\/showcase#0{40}/u,
			)
		} finally {
			await rm(root, { force: true, recursive: true })
		}
	},
	{ timeout: 60_000 },
)
