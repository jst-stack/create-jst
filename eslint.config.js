import js from '@eslint/js'

export default [
	js.configs.recommended,
	{
		files: ['**/*.{js,mjs}'],
		languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
		rules: {
			'curly': ['error', 'all'],
			'no-console': 'error',
			'no-else-return': 'error',
			'object-shorthand': 'error',
			'prefer-const': 'error',
		},
	},
	{
		files: ['src/**/*.mjs'],
		rules: {
			'complexity': ['error', 12],
			'max-depth': ['error', 3],
			'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
			'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
			'max-params': ['error', 4],
		},
	},
]
