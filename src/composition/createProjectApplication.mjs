import process from 'node:process'
import { createEventBus } from '../application/eventBus.mjs'
import { createProjectInitializer } from '../application/projectInitializer.mjs'
import { createDegitTemplateGateway } from '../infrastructure/degitTemplateGateway.mjs'
import { createNodeProjectGateway } from '../infrastructure/nodeProjectGateway.mjs'

export function createProjectApplication({ nodeExecutable = process.execPath } = {}) {
	const events = createEventBus()
	const initializer = createProjectInitializer({
		events,
		projectGateway: createNodeProjectGateway({ nodeExecutable }),
		templateGateway: createDegitTemplateGateway(),
	})
	return { events, initializer }
}
