import { basename, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { COLOR_SCHEMES, DEFAULTS, PACKAGE_MANAGERS, PRIMARY_COLORS, TEMPLATE_SOURCE } from './constants.mjs'

export function parseCommandLine(args) {
	return parseArgs({
		allowPositionals: true,
		args,
		options: {
			'color-scheme': { type: 'string' },
			'demo': { type: 'string' },
			'description': { type: 'string' },
			'dry-run': { type: 'boolean' },
			'git': { type: 'boolean' },
			'help': { short: 'h', type: 'boolean' },
			'lang': { type: 'string' },
			'name': { type: 'string' },
			'no-git': { type: 'boolean' },
			'no-install': { type: 'boolean' },
			'no-interactive': { type: 'boolean' },
			'package-manager': { type: 'string' },
			'primary-color': { type: 'string' },
			'skip-install': { type: 'boolean' },
			'template': { type: 'string' },
			'title': { type: 'string' },
			'version': { short: 'v', type: 'boolean' },
			'yes': { short: 'y', type: 'boolean' },
		},
		strict: true,
	})
}

export async function resolveOptions(command, environment) {
	const { positionals, values } = command
	if (positionals.length > 1) throw new Error('Only one project directory can be provided.')
	if (values.git && values['no-git']) throw new Error('Use either --git or --no-git, not both.')
	if (values['no-install'] && values['skip-install']) throw new Error('Use either --no-install or --skip-install, not both.')

	const interactive = Boolean(environment.stdin.isTTY) && !values.yes && !values['no-interactive']
	const prompt = interactive ? await createPrompt(environment) : undefined

	try {
		const directory = positionals[0] ?? await prompt?.text('Project directory', 'my-jst-app') ?? 'my-jst-app'
		const name = values.name ?? normalizePackageName(basename(resolve(environment.cwd(), directory)))
		const title = values.title ?? toTitle(name)
		const detectedPackageManager = detectPackageManager(environment.env)
		const requestedPackageManager = values['package-manager']
			?? await prompt?.choice('Package manager', PACKAGE_MANAGERS.filter(value => value !== 'auto'), detectedPackageManager)
			?? detectedPackageManager
		const packageManager = requestedPackageManager === 'auto' ? detectedPackageManager : requestedPackageManager
		const demo = values.demo ?? await prompt?.choice('Start from', ['remove', 'keep'], DEFAULTS.demo) ?? DEFAULTS.demo
		const install = !(values['no-install'] || values['skip-install'])
		const initGit = values.git ?? !values['no-git']

		return {
			colorScheme: values['color-scheme'] ?? DEFAULTS.colorScheme,
			demo,
			description: values.description ?? `${title} web application.`,
			destination: resolve(environment.cwd(), directory),
			dryRun: values['dry-run'] ?? false,
			initGit: interactive ? await prompt.choice('Initialize a Git repository', ['yes', 'no'], initGit ? 'yes' : 'no') === 'yes' : initGit,
			install: interactive ? await prompt.choice('Install dependencies', ['yes', 'no'], install ? 'yes' : 'no') === 'yes' : install,
			language: values.lang ?? DEFAULTS.language,
			name,
			packageManager,
			primaryColor: values['primary-color'] ?? DEFAULTS.primaryColor,
			template: values.template ?? TEMPLATE_SOURCE,
			title,
		}
	}
	finally {
		prompt?.close()
	}
}

export function validateOptions(options) {
	if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(options.name) || options.name.length > 214) {
		throw new Error(`Invalid npm package name: ${options.name}`)
	}
	if (!COLOR_SCHEMES.includes(options.colorScheme)) throw new Error(`Colour scheme must be one of: ${COLOR_SCHEMES.join(', ')}.`)
	if (!PRIMARY_COLORS.includes(options.primaryColor)) throw new Error(`Primary colour must be one of: ${PRIMARY_COLORS.join(', ')}.`)
	if (!['keep', 'remove'].includes(options.demo)) throw new Error('Demo mode must be either keep or remove.')
	if (!PACKAGE_MANAGERS.includes(options.packageManager)) throw new Error(`Package manager must be one of: ${PACKAGE_MANAGERS.join(', ')}.`)
}

export function detectPackageManager(environment = {}) {
	const userAgent = environment.npm_config_user_agent ?? ''
	if (userAgent.startsWith('pnpm/')) return 'pnpm'
	if (userAgent.startsWith('yarn/')) return 'yarn'
	if (userAgent.startsWith('bun/')) return 'bun'
	return 'npm'
}

export function normalizePackageName(value) {
	return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'jst-app'
}

export function toTitle(value) {
	return value.replace(/^@[^/]+\//, '').split(/[-_.]+/).filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(' ')
}

export function printHelp(output) {
	output.write(`Create a web application from the JST template.

Usage:
  npm create jst@latest [directory] [options]

The interactive wizard only asks about decisions that affect the generated project.
Application title and description are derived from the directory; pass flags only when automation needs overrides.

Options:
  --demo <keep|remove>           retain or remove the starter demo
  --package-manager <manager>    auto, npm, pnpm, yarn, or bun
  --no-install                   create the project without installing dependencies
  --git, --no-git                initialize a Git repository (default: enabled)
  --dry-run                      show the resolved plan without writing files
  --no-interactive, -y, --yes    accept defaults without prompts
  --title <title>                override the derived application title
  --description <description>    override the derived SEO description
  --name <name>                  override the derived npm package name
  --lang <language>              document language (default: en)
  --color-scheme <scheme>        light, dark, or auto
  --primary-color <colour>       Mantine primary colour
  --template <owner/repo[#ref]>  use a compatible template source
  -v, --version                  show the CLI version
  -h, --help                     show this help

Examples:
  npm create jst@latest my-app
  npm create jst@latest my-app -- --package-manager pnpm --demo keep
  npm create jst@latest my-app -- --yes --no-install --no-git
`)
}

async function createPrompt(environment) {
	const { createInterface } = await import('node:readline/promises')
	const reader = createInterface({ input: environment.stdin, output: environment.stdout })
	return {
		async choice(label, choices, fallback) {
			const rendered = choices.map((choice, index) => `${index + 1}:${choice}`).join('  ')
			const answer = (await reader.question(`  ${label} (${rendered}) [${fallback}]: `)).trim()
			if (!answer) return fallback
			const index = Number.parseInt(answer, 10)
			return choices[index - 1] ?? answer
		},
		close() {
			reader.close()
		},
		async text(label, fallback) {
			return (await reader.question(`  ${label} [${fallback}]: `)).trim() || fallback
		},
	}
}
