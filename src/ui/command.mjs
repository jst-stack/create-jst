import { basename, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { buildProjectSpecification, normalizePackageName, PACKAGE_MANAGERS, toTitle } from '../domain/projectSpecification.mjs'

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

export async function resolveProjectRequest(command, environment) {
	const { positionals, values } = command
	if (positionals.length > 1) throw new Error('Only one project directory can be provided.')
	if (values.git && values['no-git']) throw new Error('Use either --git or --no-git, not both.')
	if (values['no-install'] && values['skip-install']) throw new Error('Use either --no-install or --skip-install, not both.')

	const prompt = await createPrompt(environment, values)
	try {
		const directory = positionals[0] ?? await prompt?.text('Project directory', 'my-jst-app') ?? 'my-jst-app'
		const name = values.name ?? normalizePackageName(basename(resolve(environment.cwd(), directory)))
		const title = values.title ?? toTitle(name)
		const detectedPackageManager = detectPackageManager(environment.env)
		const requestedPackageManager = values['package-manager']
			?? await prompt?.choice('Package manager', PACKAGE_MANAGERS, detectedPackageManager)
			?? detectedPackageManager
		const packageManager = requestedPackageManager === 'auto' ? detectedPackageManager : requestedPackageManager
		const initGit = values.git ?? !values['no-git']
		const install = !(values['no-install'] || values['skip-install'])

		return {
			dryRun: values['dry-run'] ?? false,
			specification: buildProjectSpecification({
				colorScheme: values['color-scheme'],
				demo: values.demo ?? await prompt?.choice('Start from', ['remove', 'keep'], 'remove') ?? 'remove',
				description: values.description ?? `${title} web application.`,
				destination: resolve(environment.cwd(), directory),
				initGit: prompt ? await prompt.choice('Initialize a Git repository', ['yes', 'no'], initGit ? 'yes' : 'no') === 'yes' : initGit,
				install: prompt ? await prompt.choice('Install dependencies', ['yes', 'no'], install ? 'yes' : 'no') === 'yes' : install,
				language: values.lang,
				name,
				packageManager,
				primaryColor: values['primary-color'],
				template: values.template,
				title,
			}),
		}
	}
	finally {
		prompt?.close()
	}
}

export function detectPackageManager(environment = {}) {
	const userAgent = environment.npm_config_user_agent ?? ''
	if (userAgent.startsWith('pnpm/')) return 'pnpm'
	if (userAgent.startsWith('yarn/')) return 'yarn'
	if (userAgent.startsWith('bun/')) return 'bun'
	return 'npm'
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
`)
}

async function createPrompt(environment, values) {
	if (!environment.stdin.isTTY || values.yes || values['no-interactive']) return undefined
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
