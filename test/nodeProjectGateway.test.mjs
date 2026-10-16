import { strict as assert } from 'node:assert'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { test } from 'node:test'
import { createNodeProjectGateway } from '../src/infrastructure/nodeProjectGateway.mjs'

test('terminates project commands that exceed the gateway deadline', async () => {
	const destination = await mkdtemp(resolve(tmpdir(), 'create-jst-timeout-'))
	try {
		await mkdir(resolve(destination, 'scripts'))
		await writeFile(resolve(destination, 'scripts/setup-template.mjs'), 'setTimeout(() => {}, 60_000)\n')
		const gateway = createNodeProjectGateway({ nodeExecutable: process.execPath, timeout: 20 })

		await assert.rejects(
			gateway.configureTemplate({
				colorScheme: 'dark',
				description: 'Test',
				destination,
				language: 'en',
				name: 'test',
				primaryColor: 'lime',
				style: 'css',
				title: 'Test',
			}),
			/timed out after 20ms/u,
		)
	} finally {
		await rm(destination, { force: true, recursive: true })
	}
})
