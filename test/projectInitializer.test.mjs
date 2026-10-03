import assert from 'node:assert/strict'
import test from 'node:test'
import { createProjectInitializer } from '../src/application/projectInitializer.mjs'
import { buildProjectSpecification } from '../src/domain/projectSpecification.mjs'

test('orchestrates replaceable gateways and publishes progress', async () => {
	const calls = []
	const published = []
	const initializer = createProjectInitializer({
		onProgress: event => published.push(event.type),
		projectGateway: {
			assertDestinationIsEmpty: async destination => calls.push(['assert', destination]),
			cleanupDestination: async destination => calls.push(['cleanup', destination]),
			commitDestination: async (temporary, destination) => calls.push(['commit', temporary, destination]),
			configurePackageManager: async (_destination, manager) => calls.push(['manager', manager]),
			configureTemplate: async specification => calls.push(['configure', specification.name]),
			initializeGit: async () => calls.push(['git']),
			installDependencies: async (_destination, manager) => calls.push(['install', manager]),
			prepareDestination: async destination => `${destination}.tmp`,
			validateTemplate: async specification => calls.push(['validate', specification.destination]),
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
		['clone', 'owner/template', '/projects/example.tmp'],
		['validate', '/projects/example.tmp'],
		['configure', 'example'],
		['manager', 'pnpm'],
		['git'],
		['install', 'pnpm'],
		['commit', '/projects/example.tmp', '/projects/example'],
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

test('removes temporary output and preserves the destination after failure', async () => {
	const calls = []
	const initializer = createProjectInitializer({
		projectGateway: {
			assertDestinationIsEmpty: async () => undefined,
			cleanupDestination: async destination => calls.push(['cleanup', destination]),
			commitDestination: async () => calls.push(['commit']),
			configureTemplate: async () => { throw new Error('invalid template') },
			prepareDestination: async () => '/projects/.example.tmp',
			validateTemplate: async () => undefined,
		},
		templateGateway: { clone: async () => undefined },
	})
	const specification = buildProjectSpecification({ destination: '/projects/example', name: 'example', title: 'Example' })

	await assert.rejects(initializer.execute(specification), /invalid template/)
	assert.deepEqual(calls, [['cleanup', '/projects/.example.tmp']])
})
