import { execFile } from 'node:child_process'
import process from 'node:process'
import { promisify } from 'node:util'
import { SHOWCASE_SOURCE, TEMPLATE_SOURCE } from '../src/domain/projectSpecification.mjs'

const execute = promisify(execFile)
const [templateRepository, templateReference] = parseSource(TEMPLATE_SOURCE)
const [showcaseRepository, showcaseReference] = parseSource(SHOWCASE_SOURCE)
const templateSha = await remoteSha(templateRepository, `refs/tags/${templateReference}^{}`)
	.catch(() => remoteSha(templateRepository, `refs/tags/${templateReference}`))
const showcaseMainSha = await remoteSha(showcaseRepository, 'refs/heads/main')
if (showcaseReference !== showcaseMainSha) {
	throw new Error(`SHOWCASE_SOURCE is stale: ${showcaseReference} != ${showcaseMainSha}. Review main and update the immutable pin.`)
}
process.stdout.write(`Template ${templateSha.slice(0, 12)} and showcase ${showcaseMainSha.slice(0, 12)} pins are current.\n`)

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
