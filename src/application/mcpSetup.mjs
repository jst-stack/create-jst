export function createMcpSetup({ gateway }) {
	return {
		async execute({ projectRoot, dryRun = false }) {
			const project = await gateway.inspectProject(projectRoot)
			if (dryRun) {
				return { ...project, dryRun, steps: ['npm install --global @jst-stack/mcp', 'jst-mcp init'] }
			}
			await gateway.installGlobal()
			const registration = await gateway.registerPi(projectRoot)
			return { ...project, dryRun, registration, steps: registration.steps }
		},
	}
}
