export function createProjectInitializer({ onProgress = () => undefined, projectGateway, templateGateway }) {
	return {
		async execute(specification) {
			await projectGateway.assertDestinationIsEmpty(specification.destination)
			const temporaryDestination = await projectGateway.prepareDestination(specification.destination)
			const temporarySpecification = Object.freeze({ ...specification, destination: temporaryDestination })
			let rollbackDestination = temporaryDestination

			try {
			onProgress({ type: 'template.download.started', specification })
				await templateGateway.clone(specification.template, temporaryDestination)
				if (specification.example === 'clean') {
					await projectGateway.validateTemplate(temporarySpecification)
				}

				onProgress({ type: 'project.configuration.started', specification })
				if (specification.example === 'showcase') {
					await projectGateway.configureExample(temporarySpecification)
				}
				else {
					await projectGateway.configureTemplate(temporarySpecification)
				}

				if (specification.packageManager !== 'npm') {
					onProgress({ type: 'package-manager.configuration.started', specification })
					await projectGateway.configurePackageManager(temporaryDestination, specification.packageManager)
				}
				if (specification.initGit) {
					onProgress({ type: 'git.initialization.started', specification })
					await projectGateway.initializeGit(temporaryDestination)
				}
				else {
					await projectGateway.removeGitMetadata(temporaryDestination)
				}
				if (specification.install) {
					await projectGateway.assertRuntimeSupported(temporaryDestination)
				}
				await projectGateway.commitDestination(temporaryDestination, specification.destination)
				rollbackDestination = specification.destination
				if (specification.install) {
					onProgress({ type: 'dependencies.installation.started', specification })
					await projectGateway.installDependencies(
						specification.destination,
						specification.packageManager,
						{ gitHooks: specification.initGit },
					)
				}

				onProgress({ type: 'project.initialized', specification })
			}
			catch (error) {
				await projectGateway.cleanupDestination(rollbackDestination)
				throw error
			}
		},
	}
}
