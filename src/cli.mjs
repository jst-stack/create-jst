#!/usr/bin/env node

import process from 'node:process'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import packageMetadata from '../package.json' with { type: 'json' }
import { createProjectApplication } from './composition/createProjectApplication.mjs'
import { assertNodeSupported, pinnedTemplateNodeRange } from './domain/nodeContract.mjs'
import { parseCommandLine, printHelp, resolveProjectRequest } from './ui/command.mjs'
import { createReporter } from './ui/reporter.mjs'

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await run(process.argv.slice(2))
}

export async function run(argv, environment = process, injectedApplication) {
	const reporter = createReporter(environment.stdout, environment.env)
	const signals = registerCancellation(environment)
	try {
		const command = parseCommandLine(argv)
		if (command.values.help) {
			return printHelp(environment.stdout)
		}
		if (command.values.version) {
			return environment.stdout.write(`${packageMetadata.version}\n`)
		}

		assertTemplateRuntime(command, environment)

		const request = await resolveProjectRequest(command, environment)
		if (request.dryRun) {
			return reporter.plan(request.specification, request)
		}

		reporter.start(request)
		const application =
			injectedApplication ?? createProjectApplication({ onProgress: (event) => reporter.progress(event), signal: signals.signal })
		await application.initializer.execute(request.specification)
	} catch (error) {
		if (error instanceof Error && error.name === 'PromptCancelledError') {
			return
		}
		reporter.error(error instanceof Error ? error.message : String(error))
		environment.exitCode = 1
	} finally {
		signals.dispose()
	}
}

function assertTemplateRuntime(command, environment) {
	if (command.values['dry-run'] || command.values['no-install'] || command.values['skip-install']) {
		return
	}
	const range = pinnedTemplateNodeRange({ example: command.values.example, template: command.values.template })
	if (!range) {
		return
	}
	const current = environment.versions?.node ?? process.versions.node
	assertNodeSupported({ current, range, subject: 'The generated JST project' })
}

function registerCancellation(environment) {
	const controller = new globalThis.AbortController()
	const abort = () => controller.abort(new Error('Setup cancelled by signal.'))
	environment.once?.('SIGINT', abort)
	environment.once?.('SIGTERM', abort)
	return {
		dispose() {
			environment.off?.('SIGINT', abort)
			environment.off?.('SIGTERM', abort)
		},
		signal: controller.signal,
	}
}
