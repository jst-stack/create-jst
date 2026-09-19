import { basename } from 'node:path'

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

	return {
		error(message) {
			output.write(`\n${paint('31', '✕')} ${message}\n`)
		},
		plan(specification) {
			output.write(`\n${paint('38;5;203', 'JST')} ${dim('plan only — no files will be written')}\n\n`)
			output.write(`  destination     ${specification.destination}\n`)
			output.write(`  template        ${specification.template}\n`)
			output.write(`  package manager ${specification.packageManager}\n`)
			output.write(`  starter demo    ${specification.demo}\n`)
			output.write(`  install         ${specification.install ? 'yes' : 'no'}\n`)
			output.write(`  git             ${specification.initGit ? 'yes' : 'no'}\n\n`)
		},
		start() {
			output.write(`\n${paint('38;5;203', 'JST')} ${dim('A foundation for replaceable layers')}\n\n`)
		},
		subscribe(events) {
			return events.subscribe(event => {
				if (event.type === 'project.initialized') return this.success(event.specification)
				const message = progressMessages[event.type]
				if (message) output.write(`${dim('  ◌')} ${message(event.specification)}\n`)
			})
		},
		success(specification) {
			output.write(`\n${paint('38;5;114', 'Ready.')} ${specification.title} is in ${paint('38;5;203', basename(specification.destination))}.\n\n`)
			output.write(`  ${dim('$')} cd ${basename(specification.destination)}\n`)
			output.write(`  ${dim('$')} ${specification.packageManager} run dev\n\n`)
		},
	}
}
