export function createProjectMigrator({ gateway }) {
	return {
		async execute({ directory, dryRun, from, migrations, to }) {
			await gateway.assertSafeGitState(directory)
			const files = await gateway.readMigrationFiles(directory, migrations)
			for (const migration of migrations) {
				migration.apply(files)
			}
			if (dryRun) {
				return { changedFiles: [...files.keys()].sort(), from, to }
			}
			await gateway.writeTransaction(directory, files, () => gateway.verify(directory))
			return { changedFiles: [...files.keys()].sort(), from, to }
		},
	}
}
