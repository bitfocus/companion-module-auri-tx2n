import { describe, expect, it, vi } from 'vitest'
import type {
	ButtonGraphicsGaugeElement,
	CompanionGraphicsCompositeElementDefinitions,
	CompanionPresetDefinitions,
	CompanionPresetSection,
} from '@companion-module/base'
import { MeterLayout, UpdatePresets, levelVariable, meterPresetId } from '../presets.js'
import { CompositeElementId, METER_PADDING, UpdateCompositeElements } from '../composites.js'
import type { CompositeElementSchema } from '../composites.js'
import { FeedbackId } from '../feedbacks.js'
import type ModuleInstance from '../main.js'
import type { ModuleTypes } from '../main.js'
import type { Model } from '../config.js'
import { evaluate, gaugeBounds, num, type Bounds, type Options } from './graphics.js'

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

const STREAMS = [1, 2] as const
const EVERY_PRESET = MeterLayout.flatMap((layout) => STREAMS.map((stream) => ({ layout, stream })))

function meterPreset(stream: 1 | 2, layout: MeterLayout) {
	const preset = build('TX2N').presets[meterPresetId(stream, layout)]
	if (preset?.type !== 'layered') throw new Error(`stream ${stream} has no layered ${layout} meter preset`)
	return preset
}

function placedMeters(stream: 1 | 2, layout: MeterLayout) {
	return meterPreset(stream, layout).elements.flatMap((element) => (element.type === 'composite' ? [element] : []))
}

/**
 * Each placed meter's bar as it is drawn: the composite's own gauge, evaluated with the options the preset gives it,
 * in percentages of the button. The level is left as its expression, as it plays no part in where the bar goes.
 */
function drawnMeters(stream: 1 | 2, layout: MeterLayout) {
	const { composites } = build('TX2N')
	return placedMeters(stream, layout).map((meter) => {
		const def = composites[meter.elementId]
		const gauge = (def ? def.elements[0] : undefined) as ButtonGraphicsGaugeElement | undefined
		if (gauge?.type !== 'gauge') throw new Error(`${meter.elementId} draws no gauge`)
		const options: Options = Object.fromEntries(
			Object.entries(meter.options).map(([key, value]) => [
				key,
				typeof value === 'object' && value !== null && 'isExpression' in value ? value.value : value,
			]),
		)
		const placed = {
			x: num(meter.x, {}),
			y: num(meter.y, {}),
			width: num(meter.width, {}),
			height: num(meter.height, {}),
		}
		const bar = gaugeBounds(gauge, options)
		return {
			name: meter.name,
			orientation: evaluate(gauge.orientation, options),
			bounds: {
				x: placed.x + (bar.x / 100) * placed.width,
				y: placed.y + (bar.y / 100) * placed.height,
				width: (bar.width / 100) * placed.width,
				height: (bar.height / 100) * placed.height,
			},
		}
	})
}

function labelOf(stream: 1 | 2, layout: MeterLayout) {
	const label = meterPreset(stream, layout).elements.find((element) => element.type === 'text')
	if (label?.type !== 'text') throw new Error('no label')
	return {
		text: label.text,
		bounds: { x: num(label.x, {}), y: num(label.y, {}), width: num(label.width, {}), height: num(label.height, {}) },
	}
}

const overlaps = (a: Bounds, b: Bounds) =>
	a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

const bottom = (b: Bounds) => b.y + b.height

