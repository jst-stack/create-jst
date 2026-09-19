import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizePackageName, toTitle } from '../src/cli.mjs'

test('normalizes a directory name to a package name', () => {
	assert.equal(normalizePackageName('My JST App!'), 'my-jst-app')
})

test('derives a readable application title', () => {
	assert.equal(toTitle('@jst-stack/my-jst_app'), 'My Jst App')
})
