export const CURRENT_PROJECT_VERSION = '0.4.0'

export const migrations = Object.freeze([
	Object.freeze({
		from: '0.3.0',
		to: CURRENT_PROJECT_VERSION,
		files: Object.freeze(['eslint.config.js']),
		apply(files) {
			const eslintConfig = files.get('eslint.config.js')
			if (!eslintConfig?.includes('jst.configs.recommended')) {
				throw new Error(
					'Migration requires eslint.config.js to use jst.configs.recommended; migrate custom ESLint composition manually.',
				)
			}
			const withPolicy = eslintConfig.includes("from './jst.config.ts'")
				? eslintConfig
				: addPolicyImport(eslintConfig)
			files.set('eslint.config.js', withPolicy.replace('jst.configs.recommended', 'jst.createConfig(policy)'))
			files.set(
				'jst.config.ts',
				"import { defineConfig } from '@jst-stack/eslint-plugin'\n\nexport default defineConfig({})\n",
			)
		},
	}),
])

function addPolicyImport(source) {
	const lines = source.split('\n')
	let importEnd = 0
	for (let index = 0; index < lines.length; index += 1) {
		if (lines[index].startsWith('import ')) {
			importEnd = index + 1
		}
	}
	lines.splice(importEnd, 0, "import policy from './jst.config.ts'")
	return lines.join('\n')
}

export function resolveMigrationPath(from, to = CURRENT_PROJECT_VERSION) {
	const path = []
	let version = from
	while (version !== to) {
		const migration = migrations.find((candidate) => candidate.from === version)
		if (!migration || path.includes(migration)) {
			throw new Error(`No supported migration path from ${from} to ${to}.`)
		}
		path.push(migration)
		version = migration.to
	}
	return Object.freeze(path)
}
