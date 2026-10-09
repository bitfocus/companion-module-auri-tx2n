import { describe, expect, it, vi } from 'vitest'
import type {
	CompanionMigrationAction,
	CompanionMigrationFeedback,
	CompanionStaticUpgradeProps,
	CompanionUpgradeContext,
} from '@companion-module/base'
import { UpgradeScripts, numericActionOptionsApi2, numericFeedbackOptionsApi2 } from '../upgrades.js'
import { ActionId, UpdateActions } from '../actions.js'
import { FeedbackId, UpdateFeedbacks } from '../feedbacks.js'
import type ModuleInstance from '../main.js'
import type { Model, ModuleConfig } from '../config.js'

/**
 * Upgrade scripts are order-sensitive: a stored upgrade index records how far a configuration has been migrated,
 * so scripts may only ever be appended. Pin the index rather than taking the last entry, so appending a script
 * can't silently retarget this suite.
 */
const API2_NUMERIC_SCRIPT_INDEX = 0
const EXPECTED_SCRIPT_COUNT = 1

// Options reach upgrade scripts already wrapped as ExpressionOrValue — Companion does that before running them
const v = (value: unknown) => ({ isExpression: false, value })

function action(actionId: string, options: Record<string, unknown>): CompanionMigrationAction {
	return {
		id: `action-${actionId}`,
		controlId: 'bank-1',
		actionId,
		options: options as CompanionMigrationAction['options'],
	}
}

function feedback(feedbackId: string, options: Record<string, unknown>): CompanionMigrationFeedback {
	return {
		id: `feedback-${feedbackId}`,
		controlId: 'bank-1',
		feedbackId,
		options: options as CompanionMigrationFeedback['options'],
	}
}

function run(actions: CompanionMigrationAction[], feedbacks: CompanionMigrationFeedback[] = []) {
	return UpgradeScripts[API2_NUMERIC_SCRIPT_INDEX]({} as CompanionUpgradeContext<ModuleConfig>, {
		config: null,
		secrets: null,
		actions,
		feedbacks,
	} satisfies CompanionStaticUpgradeProps<ModuleConfig, undefined>)
}

