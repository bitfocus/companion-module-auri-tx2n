import {
	combineRgb,
	type CompanionAdvancedFeedbackDefinition,
	type CompanionAdvancedFeedbackResult,
	type CompanionFeedbackDefinitions,
} from '@companion-module/base'
import type ModuleInstance from './main.js'
import type { Model } from './config.js'
import * as API from './api.js'
import * as Opts from './options.js'
import { graphics } from 'companion-module-utils'

/**
 * Feedback ids. The values are the ids saved against every button using the feedback, so they must never change —
 * they predate this enum and are camelCase for that reason.
 */
export enum FeedbackId {
	SystemStatus = 'systemStatus',
	DockBroadcastName = 'dockBroadcastName',
	DockPrivKey = 'dockPrivKey',
	RadioEncryption = 'radioEncryption',
	TransmitterOutput = 'transmitterOutput',
	BroadcastName = 'broadcastName',
	PrivKey = 'privKey',
	ProgramInfo = 'programInfo',
	InputMute = 'inputMute',
	OutputLevel = 'outputLevel',
	LevelMeterAudioStreamOutput = 'levelMeterAudioStreamOutput',
}

type LevelMeterOptions = {
	stream: number
	channel: Opts.LrChannel
	position: Opts.BarPosition
	padding: number
	offset: number
	width: number
	min: number
}

export type FeedbackSchema = {
	[FeedbackId.SystemStatus]: { type: 'value'; options: Record<string, never>; result: number }
	[FeedbackId.DockBroadcastName]: { type: 'value'; options: { position: number }; result: string }
	[FeedbackId.DockPrivKey]: { type: 'value'; options: { position: number }; result: string }
	[FeedbackId.RadioEncryption]: { type: 'boolean'; options: { channel: number } }
	[FeedbackId.TransmitterOutput]: { type: 'boolean'; options: { channel: number } }
	[FeedbackId.BroadcastName]: { type: 'value'; options: { channel: number }; result: string }
	[FeedbackId.PrivKey]: { type: 'value'; options: { channel: number }; result: string }
	[FeedbackId.ProgramInfo]: { type: 'value'; options: { stream: number }; result: string }
	[FeedbackId.InputMute]: { type: 'boolean'; options: { stream: number; input: number } }
	[FeedbackId.OutputLevel]: { type: 'value'; options: { stream: number; channel: Opts.LrChannel }; result: number }
	[FeedbackId.LevelMeterAudioStreamOutput]: { type: 'advanced'; options: LevelMeterOptions }
}

/**
 * Sets every feedback the selected model doesn't offer to `undefined`, which is how Companion is told it isn't
 * available. The definitions type requires every key, so this also narrows away the `Partial`.
 */
function ensureAllFeedbackKeys(
	feedbacks: Partial<CompanionFeedbackDefinitions<FeedbackSchema>>,
): asserts feedbacks is CompanionFeedbackDefinitions<FeedbackSchema> {
	for (const id of Object.values(FeedbackId)) {
		if (!(id in feedbacks)) feedbacks[id] = undefined
	}
}

export const colors = {
	red: combineRgb(255, 0, 0),
	black: combineRgb(0, 0, 0),
	white: combineRgb(255, 255, 255),
	green: combineRgb(0, 204, 0),
	greenBright: combineRgb(0, 255, 0),
	yellow: combineRgb(255, 255, 0),
	amber: combineRgb(255, 191, 0),
}

const blackOnRead = {
	bgcolor: colors.red,
	color: colors.black,
}

/**
 * The level meter's colour bands, each a share of the bar's length from its quiet end. The deprecated advanced
 * feedback and the composite element both draw from these, so the two stay alike.
 */
export const METER_BANDS = [
	{ size: 50, color: colors.greenBright },
	{ size: 25, color: colors.yellow },
	{ size: 25, color: colors.red },
] as const

/** Alpha, 0 - 255, of the unlit part of the bar */
export const METER_UNLIT_ALPHA = 64

/** The top of the meter's scale in dB. Its floor is the `min` option */
export const METER_MAX_DB = 0

const valueToPercent = (value: number, min = 0, max = 100, invert = false): number => {
	if (typeof value == 'string') value = Number.parseFloat(value)
	const percent = ((value - min) / (max - min)) * 100
	const result = Number.isNaN(percent) || percent < 0 ? 0 : Math.round(percent)
	return invert ? 100 - result : result
}

