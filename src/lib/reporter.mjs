import { basename } from 'node:path'

export function createReporter(output, environment = {}) {
	const color = Boolean(output.isTTY) && !environment.NO_COLOR
	const paint = (code, value) => color ? `\u001B[${code}m${value}\u001B[0m` : value
	const dim = value => paint('2', value)

	return {
		error(message) {
			output.write(`\n${paint('31', '✕')} ${message}\n`)
		},
		plan(options) {
			output.write(`\n${paint('38;5;203', 'JST')} ${dim('plan only — no files will be written')}\n\n`)
			output.write(`  destination     ${options.destination}\n`)
			output.write(`  template        ${options.template}\n`)
			output.write(`  package manager ${options.packageManager}\n`)
			output.write(`  starter demo    ${options.demo}\n`)
			output.write(`  install         ${options.install ? 'yes' : 'no'}\n`)
			output.write(`  git             ${options.initGit ? 'yes' : 'no'}\n\n`)
		},
		start() {
			output.write(`\n${paint('38;5;203', 'JST')} ${dim('A foundation for replaceable layers')}\n\n`)
		},
		step(message) {
			output.write(`${dim('  ◌')} ${message}\n`)
		},
		success(options) {
			output.write(`\n${paint('38;5;114', 'Ready.')} ${options.title} is in ${paint('38;5;203', basename(options.destination))}.\n\n`)
			if (basename(options.destination) !== '.') output.write(`  ${dim('$')} cd ${basename(options.destination)}\n`)
			output.write(`  ${dim('$')} ${options.packageManager} run dev\n\n`)
		},
	}
}
