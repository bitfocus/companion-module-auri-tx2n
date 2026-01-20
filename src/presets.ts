import type { ModuleInstance } from './main.js'
import { CompanionPresetDefinitions } from '@companion-module/base'
import type { Model } from './config.js'

export function UpdatePresets(self: ModuleInstance, model: Model): void {
	const presets: CompanionPresetDefinitions = {}
	switch (model) {
		case 'D4':
			break
		case 'TX2N':
			break
		default:
			throw new Error(`Invalid model, no preset definitions: ${model}`)
	}

	self.setPresetDefinitions(presets)
}
