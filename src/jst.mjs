#!/usr/bin/env node

import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createProjectMigrator } from './application/projectMigrator.mjs'
import { resolveMigrationPath } from './domain/migrationCatalog.mjs'
import { createNodeMigrationGateway } from './infrastructure/nodeMigrationGateway.mjs'

export async function run(argv, environment = process, migrator = createProjectMigrator({ gateway: createNodeMigrationGateway() })) {
	try {
		const command = parseCommand(argv)
		if (command.help) {
			environment.stdout.write('Usage: jst migrate --from <version> [--to <version>] [--dry-run]\n')
			return
		}
		const migrations = resolveMigrationPath(command.from, command.to)
		const result = await migrator.execute({ directory: environment.cwd(), dryRun: command.dryRun, from: command.from, migrations, to: command.to ?? migrations.at(-1)?.to ?? command.from })
		environment.stdout.write(`${command.dryRun ? 'Would migrate' : 'Migrated'} ${result.from} → ${result.to}: ${result.changedFiles.join(', ')}\n`)
	}
	catch (error) {
		environment.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
		environment.exitCode = 1
	}
}

function parseCommand(argv) {
	const { positionals, values } = parseArgs({ args: argv, allowPositionals: true, options: {
		'dry-run': { type: 'boolean' }, from: { type: 'string' }, to: { type: 'string' }, help: { short: 'h', type: 'boolean' },
	}, strict: true })
	const help = Boolean(values.help || positionals[0] !== 'migrate')
	if (!help && !values.from) {
		throw new Error('--from is required.')
	}
	return { dryRun: values['dry-run'] ?? false, from: values.from, help, to: values.to }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await run(process.argv.slice(2))
}
