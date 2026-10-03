import { basename, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import * as prompts from '@clack/prompts'
import { buildProjectSpecification, EXAMPLES, normalizePackageName, PACKAGE_MANAGERS, STYLE_LANGUAGES, toTitle } from '../domain/projectSpecification.mjs'

export function parseCommandLine(args) {
	return parseArgs({
		allowPositionals: true,
		args,
		options: {
			'color-scheme': { type: 'string' },
			'description': { type: 'string' },
			'dry-run': { type: 'boolean' },
			'example': { type: 'string' },
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
			'style': { type: 'string' },
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
	validateCommand(positionals, values)

	const prompt = await createPrompt(environment, values)
	try {
		const identity = await resolveProjectIdentity(positionals, values, environment, prompt)
		const packageManager = await resolvePackageManager(values, environment, prompt)
		const decisions = await resolveProjectDecisions(values, prompt)
		const example = values.example ?? 'clean'
		const style = values.style
			?? await prompt?.choice('CSS Modules language', STYLE_LANGUAGES, 'css')
			?? 'css'

		return {
			dryRun: values['dry-run'] ?? false,
			interactive: Boolean(prompt),
			terminal: Boolean(environment.stdin.isTTY),
			specification: buildProjectSpecification({
				colorScheme: values['color-scheme'],
				description: values.description ?? `${identity.title} web application.`,
				destination: resolve(environment.cwd(), identity.directory),
				example,
				initGit: decisions.initGit,
				install: decisions.install,
				language: values.lang,
				name: identity.name,
				packageManager,
				primaryColor: values['primary-color'],
				style,
				template: values.template,
				title: identity.title,
			}),
		}
	}
	finally {
		prompt?.close()
	}
}

export function detectPackageManager(environment = {}) {
	const userAgent = environment.npm_config_user_agent ?? ''
	if (userAgent.startsWith('pnpm/')) {
		return 'pnpm'
	}
	return 'npm'
}

export function printHelp(output) {
	output.write(`Create a web application from the JST template.

Usage:
  npm create jst@latest [directory] [options]

The interactive wizard only asks about decisions that affect the generated project.
Application title and description are derived from the directory; pass flags only when automation needs overrides.

Options:
  --package-manager <manager>    auto, npm, or pnpm
  --no-install                   create the project without installing dependencies
  --git, --no-git                initialize a Git repository (default: enabled)
  --dry-run                      show the resolved plan without writing files
  --example <name>               clean or showcase (default: clean)
  --no-interactive, -y, --yes    accept defaults without prompts
  --title <title>                override the derived application title
  --description <description>    override the derived SEO description
  --name <name>                  override the derived npm package name
  --lang <language>              document language (default: en)
  --color-scheme <scheme>        light, dark, or auto
  --primary-color <colour>       Mantine primary colour
  --style <language>             css or scss (default: css)
  --template <owner/repo[#ref]>  use a compatible template source
  -v, --version                  show the CLI version
  -h, --help                     show this help
`)
}

async function createPrompt(environment, values) {
	if (!environment.stdin.isTTY || values.yes || values['no-interactive']) {
		return undefined
	}
	prompts.intro('create-jst')
	return {
		async choice(label, choices, fallback) {
			return resolvePrompt(await prompts.select({
				initialValue: fallback,
				message: label,
				options: choices.map(value => ({ hint: choiceHint(value), label: value, value })),
			}))
		},
		close() {
			return undefined
		},
		async confirm(label, initialValue) {
			return resolvePrompt(await prompts.confirm({ initialValue, message: label }))
		},
		async text(label, fallback) {
			return resolvePrompt(await prompts.text({ initialValue: fallback, message: label }))
		},
	}
}

function choiceHint(value) {
	return {
		npm: 'default',
	}[value]
}

function resolvePrompt(value) {
	if (!prompts.isCancel(value)) {
		return value
	}
	prompts.cancel('Setup cancelled.')
	const error = new Error('Setup cancelled.')
	error.name = 'PromptCancelledError'
	throw error
}

function validateCommand(positionals, values) {
	if (positionals.length > 1) {
		throw new Error('Only one project directory can be provided.')
	}
	if (values.git && values['no-git']) {
		throw new Error('Use either --git or --no-git, not both.')
	}
	if (values['no-install'] && values['skip-install']) {
		throw new Error('Use either --no-install or --skip-install, not both.')
	}
	if (values.example && !EXAMPLES.includes(values.example)) {
		throw new Error(`Example must be one of: ${EXAMPLES.join(', ')}.`)
	}
}

async function resolveProjectIdentity(positionals, values, environment, prompt) {
	const directory = positionals[0]
		?? await prompt?.text('Project directory', 'my-jst-app')
		?? 'my-jst-app'
	const name = values.name
		?? normalizePackageName(basename(resolve(environment.cwd(), directory)))

	return {
		directory,
		name,
		title: values.title ?? toTitle(name),
	}
}

async function resolvePackageManager(values, environment, prompt) {
	const detected = detectPackageManager(environment.env)
	const requested = values['package-manager']
		?? await prompt?.choice('Package manager', PACKAGE_MANAGERS, detected)
		?? detected

	return requested === 'auto' ? detected : requested
}

async function resolveProjectDecisions(values, prompt) {
	const initGit = values.git ?? !values['no-git']
	const install = !(values['no-install'] || values['skip-install'])

	return {
		initGit: prompt ? await prompt.confirm('Initialize a Git repository?', initGit) : initGit,
		install: prompt ? await prompt.confirm('Install dependencies?', install) : install,
	}
}
