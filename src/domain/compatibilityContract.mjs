import { satisfiesNodeRange } from './nodeContract.mjs'

export function parseTemplateSource(source) {
	const [repository, ref] = String(source).split('#')
	return repository && ref ? { ref, repository } : undefined
}

export function verifyCompatibility({ manifest, pin, published, templateNodeRange }) {
	return [
		...verifyTemplateTag(manifest, pin),
		...verifyRuntime(manifest, templateNodeRange),
		...verifyPackages(manifest, published),
	]
}

function verifyTemplateTag(manifest, pin) {
	const releaseTag = manifest?.template?.releaseTag ?? 'no release tag'
	return releaseTag === pin.ref
		? []
		: [`the compatibility manifest advertises ${releaseTag} while create-jst pins ${pin.ref}`]
}

function verifyRuntime(manifest, templateNodeRange) {
	const runtime = manifest?.runtime?.node ?? 'no Node.js range'
	return runtime === templateNodeRange
		? []
		: [`the manifest declares Node.js ${runtime} while create-jst enforces ${templateNodeRange}`]
}

function verifyPackages(manifest, published) {
	return Object.entries(manifest?.packages ?? {}).flatMap(([name, range]) => {
		const version = published?.[name]
		if (!version) {
			return [`no published version was resolved for ${name}`]
		}
		return satisfiesNodeRange(version, range)
			? []
			: [`${name}@${version} is outside the advertised range ${range}`]
	})
}
