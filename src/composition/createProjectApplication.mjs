import process from 'node:process'
import { createProjectInitializer } from '../application/projectInitializer.mjs'
import { createDegitTemplateGateway } from '../infrastructure/degitTemplateGateway.mjs'
import { createNodeProjectGateway } from '../infrastructure/nodeProjectGateway.mjs'

export function createProjectApplication({ nodeExecutable = process.execPath, onProgress, signal } = {}) {
	const initializer = createProjectInitializer({
		onProgress,
		projectGateway: createNodeProjectGateway({ nodeExecutable, signal }),
		templateGateway: createDegitTemplateGateway(),
	})
	return { initializer }
}
