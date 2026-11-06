import { SHOWCASE_SOURCE, TEMPLATE_SOURCE } from './projectSpecification.mjs'

export const GENERATOR_NODE_RANGE = '>=22.14.0'
export const TEMPLATE_NODE_RANGE = '>=24.15.0 <25'

const COMPARATOR_PATTERN = /^(>=|<=|>|<|=)?v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/u
const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)/u

export function parseNodeRange(range) {
	if (typeof range !== 'string') {
		return undefined
	}
	const comparators = range
		.trim()
		.split(/\s+/u)
		.map((part) => parseComparator(part))
	return comparators.length > 0 && comparators.every(Boolean) ? comparators : undefined
}

export function satisfiesNodeRange(version, range) {
	const current = parseNodeVersion(version)
	const comparators = parseNodeRange(range)
	if (!current || !comparators) {
		return false
	}
	return comparators.every((comparator) => matches(current, comparator))
}

export function assertNodeSupported({ current, range, subject }) {
	if (!satisfiesNodeRange(current, range)) {
		throw new Error(
			`${subject} requires Node.js ${range}; this process runs Node.js ${current}. ` +
				'Install a Node.js version in that range and run create-jst again.',
		)
	}
}

export function pinnedTemplateNodeRange({ example, template }) {
	const source = template ?? (example === 'showcase' ? SHOWCASE_SOURCE : TEMPLATE_SOURCE)
	return source === TEMPLATE_SOURCE || source === SHOWCASE_SOURCE ? TEMPLATE_NODE_RANGE : undefined
}

function parseComparator(part) {
	const match = COMPARATOR_PATTERN.exec(part)
	if (!match) {
		return undefined
	}
	return {
		operator: match[1] ?? '=',
		version: [Number(match[2]), Number(match[3] ?? 0), Number(match[4] ?? 0)],
	}
}

function parseNodeVersion(value) {
	const match = VERSION_PATTERN.exec(typeof value === 'string' ? value : '')
	return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined
}

function matches(version, comparator) {
	const order = difference(version, comparator.version)
	switch (comparator.operator) {
		case '<':
			return order < 0
		case '<=':
			return order <= 0
		case '>':
			return order > 0
		case '>=':
			return order >= 0
		default:
			return order === 0
	}
}

function difference(left, right) {
	return left[0] - right[0] || left[1] - right[1] || left[2] - right[2]
}
