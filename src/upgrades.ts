import {
	FixupNumericOrVariablesValueToExpressions,
	type CompanionMigrationAction,
	type CompanionMigrationFeedback,
	type CompanionStaticUpgradeProps,
	type CompanionStaticUpgradeResult,
	type CompanionStaticUpgradeScript,
	type CompanionUpgradeContext,
} from '@companion-module/base'
import type { ModuleConfig } from './config.js'
import { ActionId } from './actions.js'
import { FeedbackId } from './feedbacks.js'

/**
 * Options that were `textinput`s holding a number (or a variable) before the API 2.x migration, and are `number`
 * fields since. Frozen history for UpgradeScripts[0]: do not edit to track later changes, add a new script instead.
 */
export const numericActionOptionsApi2: Partial<Record<ActionId, string[]>> = {
	[ActionId.DockBroadcastName]: ['position'],
	[ActionId.DockPrivKey]: ['position'],
	[ActionId.RadioEncryption]: ['channel'],
	[ActionId.RadioEncryptionBroadcastName]: ['channel'],
	[ActionId.RadioEncryptionPrivacyKey]: ['channel'],
	[ActionId.TransmitterOutput]: ['channel'],
	[ActionId.AudioStreamInputMute]: ['stream', 'input'],
	[ActionId.AudioStreamProgramInfo]: ['stream'],
}

/**
 * As {@link numericActionOptionsApi2}, for feedbacks. The level feedbacks' `channel` and the meter's `position` are
 * dropdowns, unrelated to the numeric options of the same names elsewhere, so they are not listed.
 */
export const numericFeedbackOptionsApi2: Partial<Record<FeedbackId, string[]>> = {
	[FeedbackId.DockBroadcastName]: ['position'],
	[FeedbackId.DockPrivKey]: ['position'],
	[FeedbackId.RadioEncryption]: ['channel'],
	[FeedbackId.TransmitterOutput]: ['channel'],
	[FeedbackId.BroadcastName]: ['channel'],
	[FeedbackId.PrivKey]: ['channel'],
	[FeedbackId.ProgramInfo]: ['stream'],
	[FeedbackId.InputMute]: ['stream', 'input'],
	[FeedbackId.OutputLevel]: ['stream'],
	[FeedbackId.LevelMeterAudioStreamOutput]: ['stream'],
}

/**
 * Converts the listed options in place. Returns whether anything changed — the helper always hands back a fresh
 * object, so compare contents rather than identity, or every untouched action would be reported as updated.
 */
function fixupNumericOptions(item: CompanionMigrationAction | CompanionMigrationFeedback, keys?: string[]): boolean {
	if (!keys) return false
	let changed = false
	for (const key of keys) {
		const current = item.options[key]
		const fixed = FixupNumericOrVariablesValueToExpressions(current)
		if (fixed?.isExpression !== current?.isExpression || fixed?.value !== current?.value) {
			item.options[key] = fixed
			changed = true
		}
	}
	return changed
}

export const UpgradeScripts: CompanionStaticUpgradeScript<ModuleConfig>[] = [
	/*
	 * Place your upgrade scripts here
	 * Remember that once it has been added it cannot be removed!
	 */

	// 0: API 2.x — numeric textinputs (stream, channel, input, dock position) became number fields.
	// "2" becomes 2, "$(local:ch)" becomes an expression, anything else is wrapped in parseVariables().
	function (
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig, undefined>,
	): CompanionStaticUpgradeResult<ModuleConfig, undefined> {
		return {
			updatedConfig: null,
			updatedActions: props.actions.filter((action) =>
				fixupNumericOptions(action, numericActionOptionsApi2[action.actionId as ActionId]),
			),
			updatedFeedbacks: props.feedbacks.filter((feedback) =>
				fixupNumericOptions(feedback, numericFeedbackOptionsApi2[feedback.feedbackId as FeedbackId]),
			),
		}
	},
]
