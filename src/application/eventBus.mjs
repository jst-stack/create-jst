export function createEventBus() {
	const subscribers = new Set()
	return {
		publish(event) {
			for (const subscriber of subscribers) subscriber(event)
		},
		subscribe(subscriber) {
			subscribers.add(subscriber)
			return () => subscribers.delete(subscriber)
		},
	}
}
