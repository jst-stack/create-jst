import degit from 'degit'

export function createDegitTemplateGateway() {
	return {
		clone(source, destination) {
			return degit(source, { disableCache: true, force: false, verbose: false }).clone(destination)
		},
	}
}
