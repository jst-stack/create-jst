import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { SHOWCASE_SOURCE, TEMPLATE_SOURCE } from '../src/domain/projectSpecification.mjs'

const execute = promisify(execFile)
const [templateRepository, templateReference] = parseSource(TEMPLATE_SOURCE)
const [showcaseRepository, showcaseReference] = parseSource(SHOWCASE_SOURCE)
const templateSha = await remoteSha(templateRepository, `refs/tags/${templateReference}^{}`)
	.catch(() => remoteSha(templateRepository, `refs/tags/${templateReference}`))
await assertCommit(showcaseRepository, showcaseReference)
process.stdout.write(`Template ${templateSha.slice(0, 12)} and showcase ${showcaseReference.slice(0, 12)} pins are available.\n`)

function parseSource(source) {
	const [repository, reference] = source.split('#')
	if (!repository || !reference) {
		throw new Error(`Invalid source: ${source}`)
	}
	return [repository, reference]
}

async function remoteSha(repository, reference) {
	const { stdout } = await execute('git', ['ls-remote', `https://github.com/${repository}.git`, reference], { timeout: 15_000 })
	const sha = stdout.trim().split(/\s/u)[0]
	if (!sha) {
		throw new Error(`Remote source does not exist: ${repository}#${reference}.`)
	}
	return sha
}

async function assertCommit(repository, sha) {
	const directory = await mkdtemp(resolve(tmpdir(), 'create-jst-source-'))
	try {
		await execute('git', ['init', '--quiet'], { cwd: directory, timeout: 15_000 })
		await execute('git', ['fetch', '--quiet', '--depth=1', `https://github.com/${repository}.git`, sha], { cwd: directory, timeout: 30_000 })
	}
	catch (error) {
		throw new Error(`Remote source does not exist: ${repository}#${sha}.`, { cause: error })
	}
	finally {
		await rm(directory, { force: true, recursive: true })
	}
}
