import assert from 'node:assert/strict'
import test from 'node:test'
import { CURRENT_PROJECT_VERSION, migrations, resolveMigrationPath } from '../src/domain/migrationCatalog.mjs'
import { normalizePackageName, toTitle } from '../src/domain/projectSpecification.mjs'
import { parseCommandLine } from '../src/ui/command.mjs'

const ITERATIONS = 200
const NAME_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ._-/@:!'
const VALUE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789._'
const STRING_OPTIONS = ['color-scheme', 'description', 'example', 'lang', 'name', 'package-manager', 'style', 'template', 'title']
const SHORT_FLAGS = { '-h': 'help', '-v': 'version', '-y': 'yes' }

function createRandom(seed) {
	let state = seed >>> 0
	return () => {
		state = (state + 0x6d2b79f5) >>> 0
		let value = Math.imul(state ^ (state >>> 15), state | 1)
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296
	}
}

function randomFrom(random, alphabet, maxLength) {
	const length = 1 + Math.floor(random() * maxLength)
	let value = ''
	for (let index = 0; index < length; index += 1) {
		value += alphabet[Math.floor(random() * alphabet.length)]
	}
	return value
}

function randomName(random) {
	return randomFrom(random, NAME_ALPHABET, 14)
}

function randomValue(random) {
	return randomFrom(random, VALUE_ALPHABET, 10)
}

test('accepts --option=value and --option value as the same command line', () => {
	const random = createRandom(0x5eed)
	for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
		const option = STRING_OPTIONS[Math.floor(random() * STRING_OPTIONS.length)]
		const value = randomValue(random)
		const spaced = parseCommandLine(['app', '--' + option, value])
		const joined = parseCommandLine(['app', '--' + option + '=' + value])
		assert.deepEqual(joined.values, spaced.values)
	}
})

test('keeps positional arguments in order whatever the option mix', () => {
	const random = createRandom(0xc0ffee)
	for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
		const positionals = Array.from({ length: 1 + Math.floor(random() * 3) }, () => randomValue(random))
		const option = STRING_OPTIONS[Math.floor(random() * STRING_OPTIONS.length)]
		const argv = ['--' + option, randomValue(random), ...positionals]
		assert.deepEqual(parseCommandLine(argv).positionals, positionals)
	}
})

test('maps every short flag onto its long form', () => {
	for (const [short, long] of Object.entries(SHORT_FLAGS)) {
		assert.deepEqual(parseCommandLine([short]).values, parseCommandLine(['--' + long]).values)
	}
})

test('rejects unknown flags instead of ignoring them', () => {
	const random = createRandom(0xbad)
	for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
		const flag = '--' + randomFrom(random, 'abcdefghijklmnopqrstuvwxyz', 8) + 'z'
		assert.throws(() => parseCommandLine(['app', flag]), { code: 'ERR_PARSE_ARGS_UNKNOWN_OPTION' })
	}
})

test('normalizes any directory name into a stable package name', () => {
	const random = createRandom(0xd15ea5e)
	for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
		const normalized = normalizePackageName(randomName(random))
		assert.match(normalized, /^[a-z0-9][a-z0-9._-]*$/u)
		assert.equal(normalizePackageName(normalized), normalized)
	}
})

test('resolves a migration path that only walks forward from a known version', () => {
	const versions = [CURRENT_PROJECT_VERSION, ...migrations.map((migration) => migration.from)]
	for (const version of versions) {
		const path = resolveMigrationPath(version)
		assert.equal(new Set(path).size, path.length)
		path.forEach((migration, index) => {
			assert.equal(migration.from, index === 0 ? version : path[index - 1].to)
		})
		if (path.length > 0) {
			assert.equal(path.at(-1).to, CURRENT_PROJECT_VERSION)
		}
	}
})

test('refuses to invent a migration path for an unknown version', () => {
	const random = createRandom(0xfeed)
	const known = new Set(migrations.flatMap((migration) => [migration.from, migration.to]))
	for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
		const version = String(Math.floor(random() * 10)) + '.' + String(Math.floor(random() * 10)) + '.0'
		if (known.has(version)) {
			continue
		}
		assert.throws(() => resolveMigrationPath(version), /No supported migration path/u)
	}
})

test('derives a non-empty title without a scope prefix', () => {
	const random = createRandom(0x7e57)
	for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
		const title = toTitle(normalizePackageName(randomName(random)))
		assert.notEqual(title.trim(), '')
		assert.doesNotMatch(title, /\//u)
	}
})
