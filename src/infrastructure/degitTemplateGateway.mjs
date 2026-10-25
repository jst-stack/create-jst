import degit from 'degit'
import { execFile } from 'node:child_process'
import { cp, mkdir, rm } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const COMMIT_REFERENCE = /^[\da-f]{40}$/u

export function createDegitTemplateGateway({
	gitExecutable = 'git',
	gitTimeout = 180_000,
	resolveRemote = (repository) => `https://github.com/${repository}.git`,
} = {}) {
	return {
		async clone(source, destination) {
			if (isAbsolute(source) || source.startsWith('.')) {
				return cp(resolve(source), destination, { recursive: true })
			}

			const [repository, reference] = splitSource(source)
			if (COMMIT_REFERENCE.test(reference)) {
				return cloneCommit({ destination, gitExecutable, gitTimeout, reference, remote: resolveRemote(repository), repository })
			}

			return degit(source, { disableCache: true, force: false, verbose: false }).clone(destination)
		},
	}
}

function splitSource(source) {
	const [repository, reference = ''] = source.split('#')
	return [repository, reference]
}

async function cloneCommit({ destination, gitExecutable, gitTimeout, reference, remote, repository }) {
	await mkdir(destination, { recursive: true })

	try {
		await git(gitExecutable, ['init', '--quiet'], destination, gitTimeout)
		await git(gitExecutable, ['fetch', '--quiet', '--depth=1', remote, reference], destination, gitTimeout)
		await git(gitExecutable, ['checkout', '--quiet', '--detach', 'FETCH_HEAD'], destination, gitTimeout)
	} catch (error) {
		throw new Error(`Could not download ${repository}#${reference}: ${describeFailure(error)}`, { cause: error })
	} finally {
		await rm(resolve(destination, '.git'), { force: true, recursive: true })
	}
}

function git(executable, args, cwd, timeout) {
	return execute(executable, args, { cwd, maxBuffer: 8 * 1024 * 1024, timeout })
}

function describeFailure(error) {
	const stderr = error?.stderr?.trim()
	return stderr ? stderr.split('\n').at(-1) : (error?.message ?? String(error))
}
