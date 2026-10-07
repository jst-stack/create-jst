export const COLOR_SCHEMES = ['light', 'dark', 'auto']
export const PRIMARY_COLORS = ['dark', 'gray', 'red', 'pink', 'grape', 'violet', 'indigo', 'blue', 'cyan', 'teal', 'green', 'lime', 'yellow', 'orange']
export const PACKAGE_MANAGERS = ['npm', 'pnpm']
export const STYLE_LANGUAGES = ['css', 'scss']
export const EXAMPLES = ['clean', 'showcase']
export const TEMPLATE_SOURCE = 'jst-stack/jst#v0.4.12'
export const SHOWCASE_SOURCE = 'jst-stack/jst-showcase#0956075b116abc85d0ad9aacc2f964d0d2672968'

export function buildProjectSpecification(input) {
	const specification = Object.freeze({
		colorScheme: input.colorScheme ?? 'dark',
		description: input.description ?? `${input.title} web application.`,
		destination: input.destination,
		example: input.example ?? 'clean',
		initGit: input.initGit ?? true,
		install: input.install ?? true,
		language: input.language ?? 'en',
		name: input.name,
		packageManager: input.packageManager ?? 'npm',
		primaryColor: input.primaryColor ?? 'lime',
		style: input.style ?? 'css',
		template: input.template ?? (input.example === 'showcase' ? SHOWCASE_SOURCE : TEMPLATE_SOURCE),
		title: input.title,
	})
	validateProjectSpecification(specification)
	return specification
}

export function validateProjectSpecification(specification) {
	if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(specification.name) || specification.name.length > 214) {
		throw new Error(`Invalid npm package name: ${specification.name}`)
	}
	if (!specification.destination) {
		throw new Error('Project destination is required.')
	}
	if (!specification.title?.trim()) {
		throw new Error('Application title is required.')
	}
	if (!COLOR_SCHEMES.includes(specification.colorScheme)) {
		throw new Error(`Colour scheme must be one of: ${COLOR_SCHEMES.join(', ')}.`)
	}
	if (!PRIMARY_COLORS.includes(specification.primaryColor)) {
		throw new Error(`Primary colour must be one of: ${PRIMARY_COLORS.join(', ')}.`)
	}
	if (!EXAMPLES.includes(specification.example)) {
		throw new Error(`Example must be one of: ${EXAMPLES.join(', ')}.`)
	}
	if (!PACKAGE_MANAGERS.includes(specification.packageManager)) {
		throw new Error(`Package manager must be one of: ${PACKAGE_MANAGERS.join(', ')}.`)
	}
	if (!STYLE_LANGUAGES.includes(specification.style)) {
		throw new Error(`Style language must be one of: ${STYLE_LANGUAGES.join(', ')}.`)
	}
}

export function normalizePackageName(value) {
	return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'jst-app'
}

export function toTitle(value) {
	return value.replace(/^@[^/]+\//, '').split(/[-_.]+/).filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(' ')
}
