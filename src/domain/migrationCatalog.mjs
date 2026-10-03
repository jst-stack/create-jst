export const CURRENT_PROJECT_VERSION = '0.4.0'

export const migrations = Object.freeze([
	Object.freeze({
		from: '0.3.0',
		to: CURRENT_PROJECT_VERSION,
		files: Object.freeze(['eslint.config.js']),
		apply(files) {
			const eslintConfig = files.get('eslint.config.js')
			if (!eslintConfig?.includes("jst.configs['strict']")) {
				throw new Error("Migration requires eslint.config.js to use jst.configs['strict']; migrate custom ESLint composition manually.")
			}
			const withPolicy = eslintConfig.includes("from './jst.config.ts'")
				? eslintConfig
				: `import policy from './jst.config.ts'\n${eslintConfig}`
			files.set('eslint.config.js', withPolicy.replace("jst.configs['strict']", 'jst.createConfig(policy)'))
			files.set('jst.config.ts', "import { defineConfig } from '@jst-stack/eslint-plugin/policy'\n\nexport default defineConfig({})\n")
		},
	}),
])

export function resolveMigrationPath(from, to = CURRENT_PROJECT_VERSION) {
	const path = []
	let version = from
	while (version !== to) {
		const migration = migrations.find(candidate => candidate.from === version)
		if (!migration || path.includes(migration)) {
			throw new Error(`No supported migration path from ${from} to ${to}.`)
		}
		path.push(migration)
		version = migration.to
	}
	return Object.freeze(path)
}