/**
 * API 2.x only accepts advanced feedback images base64 encoded. companion-module-utils draws 32 bit ARGB, so say so
 * rather than leave Companion to guess.
 */
export function imageResult(buffer: Uint8Array): CompanionAdvancedFeedbackResult {
	return {
		imageBuffer: Buffer.from(buffer).toString('base64'),
		imageBufferEncoding: { pixelFormat: 'ARGB' },
	}
}

const calculateBarDimensions = (
	position: Opts.BarPosition,
	padding: number,
	offset: number,
	width: number,
	imageWidth: number,
	imageHeight: number,
) => {
	let ofsX1 = 0
	let ofsY1 = 0
	let bWidth = 0
	let bLength = 0

	switch (position) {
		case 'left':
			ofsX1 = padding
			ofsY1 = offset
			bWidth = width
			bLength = imageHeight - ofsY1 * 2
			break
		case 'right':
			ofsY1 = offset
			bWidth = width
			bLength = imageHeight - ofsY1 * 2
			ofsX1 = imageWidth - bWidth - padding
			break
		case 'top':
			ofsX1 = offset
			ofsY1 = padding
			bWidth = width
			bLength = imageWidth - ofsX1 * 2
			break
		case 'bottom':
			ofsX1 = offset
			bWidth = width
			ofsY1 = imageHeight - bWidth - padding
			bLength = imageWidth - ofsX1 * 2
			break
	}

	return { ofsX1, ofsY1, bWidth, bLength }
}

const createLevelMeterFeedback = (
	instance: ModuleInstance,
	name: string,
): CompanionAdvancedFeedbackDefinition<LevelMeterOptions> => ({
	name,
	description: 'Deprecated: use the Output Meter presets, or the Level Meter composite element, instead',
	type: 'advanced',
	affectedProperties: ['imageBuffer'],
	options: [
		Opts.streamOption,
		Opts.lrChanOption,
		Opts.positionOption,
		Opts.paddingOption,
		Opts.offsetOption,
		Opts.meterWidthOption,
		Opts.minValOption,
	],
	callback: (feedback) => {
		instance.subscribeMetering(feedback.id)
		if (!feedback.image) {
			instance.log('warn', `Feedback ${feedback.id} does not support images`)
			return {}
		}

		const opt = feedback.options
		const min = opt.min
		const max = METER_MAX_DB
		const streamNum = opt.stream
		if (!API.isOneOrTwo(streamNum)) throw new Error(`Invalid Stream Number: ${streamNum}`)
		const value = instance.device.audioStreams[streamNum].outputs[opt.channel]

		if (Number.isNaN(value) || value === undefined) throw new Error('Value is a NaN/Undefined')
		if (min >= max) {
			throw new Error(`Invalid min/max choices for level-meter.\n${JSON.stringify(opt)}`)
		}

		const position = opt.position

		const { ofsX1, ofsY1, bWidth, bLength } = calculateBarDimensions(
			position,
			opt.padding,
			opt.offset,
			opt.width,
			feedback.image.width,
			feedback.image.height,
		)

		const barColors: graphics.BarColor[] = METER_BANDS.map((band) => ({
			size: band.size,
			color: band.color,
			background: band.color,
			backgroundOpacity: METER_UNLIT_ALPHA,
		}))

		const options: graphics.OptionsBar = {
			width: feedback.image.width,
			height: feedback.image.height,
			colors: barColors,
			barLength: bLength,
			barWidth: bWidth,
			type: position == 'left' || position == 'right' ? 'vertical' : 'horizontal',
			value: valueToPercent(value, min, max, false),
			reverse: false,
			offsetX: ofsX1,
			offsetY: ofsY1,
			opacity: 255,
		}

		return imageResult(graphics.bar(options))
	},
	unsubscribe: (feedback) => {
		instance.unsubscribeMetering(feedback.id)
	},
})

