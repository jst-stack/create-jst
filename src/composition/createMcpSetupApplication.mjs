import { createMcpSetup } from '../application/mcpSetup.mjs'
import { createNodeMcpGateway } from '../infrastructure/nodeMcpGateway.mjs'

export function createMcpSetupApplication() {
	return createMcpSetup({ gateway: createNodeMcpGateway() })
}
