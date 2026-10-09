import { describe, expect, it, vi } from 'vitest'
import type {
	CompanionGraphicsCompositeElementDefinitions,
	CompanionPresetDefinitions,
	CompanionPresetSection,
} from '@companion-module/base'
import { UpdatePresets, levelVariable, meterPresetId } from '../presets.js'
import { CompositeElementId, METER_PADDING, METER_WIDTH, UpdateCompositeElements } from '../composites.js'
import type { CompositeElementSchema } from '../composites.js'
import { FeedbackId } from '../feedbacks.js'
import type ModuleInstance from '../main.js'
import type { ModuleTypes } from '../main.js'
import type { Model } from '../config.js'

function build(model: Model) {
	const setPresetDefinitions =
		vi.fn<
			(structure: CompanionPresetSection<ModuleTypes>[], presets: CompanionPresetDefinitions<ModuleTypes>) => void
		>()
	const setCompositeElementDefinitions =
		vi.fn<(defs: CompanionGraphicsCompositeElementDefinitions<CompositeElementSchema>) => void>()
	const self = { setPresetDefinitions, setCompositeElementDefinitions } as unknown as ModuleInstance
	UpdatePresets(self, model)
	UpdateCompositeElements(self, model)
	const [structure, presets] = setPresetDefinitions.mock.calls[0]
	return { structure, presets, composites: setCompositeElementDefinitions.mock.calls[0][0] }
}

function meterPreset(stream: 1 | 2) {
	const preset = build('TX2N').presets[meterPresetId(stream)]
	if (preset?.type !== 'layered') throw new Error(`stream ${stream} has no layered meter preset`)
	return preset
}

function placedMeters(stream: 1 | 2) {
	return meterPreset(stream).elements.flatMap((element) => (element.type === 'composite' ? [element] : []))
}

describe('output meter presets', () => {
	it('offers one per stream, in one section', () => {
		const { structure, presets } = build('TX2N')

		expect(Object.keys(presets).sort()).toEqual([meterPresetId(1), meterPresetId(2)])
		expect(structure).toEqual([expect.objectContaining({ definitions: [meterPresetId(1), meterPresetId(2)] })])
	})

	it.each([1, 2] as const)('stream %i drives a local variable per channel from the Output Level feedback', (stream) => {
		expect(meterPreset(stream).localVariables).toEqual([
			{
				variableType: 'feedback',
				variableName: levelVariable('L'),
				feedbackId: FeedbackId.OutputLevel,
				options: { stream, channel: 'L' },
			},
			{
				variableType: 'feedback',
				variableName: levelVariable('R'),
				feedbackId: FeedbackId.OutputLevel,
				options: { stream, channel: 'R' },
			},
		])
	})

	it.each([1, 2] as const)('stream %i shows left on the left edge and right on the right', (stream) => {
		const meters = placedMeters(stream)

		expect(meters).toHaveLength(2)
		expect(meters.map((meter) => [meter.elementId, meter.options.position, meter.options.level])).toEqual([
			[CompositeElementId.LevelMeter, 'left', { isExpression: true, value: `$(local:${levelVariable('L')})` }],
			[CompositeElementId.LevelMeter, 'right', { isExpression: true, value: `$(local:${levelVariable('R')})` }],
		])
	})

	it('places only composites the module defines, giving every option they take', () => {
		const { composites } = build('TX2N')
		for (const meter of placedMeters(1)) {
			const def = composites[meter.elementId]
			expect(def).toBeTruthy()
			if (!def) continue
			expect(Object.keys(meter.options).sort()).toEqual(def.options.map((option) => option.id).sort())
		}
	})

	it('reads only local variables it declares', () => {
		const preset = meterPreset(2)
		const declared = (preset.localVariables ?? []).map((variable) => variable.variableName)
		const read = [...JSON.stringify(preset.elements).matchAll(/\$\(local:(\w+)\)/g)].map((match) => match[1])

		expect(new Set(read)).toEqual(new Set(declared))
	})

	it('keeps the label clear of both meters', () => {
		const label = meterPreset(1).elements.find((element) => element.type === 'text')
		if (label?.type !== 'text') throw new Error('no label')
		const x = Number(label.x)
		const width = Number(label.width)

		expect(x).toBeGreaterThanOrEqual(METER_PADDING + METER_WIDTH)
		expect(x + width).toBeLessThanOrEqual(100 - METER_PADDING - METER_WIDTH)
		expect(label.text).toBe('Stream 1')
	})

	it('the D4 has none, having no output levels to show', () => {
		const { structure, presets } = build('D4')

		expect(structure).toEqual([])
		expect(presets).toEqual({})
	})
})