export function UpdateFeedbacks(self: ModuleInstance, model: Model): void {
	const feedbacks: Partial<CompanionFeedbackDefinitions<FeedbackSchema>> = {}
	feedbacks[FeedbackId.SystemStatus] = {
		name: 'System Status',
		type: 'value',
		options: [],
		callback: (_feedback) => {
			return self.device.system.status
		},
	}
	switch (model) {
		case 'D4':
			feedbacks[FeedbackId.DockBroadcastName] = {
				name: 'Position - Broadcast Name',
				type: 'value',
				options: [Opts.dockPositionOption],
				callback: (feedback) => {
					const position = feedback.options.position
					if (!API.isOneToThirtyTwo(position)) throw new Error(`Invalid position - ${feedback.id}`)
					return self.device.dock[position]?.broadcastName ?? ''
				},
			}
			feedbacks[FeedbackId.DockPrivKey] = {
				name: 'Position - Privacy Key',
				type: 'value',
				options: [Opts.dockPositionOption],
				callback: (feedback) => {
					const position = feedback.options.position
					if (!API.isOneToThirtyTwo(position)) throw new Error(`Invalid position - ${feedback.id}`)
					return self.device.dock[position]?.privacyKey ?? ''
				},
			}
			break
		case 'TX2N':
			feedbacks[FeedbackId.RadioEncryption] = {
				name: 'Radio - Encryption',
				type: 'boolean',
				defaultStyle: blackOnRead,
				options: [Opts.rxChanOption],
				callback: (feedback) => {
					const channel = feedback.options.channel
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel - ${feedback.id}`)
					return self.device.radios[channel]?.encryption ?? false
				},
			}
			feedbacks[FeedbackId.TransmitterOutput] = {
				name: 'Radio - Transmitter Output',
				type: 'boolean',
				defaultStyle: blackOnRead,
				options: [Opts.rxChanOption],
				callback: (feedback) => {
					const channel = feedback.options.channel
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel - ${feedback.id}`)
					return self.device.radios[channel]?.transmitterOutput ?? false
				},
			}
			feedbacks[FeedbackId.BroadcastName] = {
				name: 'Radio - Broadcast Name',
				type: 'value',
				options: [Opts.rxChanOption],
				callback: (feedback) => {
					const channel = feedback.options.channel
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel - ${feedback.id}`)
					return self.device.radios[channel]?.broadcastName ?? ''
				},
			}
			feedbacks[FeedbackId.PrivKey] = {
				name: 'Radio - Privacy Key',
				type: 'value',
				options: [Opts.rxChanOption],
				callback: (feedback) => {
					const channel = feedback.options.channel
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel - ${feedback.id}`)
					return self.device.radios[channel]?.privacyKey ?? ''
				},
			}
			feedbacks[FeedbackId.ProgramInfo] = {
				name: 'Audio Stream - Program Info',
				type: 'value',
				options: [Opts.streamOption],
				callback: (feedback) => {
					const stream = feedback.options.stream
					if (!API.isOneOrTwo(stream)) throw new Error(`Invalid stream - ${feedback.id}`)
					return self.device.audioStreams[stream]?.programInfo ?? ''
				},
			}
			feedbacks[FeedbackId.InputMute] = {
				name: 'Audio Stream - Input Mute',
				type: 'boolean',
				defaultStyle: blackOnRead,
				options: [Opts.streamOption, Opts.inputChanOption],
				callback: (feedback) => {
					const { stream, input } = feedback.options
					if (!API.isOneOrTwo(stream)) throw new Error(`Invalid stream - ${feedback.id}`)
					if (!API.isOneOrTwo(input)) throw new Error(`Invalid input - ${feedback.id}`)
					return self.device.audioStreams[stream]?.inputs?.[input]?.mute ?? false
				},
			}
			feedbacks[FeedbackId.OutputLevel] = {
				name: 'Audio Stream - Output Level',
				type: 'value',
				options: [Opts.streamOption, Opts.lrChanOption],
				callback: (feedback) => {
					self.subscribeMetering(feedback.id)
					const { stream, channel } = feedback.options
					if (!API.isOneOrTwo(stream)) throw new Error(`Invalid stream - ${feedback.id}`)
					return self.device.audioStreams[stream]?.outputs[channel] ?? -100
				},
				unsubscribe: (feedback) => {
					self.unsubscribeMetering(feedback.id)
				},
			}
			feedbacks[FeedbackId.LevelMeterAudioStreamOutput] = createLevelMeterFeedback(
				self,
				'Audio Stream - Output Level Meter',
			)
			break
		default:
			throw new Error(`Invalid model, no feedback definitions: ${model}`)
	}

	ensureAllFeedbackKeys(feedbacks)
	self.setFeedbackDefinitions(feedbacks)
}