describe('API 2.x numeric option upgrade script', () => {
	it('sits at the index this suite targets', () => {
		// Appending a script is fine — bump EXPECTED_SCRIPT_COUNT. Never insert, reorder or remove one.
		expect(UpgradeScripts).toHaveLength(EXPECTED_SCRIPT_COUNT)
	})

	it('converts a stored channel string to a number', () => {
		const existing = action(ActionId.RadioEncryption, { channel: v('2'), enable: v(true) })
		const result = run([existing])

		expect(result.updatedActions).toEqual([existing])
		expect(existing.options.channel).toEqual({ isExpression: false, value: 2 })
		expect(existing.options.enable).toEqual(v(true))
	})

	it('converts stream and input together, and a dock position', () => {
		const mute = action(ActionId.AudioStreamInputMute, { stream: v('1'), input: v('2'), mute: v(true) })
		const dock = action(ActionId.DockPrivKey, { position: v('17'), privKey: v('secret') })
		run([mute, dock])

		expect(mute.options.stream).toEqual({ isExpression: false, value: 1 })
		expect(mute.options.input).toEqual({ isExpression: false, value: 2 })
		expect(dock.options.position).toEqual({ isExpression: false, value: 17 })
	})

	it('turns a variable into an expression', () => {
		const existing = action(ActionId.TransmitterOutput, { channel: v('$(local:ch)'), enable: v(false) })
		run([existing])

		expect(existing.options.channel).toEqual({ isExpression: true, value: '$(local:ch)' })
	})

	it('wraps mixed text and variables in parseVariables', () => {
		const existing = action(ActionId.AudioStreamProgramInfo, { stream: v('$(internal:s)0'), pgmInfo: v('News') })
		run([existing])

		expect(existing.options.stream).toEqual({ isExpression: true, value: 'parseVariables("$(internal:s)0")' })
	})

	it('leaves text options alone, including ones that look like numbers', () => {
		const existing = action(ActionId.AudioStreamProgramInfo, { stream: v('1'), pgmInfo: v('1') })
		const name = action(ActionId.RadioEncryptionBroadcastName, { channel: v(1), name: v('42') })
		run([existing, name])

		expect(existing.options.pgmInfo).toEqual(v('1'))
		expect(name.options.name).toEqual(v('42'))
	})

	it('does not report actions it had nothing to convert', () => {
		const identify = action(ActionId.Identify, {})
		const alreadyNumber = action(ActionId.RadioEncryption, { channel: v(1), enable: v(true) })
		const alreadyExpression = action(ActionId.DockBroadcastName, {
			position: { isExpression: true, value: '1 + 1' },
			name: v(''),
		})
		const missingOption = action(ActionId.RadioEncryptionPrivacyKey, {})
		const result = run([identify, alreadyNumber, alreadyExpression, missingOption])

		expect(result.updatedActions).toEqual([])
		expect(alreadyExpression.options.position).toEqual({ isExpression: true, value: '1 + 1' })
	})

	it('converts the stream of the level feedbacks but leaves their L/R channel and bar position alone', () => {
		const level = feedback(FeedbackId.OutputLevel, { stream: v('2'), channel: v('R') })
		const meter = feedback(FeedbackId.LevelMeterAudioStreamOutput, {
			stream: v('1'),
			channel: v('L'),
			position: v('right'),
			padding: v(1),
		})
		const status = feedback(FeedbackId.SystemStatus, {})
		const result = run([], [level, meter, status])

		expect(result.updatedFeedbacks).toEqual([level, meter])
		expect(level.options.stream).toEqual({ isExpression: false, value: 2 })
		expect(level.options.channel).toEqual(v('R'))
		expect(meter.options.channel).toEqual(v('L'))
		expect(meter.options.position).toEqual(v('right'))
		expect(result.updatedConfig).toBeNull()
	})

	it('converts a dock position on a feedback', () => {
		const existing = feedback(FeedbackId.DockBroadcastName, { position: v('32') })
		run([], [existing])

		expect(existing.options.position).toEqual({ isExpression: false, value: 32 })
	})
})

type DefinitionLike = { options: { id: string; type: string }[] } | undefined

function definitionsFor(model: Model) {
	const setActionDefinitions = vi.fn<(defs: Record<string, DefinitionLike>) => void>()
	const setFeedbackDefinitions = vi.fn<(defs: Record<string, DefinitionLike>) => void>()
	const self = { setActionDefinitions, setFeedbackDefinitions } as unknown as ModuleInstance
	UpdateActions(self, model)
	UpdateFeedbacks(self, model)
	return { actions: setActionDefinitions.mock.calls[0][0], feedbacks: setFeedbackDefinitions.mock.calls[0][0] }
}

describe('upgrade maps match the current definitions', () => {
	const models: Model[] = ['TX2N', 'D4']
	const defs = Object.fromEntries(models.map((model) => [model, definitionsFor(model)]))

	// The script stores numbers, so each converted option must still be a number field
	const numericOptionIds = (def: DefinitionLike) => def?.options.filter((o) => o.type === 'number').map((o) => o.id)

	it.each(models)('%s sets every id in the enums, leaving the other model’s undefined', (model) => {
		expect(Object.keys(defs[model].actions).sort()).toEqual(Object.values(ActionId).sort())
		expect(Object.keys(defs[model].feedbacks).sort()).toEqual(Object.values(FeedbackId).sort())
	})

	it.each(Object.entries(numericActionOptionsApi2))('action %s: converted options are number fields', (id, keys) => {
		const def = models.map((model) => defs[model].actions[id]).find((d) => d !== undefined)
		expect(def).toBeDefined()
		expect(numericOptionIds(def)).toEqual(expect.arrayContaining(keys))
	})

	it.each(Object.entries(numericFeedbackOptionsApi2))(
		'feedback %s: converted options are number fields',
		(id, keys) => {
			const def = models.map((model) => defs[model].feedbacks[id]).find((d) => d !== undefined)
			expect(def).toBeDefined()
			expect(numericOptionIds(def)).toEqual(expect.arrayContaining(keys))
		},
	)
})
