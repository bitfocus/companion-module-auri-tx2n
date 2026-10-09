import type { CompanionVariableDefinitions } from '@companion-module/base'
import type ModuleInstance from './main.js'
import type { Model } from './config.js'

export type VariablesSchema = Record<string, never>

export function UpdateVariableDefinitions(self: ModuleInstance, model: Model): void {
	const variables: CompanionVariableDefinitions<VariablesSchema> = {}
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
