import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { performance } from 'node:perf_hooks'
import { URL } from 'node:url'
import { run } from '../src/cli.mjs'

const root = await mkdtemp(join(tmpdir(), 'create-jst-benchmark-'))
const baselinePath = new URL('../benchmarks/baseline.json', import.meta.url)
try {
	const template = await createFixture(root)
	const result = await measureCreation(root, template)
	if (process.argv.includes('--write-baseline')) {
		await mkdir(dirname(baselinePath.pathname), { recursive: true })
		await writeFile(baselinePath, `${JSON.stringify({ result, tolerance: 0.2 }, null, 2)}\n`)
	}
	else {
		const baseline = JSON.parse(await readFile(baselinePath, 'utf8'))
		const maximum = baseline.result.wallMs * (1 + baseline.tolerance) + 100
		if (result.wallMs > maximum) {
			throw new Error(`No-install creation regressed: ${result.wallMs} > ${maximum} ms.`)
		}
	}
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}
finally {
	await rm(root, { force: true, recursive: true })
}

async function createFixture(root) {
	const template = join(root, 'template')
	await mkdir(join(template, 'scripts'), { recursive: true })
	await writeFile(join(template, 'package.json'), '{"name":"template","scripts":{"template:setup":"node scripts/setup-template.mjs"}}\n')
	await writeFile(join(template, 'jst.template.json'), '{"schemaVersion":1,"templateVersion":"benchmark","options":{"colorSchemes":["dark"],"primaryColors":["lime"],"styles":["css"]}}\n')
	await writeFile(join(template, 'scripts/setup-template.mjs'), "import { rm } from 'node:fs/promises'\nawait rm('scripts/setup-template.mjs')\n")
	return template
}

async function measureCreation(root, template) {
	const destination = join(root, 'app')
	const startedAt = performance.now()
	const cpuBefore = process.cpuUsage()
	const output = { write() {} }
	const environment = {
		cwd: () => root,
		env: process.env,
		exitCode: 0,
		off: process.off.bind(process),
		once: process.once.bind(process),
		stderr: output,
		stdin: { isTTY: false },
		stdout: output,
	}
	await run([destination, '--yes', '--no-install', '--no-git', '--template', template], environment)
	if (environment.exitCode) {
		throw new Error('Benchmark project creation failed.')
	}
	const cpu = process.cpuUsage(cpuBefore)
	return {
		cpuMs: (cpu.user + cpu.system) / 1000,
		peakMemoryBytes: process.resourceUsage().maxRSS * 1024,
		wallMs: performance.now() - startedAt,
	}
}
