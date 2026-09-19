#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { lstat, readdir } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import degit from 'degit'

const run = promisify(execFile)
const colors = ['dark', 'gray', 'red', 'pink', 'grape', 'violet', 'indigo', 'blue', 'cyan', 'teal', 'green', 'lime', 'yellow', 'orange']
const schemes = ['light', 'dark', 'auto']
const templateSource = 'jst-stack/jst'

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await main()
}

async function main() {
	try {
		const { values, positionals } = parseArgs({
			allowPositionals: true,
			options: {
				'color-scheme': { type: 'string' },
				'demo': { type: 'string' },
				'description': { type: 'string' },
				'help': { short: 'h', type: 'boolean' },
				'lang': { type: 'string' },
				'name': { type: 'string' },
				'no-git': { type: 'boolean' },
				'primary-color': { type: 'string' },
				'skip-install': { type: 'boolean' },
				'template': { type: 'string' },
				'title': { type: 'string' },
				'yes': { short: 'y', type: 'boolean' },
			},
			strict: true,
		})

		if (values.help) {
			console.log(help())
			return
		}

		const options = await resolveOptions(values, positionals)
		validate(options)
		await ensureTargetIsEmpty(options.destination)
		await createProject(options)
	}
	catch (error) {
		console.error(`\n✕ ${error instanceof Error ? error.message : error}`)
		process.exitCode = 1
	}
}

async function resolveOptions(values, positionals) {
	const interactive = process.stdin.isTTY && !values.yes
	const prompts = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : undefined

	try {
		const directory = positionals[0] ?? await ask(prompts, 'Project directory', 'my-jst-app')
		const name = values.name ?? normalizePackageName(basename(resolve(directory)))
		const title = values.title ?? await ask(prompts, 'Application title', toTitle(name))

		return {
			colorScheme: values['color-scheme'] ?? await ask(prompts, `Colour scheme (${schemes.join('/')})`, 'dark'),
			demo: values.demo ?? await ask(prompts, 'Keep the starter demo (keep/remove)', 'remove'),
			description: values.description ?? `${title} web application.`,
			destination: resolve(directory),
			language: values.lang ?? 'en',
			name,
			primaryColor: values['primary-color'] ?? await ask(prompts, `Primary colour (${colors.join('/')})`, 'lime'),
			skipGit: values['no-git'] ?? false,
			skipInstall: values['skip-install'] ?? false,
			template: values.template ?? templateSource,
			title,
		}
	}
	finally {
		prompts?.close()
	}
}

async function ask(prompts, label, fallback) {
	if (!prompts) return fallback
	const answer = (await prompts.question(`  ${label} ${dim(`[${fallback}]`)} `)).trim()
	return answer || fallback
}

function validate(options) {
	if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(options.name) || options.name.length > 214) {
		throw new Error(`Invalid npm package name: ${options.name}`)
	}
	if (!schemes.includes(options.colorScheme)) throw new Error(`Colour scheme must be one of: ${schemes.join(', ')}.`)
	if (!colors.includes(options.primaryColor)) throw new Error(`Primary colour must be one of: ${colors.join(', ')}.`)
	if (!['keep', 'remove'].includes(options.demo)) throw new Error('Demo mode must be either keep or remove.')
}

async function ensureTargetIsEmpty(destination) {
	if (!existsSync(destination)) return
	const entries = await readdir(destination)
	if (entries.length > 0) throw new Error(`Destination is not empty: ${destination}`)
	const stat = await lstat(destination)
	if (!stat.isDirectory()) throw new Error(`Destination is not a directory: ${destination}`)
}

async function createProject(options) {
	console.log(`\n${accent('JST')} ${dim('A foundation for replaceable layers')}\n`)
	console.log(`${dim('  ◌')} Downloading ${options.template}`)
	const emitter = degit(options.template, { disableCache: true, force: false, verbose: false })
	await emitter.clone(options.destination)

	console.log(`${dim('  ◌')} Configuring ${options.title}`)
	await run(process.execPath, [
		'scripts/setup-template.mjs',
		'--yes',
		'--name', options.name,
		'--title', options.title,
		'--description', options.description,
		'--lang', options.language,
		'--color-scheme', options.colorScheme,
		'--primary-color', options.primaryColor,
		'--demo', options.demo,
	], { cwd: options.destination })

	if (!options.skipGit) {
		console.log(`${dim('  ◌')} Initialising Git`)
		await run('git', ['init', '--initial-branch=main'], { cwd: options.destination })
	}

	if (!options.skipInstall) {
		console.log(`${dim('  ◌')} Installing dependencies`)
		await run('npm', ['install'], { cwd: options.destination, stdio: 'inherit' })
	}

	console.log(`\n${success('Ready.')} ${options.title} is in ${accent(basename(options.destination))}.\n`)
	console.log(`  ${dim('$')} cd ${basename(options.destination)}`)
	console.log(`  ${dim('$')} npm run dev\n`)
}

function normalizePackageName(value) {
	return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'jst-app'
}

function toTitle(value) {
	return value.replace(/^@[^/]+\//, '').split(/[-_.]+/).filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(' ')
}

function accent(value) {
	return `\u001B[38;5;203m${value}\u001B[0m`
}

function dim(value) {
	return `\u001B[2m${value}\u001B[0m`
}

function success(value) {
	return `\u001B[38;5;114m${value}\u001B[0m`
}

function help() {
	return `Create a project from the JST template.

Usage:
  npm create jst@latest <directory> [options]

Options:
  --name <name>                 npm package name
  --title <title>               application title
  --description <description>   SEO description
  --lang <language>             document language (default: en)
  --color-scheme <scheme>       light, dark, or auto
  --primary-color <colour>      Mantine primary colour
  --demo <keep|remove>          retain the JST demo (default: remove)
  --skip-install                do not install dependencies
  --no-git                      do not initialise Git
  --template <owner/repo>       override the template source
  -y, --yes                     accept all defaults
  -h, --help                    show this help
`
}

export { normalizePackageName, toTitle }
