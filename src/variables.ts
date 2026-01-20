import { CompanionVariableDefinition } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import type { Model } from './config.js'

export function UpdateVariableDefinitions(self: ModuleInstance, model: Model): void {
	const variables: CompanionVariableDefinition[] = []
	switch (model) {
		case 'D4':
			break
		case 'TX2N':
			break
		default:
			throw new Error(`Invalid model, no variable definitions: ${model}`)
	}
	self.setVariableDefinitions(variables)
}
