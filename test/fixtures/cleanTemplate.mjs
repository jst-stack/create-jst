import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

export async function createPackageManagerStub(root) {
	const cwdOutput = join(root, 'pnpm-cwd')
	if (process.platform === 'win32') {
		const stubPath = join(root, 'pnpm-stub.mjs')
		await writeFile(
			stubPath,
			`import { writeFileSync } from 'node:fs'\nwriteFileSync(${JSON.stringify(cwdOutput)}, process.cwd())\nconsole.log('9.15.0')\n`,
		)
		await writeFile(join(root, 'pnpm.cmd'), `@echo off\r\n"${process.execPath}" "${stubPath}"\r\n`)
		return
	}
	const executable = join(root, 'pnpm')
	await writeFile(executable, `#!/bin/sh\nprintf '%s' "$PWD" > "${cwdOutput}"\necho 9.15.0\n`)
	await chmod(executable, 0o755)
}

export async function createTemplate(root) {
	const template = join(root, 'template')
	await mkdir(join(template, 'scripts'), { recursive: true })
	await mkdir(join(template, '.github/workflows'), { recursive: true })
	await writeFile(
		join(template, 'package.json'),
		`${JSON.stringify(
			{
				engines: { node: '>=24.15.0 <25' },
				name: 'jst-template',
				packageManager: 'npm@11.6.2',
				scripts: { check: 'npm run lint', lint: 'echo ok', 'template:setup': 'node scripts/setup-template.mjs' },
			},
			null,
			'\t',
		)}\n`,
	)
	await writeFile(join(template, 'package-lock.json'), '{}\n')
	await writeFile(join(template, 'README.md'), 'npm ci\nnpm run check\n')
	await writeFile(
		join(template, '.github/workflows/ci.yml'),
		`steps:
  - uses: actions/setup-node@setup-node-sha
    with:
      cache: npm
  - run: npm install -g npm@11.6.2
  - run: npm ci
  - run: npm run check
  - run: npx playwright install
`,
	)
	await writeFile(
		join(template, 'Dockerfile'),
		`FROM node:24 AS build
COPY package.json package-lock.json ./
RUN npm ci
RUN npm run build
CMD ["npm", "start"]
`,
	)
	await writeFile(
		join(template, 'jst.template.json'),
		'{"schemaVersion":1,"templateVersion":"test","options":{"colorSchemes":["light","dark","auto"],"primaryColors":["lime"],"styles":["css","scss"]}}\n',
	)
	await writeFile(
		join(template, 'scripts/setup-template.mjs'),
		`
import { readFile, rm, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'

const { values } = parseArgs({ options: {
  name: { type: 'string' }, quiet: { type: 'boolean' }, style: { type: 'string' }, yes: { type: 'boolean' },
  title: { type: 'string' }, description: { type: 'string' }, lang: { type: 'string' },
  'color-scheme': { type: 'string' }, 'primary-color': { type: 'string' },
} })
const manifest = JSON.parse(await readFile('package.json', 'utf8'))
manifest.name = values.name
delete manifest.scripts['template:setup']
await writeFile('package.json', JSON.stringify(manifest, null, '\\t') + '\\n')
await writeFile('jst.config.ts', \`export default { styles: { moduleExtension: '\${values.style}' } } as const\\n\`)
await rm('scripts/setup-template.mjs')
`,
	)
	return template
}
