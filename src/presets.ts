import type ModuleInstance from './main.js'
import type { ModuleTypes } from './main.js'
import type {
	ButtonGraphicsCompositeElement,
	CompanionLayeredButtonPresetDefinition,
	CompanionPresetDefinitions,
	CompanionPresetGroupSimple,
	CompanionPresetSection,
} from '@companion-module/base'
import type { Model } from './config.js'
import type { OneOrTwo } from './api.js'
import {
	CompositeElementId,
	METER_OFFSET,
	METER_PADDING,
	METER_WIDTH,
	type CompositeElementSchema,
} from './composites.js'
import { FeedbackId, colors } from './feedbacks.js'
import type { BarPosition, LrChannel } from './options.js'
import { minValOption } from './options.js'

const STREAMS = [1, 2] as const satisfies OneOrTwo[]

export const MeterLayout = ['vertical', 'horizontal'] as const
export type MeterLayout = (typeof MeterLayout)[number]

export const meterPresetId = (stream: OneOrTwo, layout: MeterLayout): string => `stream${stream}_meter_${layout}`

/** The local variable each meter reads, driven by the Output Level value feedback for its channel */
export const levelVariable = (channel: LrChannel): string => `level_${channel.toLowerCase()}`

const FULL_BUTTON = { x: 0, y: 0, width: 100, height: 100 } as const

/** Percent of clear space kept between a meter and its neighbour, or the label */
const METER_GAP = 1

/** Padding that puts a bottom meter directly above one at METER_PADDING, METER_GAP apart */
const STACKED_PADDING = METER_PADDING + METER_WIDTH + METER_GAP

/** Inset that keeps the label clear of a meter on that edge */
const LABEL_INSET = METER_PADDING + METER_WIDTH + METER_GAP

type MeterPlacement = { position: BarPosition; padding: number }

/**
 * Where each layout puts the two meters, and the room left for the label.
 * - vertical: left up the left edge, right up the right edge, the label between them
 * - horizontal: both along the bottom, left stacked above right, the label above them
 */
const LAYOUTS = {
	vertical: {
		name: 'Vertical',
		meters: {
			L: { position: 'left', padding: METER_PADDING },
			R: { position: 'right', padding: METER_PADDING },
		},
		label: { x: LABEL_INSET, y: 0, width: 100 - 2 * LABEL_INSET, height: 100 },
	},
	horizontal: {
		name: 'Horizontal',
		meters: {
			L: { position: 'bottom', padding: STACKED_PADDING },
			R: { position: 'bottom', padding: METER_PADDING },
		},
		label: { x: 0, y: 0, width: 100, height: 100 - STACKED_PADDING - METER_WIDTH - METER_GAP },
	},
} as const satisfies Record<
	MeterLayout,
	{
		name: string
		meters: Record<LrChannel, MeterPlacement>
		label: { x: number; y: number; width: number; height: number }
	}
>

function meter(channel: LrChannel, placement: MeterPlacement): ButtonGraphicsCompositeElement<CompositeElementSchema> {
	return {
		type: 'composite',
		name: `${channel === 'L' ? 'Left' : 'Right'} Meter`,
		elementId: CompositeElementId.LevelMeter,
		...FULL_BUTTON,
		options: {
			level: { isExpression: true, value: `$(local:${levelVariable(channel)})` },
			position: placement.position,
			padding: placement.padding,
			offset: METER_OFFSET,
			width: METER_WIDTH,
			min: minValOption.default,
		},
	}
}

/**
 * A stream's left and right output levels as two meters, arranged as LAYOUTS describes, with the stream named in the
 * space left over. The levels come from the Output Level value feedback, which also starts the module metering while
 * the button is in use.
 */
function streamMeterPreset(stream: OneOrTwo, layout: MeterLayout): CompanionLayeredButtonPresetDefinition<ModuleTypes> {
	const { name, meters, label } = LAYOUTS[layout]
	return {
		type: 'layered',
		name: `Stream ${stream} Output Meter (${name})`,
		keywords: ['meter', 'level', 'output', 'stream', 'audio', layout],
		localVariables: (['L', 'R'] as const).map((channel) => ({
			variableType: 'feedback',
			variableName: levelVariable(channel),
			feedbackId: FeedbackId.OutputLevel,
			options: { stream, channel },
		})),
		elements: [
			{ type: 'box', name: 'Background', ...FULL_BUTTON, color: colors.black },
			{
				type: 'text',
				name: 'Label',
				...label,
				text: `Stream ${stream}`,
				fontsize: 22,
				fontsizeAllowShrink: true,
				color: colors.white,
				halign: 'center',
				valign: 'center',
			},
			meter('L', meters.L),
			meter('R', meters.R),
		],
		feedbacks: [],
		steps: [{ down: [], up: [] }],
	}
}

export function UpdatePresets(self: ModuleInstance, model: Model): void {
	const structure: CompanionPresetSection<ModuleTypes>[] = []
	const presets: CompanionPresetDefinitions<ModuleTypes> = {}
	switch (model) {
		case 'D4':
			break
		case 'TX2N':
			for (const layout of MeterLayout) {
				for (const stream of STREAMS) presets[meterPresetId(stream, layout)] = streamMeterPreset(stream, layout)
			}
			structure.push({
				id: 'output_meters',
				name: 'Output Meters',
				definitions: MeterLayout.map((layout): CompanionPresetGroupSimple<ModuleTypes> => ({
					id: `output_meters_${layout}`,
					type: 'simple',
					name: LAYOUTS[layout].name,
					presets: STREAMS.map((stream) => meterPresetId(stream, layout)),
				})),
			})
			break
		default:
			throw new Error(`Invalid model, no preset definitions: ${model}`)
	}

	self.setPresetDefinitions(structure, presets)
}
