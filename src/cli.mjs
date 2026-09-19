#!/usr/bin/env node

import process from 'node:process'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createProjectApplication } from './composition/createProjectApplication.mjs'
import { parseCommandLine, printHelp, resolveProjectRequest } from './ui/command.mjs'
import { createReporter } from './ui/reporter.mjs'

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) await run(process.argv.slice(2))

export async function run(argv, environment = process, application = createProjectApplication()) {
	const reporter = createReporter(environment.stdout, environment.env)
	try {
		const command = parseCommandLine(argv)
		if (command.values.help) return printHelp(environment.stdout)
		if (command.values.version) return environment.stdout.write(`${process.env.npm_package_version ?? '0.3.0'}\n`)

		const request = await resolveProjectRequest(command, environment)
		if (request.dryRun) return reporter.plan(request.specification)

		reporter.start()
		const unsubscribe = reporter.subscribe(application.events)
		try {
			await application.initializer.execute(request.specification)
		}
		finally {
			unsubscribe()
		}
	}
	catch (error) {
		reporter.error(error instanceof Error ? error.message : String(error))
		environment.exitCode = 1
	}
}
