import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import type { Model } from './config.js'

export function UpdateFeedbacks(self: ModuleInstance, model: Model): void {
	const feedbacks: CompanionFeedbackDefinitions = {}
	switch (model) {
		case 'D4':
			break
		case 'TX2N':
			break
		default:
			throw new Error(`Invalid model, no feedback definitions: ${model}`)
	}

	self.setFeedbackDefinitions(feedbacks)
}
