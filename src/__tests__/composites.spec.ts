import { describe, expect, it, vi } from 'vitest'
import type {
	ButtonGraphicsGaugeElement,
	CompanionFeedbackCallbackContext,
	CompanionFeedbackDefinitions,
	CompanionGraphicsCompositeElementDefinitions,
} from '@companion-module/base'
import {
	CompositeElementId,
	METER_OFFSET,
	METER_PADDING,
	METER_WIDTH,
	UpdateCompositeElements,
	type CompositeElementSchema,
} from '../composites.js'
import { FeedbackId, METER_BANDS, UpdateFeedbacks, type FeedbackSchema } from '../feedbacks.js'
import type { BarPosition } from '../options.js'
import * as Opts from '../options.js'
import type ModuleInstance from '../main.js'
import type { Model } from '../config.js'
import type { DeviceState } from '../api.js'
import { evaluate, gaugeBounds, num, type Bounds, type Options } from './graphics.js'

/**
 * The deprecated Output Level Meter advanced feedback is the reference throughout: each test draws it at 72 px and
 * checks the composite's gauge against the pixels it produces.
 */
const ICON = 72
const pct = (px: number) => (px / ICON) * 100

type Layout = { position: BarPosition; padding: number; offset: number; width: number; min: number }

function composites(model: Model) {
	const setCompositeElementDefinitions =
		vi.fn<(defs: CompanionGraphicsCompositeElementDefinitions<CompositeElementSchema>) => void>()
	UpdateCompositeElements({ setCompositeElementDefinitions } as unknown as ModuleInstance, model)
	return setCompositeElementDefinitions.mock.calls[0][0]
}

function levelMeter() {
	const def = composites('TX2N')[CompositeElementId.LevelMeter]
	if (!def) throw new Error('TX2N should define the level meter')
	const gauge = def.elements[0] as ButtonGraphicsGaugeElement
	if (gauge.type !== 'gauge') throw new Error('the level meter should be a gauge')
	return { def, gauge }
}

/** The composite's options for a layout given in the advanced feedback's pixels */
const compositeOptions = (layout: Layout, level = -200): Options => ({
	level,
	position: layout.position,
	padding: pct(layout.padding),
	offset: pct(layout.offset),
	width: pct(layout.width),
	min: layout.min,
})

/** The gauge's bounds in px on a 72 px button, placed over the whole button */
function gaugePx(gauge: ButtonGraphicsGaugeElement, options: Options): Bounds {
	const { x, y, width, height } = gaugeBounds(gauge, options)
	return { x: (x / 100) * ICON, y: (y / 100) * ICON, width: (width / 100) * ICON, height: (height / 100) * ICON }
}

/** Draws the advanced feedback at 72 px, for the left channel of stream 1 at the given level */
async function oldImage(layout: Layout, level: number): Promise<Buffer> {
	const device = {
		audioStreams: { 1: { outputs: { L: level, R: -200 } } },
	} as unknown as DeviceState
	const setFeedbackDefinitions = vi.fn<(defs: CompanionFeedbackDefinitions<FeedbackSchema>) => void>()
	const self = { device, log: vi.fn(), subscribeMetering: vi.fn(), setFeedbackDefinitions }
	UpdateFeedbacks(self as unknown as ModuleInstance, 'TX2N')
	const meter = setFeedbackDefinitions.mock.calls[0][0][FeedbackId.LevelMeterAudioStreamOutput]
	if (!meter) throw new Error('TX2N should define the advanced level meter')
	const result = await meter.callback(
		{
			type: 'advanced',
			id: 'fb',
			controlId: 'bank',
			feedbackId: FeedbackId.LevelMeterAudioStreamOutput,
			options: { stream: 1, channel: 'L', ...layout },
			previousOptions: null,
			image: { width: ICON, height: ICON },
		},
		{ signal: new AbortController().signal } as CompanionFeedbackCallbackContext,
	)
	return Buffer.from(result.imageBuffer ?? '', 'base64')
}

