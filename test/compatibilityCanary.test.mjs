import assert from 'node:assert/strict'
import test from 'node:test'
import { parseTemplateSource, verifyCompatibility } from '../src/domain/compatibilityContract.mjs'

const pin = { ref: 'v0.4.35', repository: 'jst-stack/jst' }
const templateNodeRange = '>=24.15.0 <25'
const manifest = {
	packages: { '@jst-stack/eslint-plugin': '>=0.5.3 <0.6.0', 'create-jst': '>=0.4.0 <0.5.0' },
	runtime: { node: templateNodeRange },
	template: { releaseTag: 'v0.4.35' },
}
const published = { '@jst-stack/eslint-plugin': '0.5.3', 'create-jst': '0.4.36' }

test('accepts a manifest that matches the pin and the published versions', () => {
	assert.deepEqual(verifyCompatibility({ manifest, pin, published, templateNodeRange }), [])
})

test('reports a manifest that advertises a different template tag', () => {
	const stale = { ...manifest, template: { releaseTag: 'v0.4.31' } }
	const [failure] = verifyCompatibility({ manifest: stale, pin, published, templateNodeRange })
	assert.match(failure, /advertises v0\.4\.31 while create-jst pins v0\.4\.35/u)
})

test('reports a manifest whose Node.js range drifted from the template contract', () => {
	const drifted = { ...manifest, runtime: { node: '>=24.15.0' } }
	const [failure] = verifyCompatibility({ manifest: drifted, pin, published, templateNodeRange })
	assert.match(failure, /declares Node\.js >=24\.15\.0 while create-jst enforces/u)
})

test('reports a published package outside the advertised range', () => {
	const [failure] = verifyCompatibility({
		manifest,
		pin,
		published: { ...published, 'create-jst': '0.5.0' },
		templateNodeRange,
	})
	assert.match(failure, /create-jst@0\.5\.0 is outside the advertised range/u)
})

test('reports a package without a resolved published version', () => {
	const failures = verifyCompatibility({ manifest, pin, published: {}, templateNodeRange })
	assert.equal(failures.length, 2)
	assert.match(failures[0], /no published version was resolved for @jst-stack\/eslint-plugin/u)
	assert.match(failures[1], /no published version was resolved for create-jst/u)
})

test('splits an owner/repository pin from its tag', () => {
	assert.deepEqual(parseTemplateSource('jst-stack/jst#v0.4.35'), pin)
	assert.equal(parseTemplateSource('jst-stack/jst'), undefined)
})
