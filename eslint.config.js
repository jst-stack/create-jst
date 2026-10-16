import js from '@eslint/js'
import quality from '@jst-stack/eslint-plugin-quality'

export default [
	js.configs.recommended,
	...quality.createRulesConfig({ limits: { maxLineLength: 140 } }),
	{
		files: ['**/*.{js,mjs}'],
		languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
		rules: {
			curly: ['error', 'all'],
			'no-console': 'error',
			'no-else-return': 'error',
			'object-shorthand': 'error',
			'prefer-const': 'error',
		},
	},
	{
		files: ['src/{cli,jst}.mjs'],
		rules: {
			// These adapters expose Node's mutable process-like exitCode contract.
			'no-param-reassign': ['error', { props: false }],
		},
	},
	{
		files: ['src/infrastructure/nodeProjectGateway.mjs'],
		rules: {
			// The factory is a cohesive composition root for one ProjectGateway port.
			'max-lines-per-function': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
		},
	},
	{
		files: ['test/**/*.mjs'],
		rules: {
			// Integration fixtures intentionally contain complete generated source lines.
			'@stylistic/max-len': ['error', { code: 180, ignoreRegExpLiterals: true, ignoreUrls: true, tabWidth: 4 }],
		},
	},
]
