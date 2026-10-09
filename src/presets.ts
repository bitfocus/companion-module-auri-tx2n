import type ModuleInstance from './main.js'
import type { ModuleTypes } from './main.js'
import type {
	ButtonGraphicsCompositeElement,
	CompanionLayeredButtonPresetDefinition,
	CompanionPresetDefinitions,
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

export const meterPresetId = (stream: OneOrTwo): string => `stream${stream}_meter`

/** The local variable each meter reads, driven by the Output Level value feedback for its channel */
export const levelVariable = (channel: LrChannel): string => `level_${channel.toLowerCase()}`

const FULL_BUTTON = { x: 0, y: 0, width: 100, height: 100 } as const

/** Leaves a percent clear of each meter, so a long label never runs under a bar */
const LABEL_INSET = METER_PADDING + METER_WIDTH + 1

function meter(channel: LrChannel, position: BarPosition): ButtonGraphicsCompositeElement<CompositeElementSchema> {
	return {
		type: 'composite',
		name: `${channel === 'L' ? 'Left' : 'Right'} Meter`,
		elementId: CompositeElementId.LevelMeter,
		...FULL_BUTTON,
		options: {
			level: { isExpression: true, value: `$(local:${levelVariable(channel)})` },
			position,
			padding: METER_PADDING,
			offset: METER_OFFSET,
			width: METER_WIDTH,
			min: minValOption.default,
		},
	}
}

/**
 * A stream's left and right output levels as meters up the left and right edges, with the stream named between them.
 * The levels come from the Output Level value feedback, which also starts the module metering while the button is
 * in use.
 */
function streamMeterPreset(stream: OneOrTwo): CompanionLayeredButtonPresetDefinition<ModuleTypes> {
	return {
		type: 'layered',
		name: `Stream ${stream} Output Meter`,
		keywords: ['meter', 'level', 'output', 'stream', 'audio'],
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
				x: LABEL_INSET,
				y: 0,
				width: 100 - 2 * LABEL_INSET,
				height: 100,
				text: `Stream ${stream}`,
				fontsize: 22,
				fontsizeAllowShrink: true,
				color: colors.white,
				halign: 'center',
				valign: 'center',
			},
			meter('L', 'left'),
			meter('R', 'right'),
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
			for (const stream of STREAMS) presets[meterPresetId(stream)] = streamMeterPreset(stream)
			structure.push({ id: 'output_meters', name: 'Output Meters', definitions: STREAMS.map(meterPresetId) })
			break
		default:
			throw new Error(`Invalid model, no preset definitions: ${model}`)
	}

	self.setPresetDefinitions(structure, presets)
}
