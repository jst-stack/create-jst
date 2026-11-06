import { execFile } from 'node:child_process'
import process from 'node:process'
import { promisify } from 'node:util'
import { parseTemplateSource, verifyCompatibility } from '../src/domain/compatibilityContract.mjs'
import { TEMPLATE_NODE_RANGE } from '../src/domain/nodeContract.mjs'
import { TEMPLATE_SOURCE } from '../src/domain/projectSpecification.mjs'

const execute = promisify(execFile)
const pin = parseTemplateSource(TEMPLATE_SOURCE)

if (!pin) {
	throw new Error(`Cannot derive a template pin from ${TEMPLATE_SOURCE}.`)
}

const manifest = await fetchManifest(pin)
const published = await publishedVersions(Object.keys(manifest.packages ?? {}))
const failures = verifyCompatibility({ manifest, pin, published, templateNodeRange: TEMPLATE_NODE_RANGE })

if (failures.length > 0) {
	throw new Error(
		`Compatibility contract drift. ${failures.join(' ')} ` +
			'Run the Prepare compatibility release branch workflow in jst-stack/jst and merge the result.',
	)
}

process.stdout.write(`Compatibility contract verified for ${pin.ref}: ${JSON.stringify(published)}\\n`)

async function fetchManifest(target) {
	const url = `https://raw.githubusercontent.com/${target.repository}/${target.ref}/jst.compatibility.json`
	const response = await globalThis.fetch(url)
	if (!response.ok) {
		throw new Error(`${url} answered ${response.status}; the pinned template has no compatibility manifest.`)
	}
	return response.json()
}

async function publishedVersions(names) {
	const versions = {}
	for (const name of names) {
		const { stdout } = await execute('npm', ['view', name, 'version'])
		versions[name] = stdout.trim()
	}
	return versions
}
