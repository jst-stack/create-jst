export const COLOR_SCHEMES = ['light', 'dark', 'auto']
export const PRIMARY_COLORS = ['dark', 'gray', 'red', 'pink', 'grape', 'violet', 'indigo', 'blue', 'cyan', 'teal', 'green', 'lime', 'yellow', 'orange']
export const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun']
export const TEMPLATE_SOURCE = 'jst-stack/jst'

export function buildProjectSpecification(input) {
	const specification = Object.freeze({
		colorScheme: input.colorScheme ?? 'dark',
		description: input.description ?? `${input.title} web application.`,
		destination: input.destination,
		initGit: input.initGit ?? true,
		install: input.install ?? true,
		language: input.language ?? 'en',
		name: input.name,
		packageManager: input.packageManager ?? 'npm',
		primaryColor: input.primaryColor ?? 'lime',
		template: input.template ?? TEMPLATE_SOURCE,
		title: input.title,
	})
	validateProjectSpecification(specification)
	return specification
}

export function validateProjectSpecification(specification) {
	if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(specification.name) || specification.name.length > 214) {
		throw new Error(`Invalid npm package name: ${specification.name}`)
	}
	if (!specification.destination) throw new Error('Project destination is required.')
	if (!specification.title?.trim()) throw new Error('Application title is required.')
	if (!COLOR_SCHEMES.includes(specification.colorScheme)) throw new Error(`Colour scheme must be one of: ${COLOR_SCHEMES.join(', ')}.`)
	if (!PRIMARY_COLORS.includes(specification.primaryColor)) throw new Error(`Primary colour must be one of: ${PRIMARY_COLORS.join(', ')}.`)
	if (!PACKAGE_MANAGERS.includes(specification.packageManager)) throw new Error(`Package manager must be one of: ${PACKAGE_MANAGERS.join(', ')}.`)
}

export function normalizePackageName(value) {
	return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'jst-app'
}

export function toTitle(value) {
	return value.replace(/^@[^/]+\//, '').split(/[-_.]+/).filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(' ')
}
