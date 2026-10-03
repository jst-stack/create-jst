import degit from 'degit'
import { cp } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'

export function createDegitTemplateGateway() {
	return {
		clone(source, destination) {
			if (isAbsolute(source) || source.startsWith('.')) {
				return cp(resolve(source), destination, { recursive: true })
			}
			return degit(source, { disableCache: true, force: false, verbose: false }).clone(destination)
		},
	}
}
