import assert from 'node:assert/strict'
import test from 'node:test'
import { createEventBus } from '../src/application/eventBus.mjs'
import { createProjectInitializer } from '../src/application/projectInitializer.mjs'
import { buildProjectSpecification } from '../src/domain/projectSpecification.mjs'

test('orchestrates replaceable gateways and publishes progress', async () => {
	const calls = []
	const events = createEventBus()
	const published = []
	events.subscribe(event => published.push(event.type))
	const initializer = createProjectInitializer({
		events,
		projectGateway: {
			assertDestinationIsEmpty: async destination => calls.push(['assert', destination]),
			configurePackageManager: async (_destination, manager) => calls.push(['manager', manager]),
			configureTemplate: async specification => calls.push(['configure', specification.name]),
			initializeGit: async () => calls.push(['git']),
			installDependencies: async (_destination, manager) => calls.push(['install', manager]),
		},
		templateGateway: {
			clone: async (source, destination) => calls.push(['clone', source, destination]),
		},
	})
	const specification = buildProjectSpecification({
		destination: '/projects/example',
		name: 'example',
		packageManager: 'pnpm',
		template: 'owner/template',
		title: 'Example',
	})

	await initializer.execute(specification)

	assert.deepEqual(calls, [
		['assert', '/projects/example'],
		['clone', 'owner/template', '/projects/example'],
		['configure', 'example'],
		['manager', 'pnpm'],
		['git'],
		['install', 'pnpm'],
	])
	assert.deepEqual(published, [
		'template.download.started',
		'project.configuration.started',
		'package-manager.configuration.started',
		'git.initialization.started',
		'dependencies.installation.started',
		'project.initialized',
	])
})
