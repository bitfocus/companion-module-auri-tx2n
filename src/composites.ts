import type {
	ButtonGraphicsGaugeElement,
	ButtonGraphicsGaugeStop,
	CompanionGraphicsCompositeElementDefinition,
	CompanionGraphicsCompositeElementDefinitions,
	CompanionInputFieldNumber,
} from '@companion-module/base'
import type ModuleInstance from './main.js'
import type { Model } from './config.js'
import { METER_BANDS, METER_MAX_DB, METER_UNLIT_ALPHA } from './feedbacks.js'
import * as Opts from './options.js'

/**
 * Composite graphics elements for layered buttons. The level meter draws what the deprecated Output Level Meter
 * advanced feedback draws as an image buffer.
 */
export enum CompositeElementId {
	LevelMeter = 'level_meter',
}

export type LevelMeterOptions = {
	level: number
	position: Opts.BarPosition
	padding: number
	offset: number
	width: number
	min: number
}

export type CompositeElementSchema = {
	[CompositeElementId.LevelMeter]: { options: LevelMeterOptions }
}

/**
 * The advanced feedback's defaults of 1, 5 and 6 px on a 72 px button, to the nearest percent. Composite children
 * are laid out in percentages of the composite's bounds, so these are percentages too.
 */
export const METER_PADDING = 1
export const METER_OFFSET = 7
export const METER_WIDTH = 8

const expr = (value: string) => ({ isExpression: true, value }) as const
const opt = (id: keyof LevelMeterOptions) => `$(options:${id})`

const POSITION = opt('position')
const PADDING = opt('padding')
const OFFSET = opt('offset')
const WIDTH = opt('width')
const MIN = opt('min')
const IS_VERTICAL = `(${POSITION} == 'left' || ${POSITION} == 'right')`

const percentField = <K extends string>(
	id: K,
	label: string,
	description: string,
	min: number,
	max: number,
	defaultValue: number,
): CompanionInputFieldNumber<K> => ({ type: 'number', id, label, description, min, max, default: defaultValue })

/**
 * A stop where each band starts, at its share of the way from min to METER_MAX_DB. Solid rather than gradient, so
 * every band is one colour as in the image.
 */
function bandStops(): ButtonGraphicsGaugeStop[] {
	let start = 0
	return METER_BANDS.map((band) => {
		const stop = {
			value: expr(`${MIN} + ${start / 100} * (${METER_MAX_DB} - ${MIN})`),
			color: band.color,
			gradient: false,
		}
		start += band.size
		return stop
	})
}

/**
 * One bar along the chosen edge, as calculateBarDimensions in feedbacks.ts places it: `padding` in from that edge,
 * `offset` in from both ends, `width` thick. Vertical bars fill from the bottom and horizontal ones from the left,
 * as the image does, and the unlit part keeps each band's colour at the image's background opacity.
 */
function levelMeterGauge(): ButtonGraphicsGaugeElement {
	return {
		type: 'gauge',
		name: 'Meter',
		x: expr(`${POSITION} == 'left' ? ${PADDING} : (${POSITION} == 'right' ? 100 - ${WIDTH} - ${PADDING} : ${OFFSET})`),
		y: expr(`${POSITION} == 'top' ? ${PADDING} : (${POSITION} == 'bottom' ? 100 - ${WIDTH} - ${PADDING} : ${OFFSET})`),
		width: expr(`${IS_VERTICAL} ? ${WIDTH} : 100 - 2 * ${OFFSET}`),
		height: expr(`${IS_VERTICAL} ? 100 - 2 * ${OFFSET} : ${WIDTH}`),
		orientation: expr(`${IS_VERTICAL} ? 'vertical' : 'horizontal'`),
		min: expr(MIN),
		max: METER_MAX_DB,
		value: expr(opt('level')),
		fillEnabled: true,
		multiColour: true,
		roundedEnds: false,
		markerEnabled: false,
		// 'transparent' draws the unlit track through a layer at trackAmount percent, which is the image's alpha
		trackStyle: 'transparent',
		trackAmount: (METER_UNLIT_ALPHA / 255) * 100,
		stops: bandStops(),
	}
}

function levelMeter(): CompanionGraphicsCompositeElementDefinition<
	CompositeElementSchema[CompositeElementId.LevelMeter]
> {
	return {
		type: 'composite',
		name: 'Level Meter',
		description:
			'A bar meter for an output level, from the minimum value up to 0 dB. Feed it a level, e.g. a local variable driven by the Audio Stream - Output Level feedback',
		options: [
			{
				type: 'number',
				id: 'level',
				label: 'Level (dB)',
				description: 'Set this to an output level, e.g. $(local:level)',
				min: -200,
				max: METER_MAX_DB,
				default: -200,
			},
			Opts.positionOption,
			percentField(
				'padding',
				'Padding (%)',
				'Distance from edge of button, perpendicular orientation',
				0,
				50,
				METER_PADDING,
			),
			percentField('offset', 'Offset (%)', 'Distance from edge of button, axial orientation', 0, 40, METER_OFFSET),
			percentField('width', 'Meter Width (%)', 'Thickness of the bar', 1, 30, METER_WIDTH),
			Opts.minValOption,
		],
		elements: [levelMeterGauge()],
	}
}

export function UpdateCompositeElements(self: ModuleInstance, model: Model): void {
	const compositeElements: CompanionGraphicsCompositeElementDefinitions<CompositeElementSchema> = {
		// Only the TX2N reports output levels for the meter to show
		[CompositeElementId.LevelMeter]: model === 'TX2N' ? levelMeter() : undefined,
	}
	self.setCompositeElementDefinitions(compositeElements)
}
