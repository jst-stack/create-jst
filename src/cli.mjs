#!/usr/bin/env node

import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseCommandLine, printHelp, resolveOptions, validateOptions } from './lib/options.mjs'
import { createReporter } from './lib/reporter.mjs'
import { ensureDestinationIsEmpty, scaffoldProject } from './lib/scaffold.mjs'

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await run(process.argv.slice(2))
}

export async function run(argv, environment = process) {
	const command = parseCommandLine(argv)

	if (command.values.help) {
		printHelp(environment.stdout)
		return
	}
	if (command.values.version) {
		environment.stdout.write(`${process.env.npm_package_version ?? '0.2.0'}\n`)
		return
	}

	const reporter = createReporter(environment.stdout, environment.env)
	try {
		const options = await resolveOptions(command, environment)
		validateOptions(options)
		await ensureDestinationIsEmpty(options.destination)

		if (options.dryRun) {
			reporter.plan(options)
			return
		}

		await scaffoldProject(options, reporter)
	}
	catch (error) {
		reporter.error(error instanceof Error ? error.message : String(error))
		environment.exitCode = 1
	}
}
