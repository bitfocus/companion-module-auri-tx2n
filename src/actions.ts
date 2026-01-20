import { CompanionActionDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import type { Model } from './config.js'

export function UpdateActions(self: ModuleInstance, model: Model): void {
	const actions: CompanionActionDefinitions = {}
	switch (model) {
		case 'D4':
			break
		case 'TX2N':
			break
		default:
			throw new Error(`Invalid model, no action definitions: ${model}`)
	}
	self.setActionDefinitions(actions)
}
