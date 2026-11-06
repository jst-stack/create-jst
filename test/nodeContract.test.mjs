import assert from 'node:assert/strict'
import test from 'node:test'
import packageMetadata from '../package.json' with { type: 'json' }
import {
	assertNodeSupported,
	GENERATOR_NODE_RANGE,
	parseNodeRange,
	pinnedTemplateNodeRange,
	satisfiesNodeRange,
	TEMPLATE_NODE_RANGE,
} from '../src/domain/nodeContract.mjs'
import { SHOWCASE_SOURCE, TEMPLATE_SOURCE } from '../src/domain/projectSpecification.mjs'

test('accepts versions inside the template range', () => {
	assert.equal(satisfiesNodeRange('24.15.0', TEMPLATE_NODE_RANGE), true)
	assert.equal(satisfiesNodeRange('24.20.1', TEMPLATE_NODE_RANGE), true)
	assert.equal(satisfiesNodeRange('v24.15.0', TEMPLATE_NODE_RANGE), true)
})

test('rejects versions outside the template range', () => {
	assert.equal(satisfiesNodeRange('24.14.9', TEMPLATE_NODE_RANGE), false)
	assert.equal(satisfiesNodeRange('25.0.0', TEMPLATE_NODE_RANGE), false)
	assert.equal(satisfiesNodeRange('22.14.0', TEMPLATE_NODE_RANGE), false)
	assert.equal(satisfiesNodeRange('22.14.0', GENERATOR_NODE_RANGE), true)
})

test('expands partial comparators', () => {
	assert.deepEqual(parseNodeRange('<25'), [{ operator: '<', version: [25, 0, 0] }])
	assert.deepEqual(parseNodeRange('>=24.15.0 <25'), [
		{ operator: '>=', version: [24, 15, 0] },
		{ operator: '<', version: [25, 0, 0] },
	])
	assert.equal(parseNodeRange('latest'), undefined)
	assert.equal(parseNodeRange(undefined), undefined)
})

test('reports an actionable error for an unsupported version', () => {
	assert.throws(
		() => assertNodeSupported({ current: '22.14.0', range: TEMPLATE_NODE_RANGE, subject: 'The generated JST project' }),
		/The generated JST project requires Node\.js >=24\.15\.0 <25; this process runs Node\.js 22\.14\.0\./u,
	)
})

test('applies the pinned check only to the pinned template sources', () => {
	assert.equal(pinnedTemplateNodeRange({}), TEMPLATE_NODE_RANGE)
	assert.equal(pinnedTemplateNodeRange({ example: 'showcase' }), TEMPLATE_NODE_RANGE)
	assert.equal(pinnedTemplateNodeRange({ template: TEMPLATE_SOURCE }), TEMPLATE_NODE_RANGE)
	assert.equal(pinnedTemplateNodeRange({ template: SHOWCASE_SOURCE }), TEMPLATE_NODE_RANGE)
	assert.equal(pinnedTemplateNodeRange({ template: './my-template' }), undefined)
})

test('keeps the generator engines in sync with the declared range', () => {
	assert.equal(packageMetadata.engines.node, GENERATOR_NODE_RANGE)
})
