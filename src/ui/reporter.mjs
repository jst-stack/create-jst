import { basename } from 'node:path'
import * as prompts from '@clack/prompts'

const progressMessages = {
	'dependencies.installation.started': specification => `Installing dependencies with ${specification.packageManager}`,
	'git.initialization.started': () => 'Initialising Git',
	'package-manager.configuration.started': specification => `Preparing ${specification.packageManager}`,
	'project.configuration.started': specification => `Configuring ${specification.title}`,
	'template.download.started': specification => `Downloading ${specification.template}`,
}

export function createReporter(output, environment = {}) {
	const color = Boolean(output.isTTY) && !environment.NO_COLOR
	const paint = (code, value) => color ? `\u001B[${code}m${value}\u001B[0m` : value
	const dim = value => paint('2', value)
	let activeSpinner
	let usesClack = false

	return {
		error(message) {
			if (usesClack) {
				activeSpinner?.stop('Failed')
				prompts.cancel(message)
				return
			}
			output.write(`\n${paint('31', '✕')} ${message}\n`)
		},
		plan(specification, request) {
			usesClack = request.terminal
			if (usesClack) {
				if (!request.interactive) {
					prompts.intro('create-jst')
				}
				prompts.note([
					`Template: ${specification.template}`,
					`Package manager: ${specification.packageManager}`,
					`Install dependencies: ${specification.install ? 'yes' : 'no'}`,
					`Initialize Git: ${specification.initGit ? 'yes' : 'no'}`,
				].join('\n'), specification.destination)
				prompts.outro('Dry run complete — no files were written.')
				return
			}
			output.write(`\n${paint('38;5;203', 'JST')} ${dim('plan only — no files will be written')}\n\n`)
			output.write(`  destination     ${specification.destination}\n`)
			output.write(`  template        ${specification.template}\n`)
			output.write(`  package manager ${specification.packageManager}\n`)
			output.write(`  install         ${specification.install ? 'yes' : 'no'}\n`)
			output.write(`  git             ${specification.initGit ? 'yes' : 'no'}\n\n`)
		},
		start(request) {
			usesClack = request.terminal
			if (usesClack) {
				if (!request.interactive) {
					prompts.intro('create-jst')
				}
				return
			}
			output.write(`\n${paint('38;5;203', 'JST')} ${dim('A foundation for replaceable layers')}\n\n`)
		},
		progress(event) {
				if (event.type === 'project.initialized') {
					return this.success(event.specification)
				}
				const message = progressMessages[event.type]
				if (!message) {
					return
				}
				if (usesClack) {
					activeSpinner?.stop()
					activeSpinner = prompts.spinner()
					activeSpinner.start(message(event.specification))
					return
				}
				output.write(`${dim('  ◌')} ${message(event.specification)}\n`)
		},
		success(specification) {
			renderSuccess({ activeSpinner, dim, output, paint, specification, usesClack })
		},
	}
}

function renderSuccess({ activeSpinner, dim, output, paint, specification, usesClack }) {
	const directory = basename(specification.destination)
	const { guidance, setup } = getNextSteps(specification, directory)
	if (usesClack) {
		activeSpinner?.stop('Project created')
		prompts.note([...setup, '', ...guidance].join('\n'), 'Next steps')
		prompts.outro(`${specification.title} is ready.`)
		return
	}
	output.write(`\n${paint('38;5;114', 'Ready.')} ${specification.title} is in ${paint('38;5;203', directory)}.\n\n`)
	for (const command of setup) {
		output.write(`  ${dim('$')} ${command}\n`)
	}
	output.write('\n')
	for (const instruction of guidance) {
		output.write(`  ${instruction}\n`)
	}
	output.write('\n')
}

function getNextSteps(specification, directory) {
	const { install, packageManager } = specification
	return {
		guidance: [
			`First slice  ${packageManager} run create:slice -- feature firstFeature`,
			`Fast gate    ${packageManager} run validate`,
			`Release gate ${packageManager} run check:release`,
		],
		setup: [
			`cd ${directory}`,
			...(install ? [] : [`${packageManager} install`]),
			`${packageManager} run dev`,
		],
	}
}
