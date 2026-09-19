export function createProjectInitializer({ events, projectGateway, templateGateway }) {
	return {
		async execute(specification) {
			await projectGateway.assertDestinationIsEmpty(specification.destination)

			events.publish({ type: 'template.download.started', specification })
			await templateGateway.clone(specification.template, specification.destination)

			events.publish({ type: 'project.configuration.started', specification })
			await projectGateway.configureTemplate(specification)

			if (specification.packageManager !== 'npm') {
				events.publish({ type: 'package-manager.configuration.started', specification })
				await projectGateway.configurePackageManager(specification.destination, specification.packageManager)
			}
			if (specification.initGit) {
				events.publish({ type: 'git.initialization.started', specification })
				await projectGateway.initializeGit(specification.destination)
			}
			if (specification.install) {
				events.publish({ type: 'dependencies.installation.started', specification })
				await projectGateway.installDependencies(specification.destination, specification.packageManager)
			}

			events.publish({ type: 'project.initialized', specification })
		},
	}
}