describe('output meter presets', () => {
	it('offers a vertical and a horizontal set, each one per stream, in one section', () => {
		const { structure, presets } = build('TX2N')

		expect(Object.keys(presets).sort()).toEqual(
			EVERY_PRESET.map(({ layout, stream }) => meterPresetId(stream, layout)).sort(),
		)
		expect(structure).toHaveLength(1)
		expect(structure[0].definitions).toEqual([
			expect.objectContaining({
				type: 'simple',
				name: 'Vertical',
				presets: [meterPresetId(1, 'vertical'), meterPresetId(2, 'vertical')],
			}),
			expect.objectContaining({
				type: 'simple',
				name: 'Horizontal',
				presets: [meterPresetId(1, 'horizontal'), meterPresetId(2, 'horizontal')],
			}),
		])
	})

	it.each(EVERY_PRESET)(
		'$layout stream $stream drives a local variable per channel from the Output Level feedback',
		({ layout, stream }) => {
			expect(meterPreset(stream, layout).localVariables).toEqual([
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
		},
	)

	it.each(EVERY_PRESET)('$layout stream $stream feeds each meter its own channel', ({ layout, stream }) => {
		expect(placedMeters(stream, layout).map((meter) => [meter.name, meter.options.level])).toEqual([
			['Left Meter', { isExpression: true, value: `$(local:${levelVariable('L')})` }],
			['Right Meter', { isExpression: true, value: `$(local:${levelVariable('R')})` }],
		])
	})

	it.each(MeterLayout)('%s: places only composites the module defines, giving every option they take', (layout) => {
		const { composites } = build('TX2N')
		const meters = placedMeters(1, layout)
		expect(meters).toHaveLength(2)
		for (const meter of meters) {
			expect(meter.elementId).toBe(CompositeElementId.LevelMeter)
			const def = composites[meter.elementId]
			expect(def).toBeTruthy()
			if (!def) continue
			expect(Object.keys(meter.options).sort()).toEqual(def.options.map((option) => option.id).sort())
		}
	})

	it.each(MeterLayout)('%s: reads only local variables it declares', (layout) => {
		const preset = meterPreset(2, layout)
		const declared = (preset.localVariables ?? []).map((variable) => variable.variableName)
		const read = [...JSON.stringify(preset.elements).matchAll(/\$\(local:(\w+)\)/g)].map((match) => match[1])

		expect(new Set(read)).toEqual(new Set(declared))
	})

	it.each(EVERY_PRESET)(
		'$layout stream $stream: meters and label stay on the button and clear of each other',
		({ layout, stream }) => {
			const [left, right] = drawnMeters(stream, layout).map((meter) => meter.bounds)
			const label = labelOf(stream, layout)

			for (const b of [left, right, label.bounds]) {
				expect(b.x).toBeGreaterThanOrEqual(0)
				expect(b.y).toBeGreaterThanOrEqual(0)
				expect(b.x + b.width).toBeLessThanOrEqual(100)
				expect(bottom(b)).toBeLessThanOrEqual(100)
			}
			expect(overlaps(left, right)).toBe(false)
			expect(overlaps(label.bounds, left)).toBe(false)
			expect(overlaps(label.bounds, right)).toBe(false)
			expect(label.text).toBe(`Stream ${stream}`)
		},
	)

	it('vertical: left up the left edge, right up the right edge', () => {
		const [left, right] = drawnMeters(1, 'vertical')

		expect([left.orientation, right.orientation]).toEqual(['vertical', 'vertical'])
		expect(left.bounds.x).toBeCloseTo(METER_PADDING)
		expect(right.bounds.x + right.bounds.width).toBeCloseTo(100 - METER_PADDING)
	})

	it('horizontal: both along the bottom, left stacked directly above right, the label above them', () => {
		const [left, right] = drawnMeters(1, 'horizontal')
		const label = labelOf(1, 'horizontal')

		expect([left.orientation, right.orientation]).toEqual(['horizontal', 'horizontal'])
		expect(bottom(right.bounds)).toBeCloseTo(100 - METER_PADDING)
		expect(bottom(left.bounds)).toBeLessThanOrEqual(right.bounds.y)
		expect(right.bounds.y - bottom(left.bounds)).toBeLessThanOrEqual(2)
		// Same length, lined up end to end
		expect(left.bounds.x).toBeCloseTo(right.bounds.x)
		expect(left.bounds.width).toBeCloseTo(right.bounds.width)
		expect(bottom(label.bounds)).toBeLessThanOrEqual(left.bounds.y)
	})

	it('the D4 has none, having no output levels to show', () => {
		const { structure, presets } = build('D4')

		expect(structure).toEqual([])
		expect(presets).toEqual({})
	})
})