/** ARGB bytes at (x, y) */
function pixel(pixels: Buffer, x: number, y: number): number[] {
	const offset = (y * ICON + x) * 4
	return [...pixels.subarray(offset, offset + 4)]
}

/** The bounding box of every pixel the image draws at all */
function drawnBounds(pixels: Buffer): Bounds {
	let minX = ICON
	let minY = ICON
	let maxX = -1
	let maxY = -1
	for (let y = 0; y < ICON; y++) {
		for (let x = 0; x < ICON; x++) {
			if (pixel(pixels, x, y)[0] === 0) continue
			minX = Math.min(minX, x)
			minY = Math.min(minY, y)
			maxX = Math.max(maxX, x)
			maxY = Math.max(maxY, y)
		}
	}
	return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

const isVertical = (position: BarPosition) => position === 'left' || position === 'right'

/** The pixels along the bar's centre line, from its quiet end (bottom, or left) to its loud end */
function alongBar(pixels: Buffer, bar: Bounds, position: BarPosition): number[][] {
	const length = isVertical(position) ? bar.height : bar.width
	return Array.from({ length }, (_, i) =>
		isVertical(position)
			? pixel(pixels, bar.x + Math.floor(bar.width / 2), bar.y + bar.height - 1 - i)
			: pixel(pixels, bar.x + i, bar.y + Math.floor(bar.height / 2)),
	)
}

const rgb = (color: number) => [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff]

const POSITIONS: BarPosition[] = ['left', 'right', 'top', 'bottom']
const DEFAULT_LAYOUT = { padding: 1, offset: 5, width: 6, min: -60 }

describe('Level Meter composite', () => {
	const { def, gauge } = levelMeter()

	it.each(
		POSITIONS.flatMap((position) => [
			{ position, ...DEFAULT_LAYOUT },
			{ position, padding: 4, offset: 10, width: 12, min: -60 },
		]),
	)('draws its bar where the advanced feedback does: $position, $padding/$offset/$width px', async (layout) => {
		const drawn = drawnBounds(await oldImage(layout, -200))
		const bounds = gaugePx(gauge, compositeOptions(layout))

		expect(bounds.x).toBeCloseTo(drawn.x)
		expect(bounds.y).toBeCloseTo(drawn.y)
		expect(bounds.width).toBeCloseTo(drawn.width)
		expect(bounds.height).toBeCloseTo(drawn.height)
		expect(evaluate(gauge.orientation, compositeOptions(layout))).toBe(
			isVertical(layout.position) ? 'vertical' : 'horizontal',
		)
	})

	it.each(['left', 'bottom'] as const)('fills from the same end as the advanced feedback (%s)', async (position) => {
		const layout = { position, ...DEFAULT_LAYOUT }
		const pixels = await oldImage(layout, -30)
		const bar = alongBar(pixels, drawnBounds(pixels), position)

		// Half full: lit (opaque) at the quiet end, unlit at the loud end. A gauge fills bottom up or left to right
		// unless reversed
		expect(bar[0][0]).toBe(255)
		expect(bar[bar.length - 1][0]).toBeLessThan(255)
		expect(evaluate(gauge.reverse, compositeOptions(layout))).toBeFalsy()
	})

	it.each([-200, -60, -45, -30, -17, -10, -1, 0])(
		'lights as much of the bar as the advanced feedback at %d dB',
		async (level) => {
			for (const position of ['left', 'bottom'] as const) {
				const layout = { position, ...DEFAULT_LAYOUT }
				const options = compositeOptions(layout, level)
				const pixels = await oldImage(layout, level)
				const bar = alongBar(pixels, drawnBounds(pixels), position)
				const lit = bar.filter((p) => p[0] === 255).length

				// Companion maps the value through min..max and clamps it to the track
				const min = num(gauge.min, options)
				const max = num(gauge.max, options)
				const fraction = Math.max(0, Math.min(1, (num(gauge.value, options) - min) / (max - min)))

				// The image rounds to a whole percent and then to a whole pixel; the gauge is continuous
				expect(Math.abs(fraction * bar.length - lit)).toBeLessThanOrEqual(1)
			}
		},
	)

	it.each([-60, -40, -100])('colours each band as the advanced feedback does, with min %d dB', async (min) => {
		const layout = { position: 'left' as const, ...DEFAULT_LAYOUT, min }
		const options = compositeOptions(layout, 0)
		const pixels = await oldImage(layout, 0)
		const bar = alongBar(pixels, drawnBounds(pixels), 'left')

		const stops = (gauge.stops ?? []).map((stop) => ({
			at: (num(stop.value, options) - min) / (0 - min),
			color: num(stop.color, options),
			gradient: evaluate(stop.gradient, options),
		}))
		// Each band starts its share of the way from min to the top of the scale, as the image's bands do. Exact, as a
		// bar is too few pixels to tell a boundary a percent or two out
		let start = 0
		const bandStarts = METER_BANDS.map((band) => {
			const at = start / 100
			start += band.size
			return at
		})
		expect(stops).toHaveLength(bandStarts.length)
		stops.forEach((stop, i) => {
			expect(stop.at).toBeCloseTo(bandStarts[i])
			expect(stop.gradient).toBe(false)
		})

		// Every pixel of the image clear of a band boundary has the colour of the gauge's band at that point
		bar.forEach((p, i) => {
			const from = i / bar.length
			const to = (i + 1) / bar.length
			if (stops.some((stop) => stop.at >= from && stop.at <= to)) return
			const band = stops.filter((stop) => stop.at <= (from + to) / 2).at(-1)
			expect(p.slice(1)).toEqual(rgb(band?.color ?? -1))
		})
	})

	it('draws the unlit bar at the advanced feedback’s alpha, the lit bar opaque', async () => {
		const layout = { position: 'left' as const, ...DEFAULT_LAYOUT }
		const silent = alongBar(await oldImage(layout, -200), drawnBounds(await oldImage(layout, -200)), 'left')
		const options = compositeOptions(layout)

		expect(evaluate(gauge.trackStyle, options)).toBe('transparent')
		expect(Math.round((num(gauge.trackAmount, options) / 100) * 255)).toBe(silent[0][0])
		expect(evaluate(gauge.fillEnabled, options)).toBe(true)
		expect(evaluate(gauge.multiColour, options)).toBe(true)
		expect(evaluate(gauge.markerEnabled, options)).toBe(false)
	})

	it('defaults to the advanced feedback’s layout, to within half a pixel', () => {
		const defaults = Object.fromEntries(
			def.options.map((option) => [option.id, 'default' in option ? option.default : undefined]),
		)

		expect(defaults).toMatchObject({ padding: METER_PADDING, offset: METER_OFFSET, width: METER_WIDTH })
		expect(Math.abs((METER_PADDING / 100) * ICON - Opts.paddingOption.default)).toBeLessThanOrEqual(0.5)
		expect(Math.abs((METER_OFFSET / 100) * ICON - Opts.offsetOption.default)).toBeLessThanOrEqual(0.5)
		expect(Math.abs((METER_WIDTH / 100) * ICON - Opts.meterWidthOption.default)).toBeLessThanOrEqual(0.5)
		expect(defaults.position).toBe(Opts.positionOption.default)
		expect(defaults.min).toBe(Opts.minValOption.default)
	})

	it('every option its elements read is defined', () => {
		const defined = def.options.map((option) => option.id)
		const read = [...JSON.stringify(def.elements).matchAll(/\$\(options:(\w+)\)/g)].map((match) => match[1])

		expect(new Set(read)).toEqual(new Set(defined))
	})
})

describe('composite definitions by model', () => {
	it('the D4 has no level meter, having no output levels to show', () => {
		expect(composites('D4')).toEqual({ [CompositeElementId.LevelMeter]: undefined })
	})
})
