import { combineRgb, type CompanionFeedbackDefinitions, type CompanionFeedbackDefinition } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import type { Model } from './config.js'
import * as API from './api.js'
import * as Opts from './options.js'
import { graphics } from 'companion-module-utils'

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

const valueToPercent = (value: number, min = 0, max = 100, invert = false): number => {
	if (typeof value == 'string') value = Number.parseFloat(value)
	const percent = ((value - min) / (max - min)) * 100
	const result = Number.isNaN(percent) || percent < 0 ? 0 : Math.round(percent)
	return invert ? 100 - result : result
}

function intRangeLimiter(value: string, min: number, max: number): number {
	const num = Number.parseInt(value, 10)
	if (Number.isNaN(num)) return min
	return Math.min(Math.max(num, min), max)
}

const calculateBarDimensions = (
	position: string,
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

const createLevelMeterFeedback = (instance: ModuleInstance, name: string): CompanionFeedbackDefinition => ({
	name,
	type: 'advanced',
	options: [
		Opts.streamOption,
		Opts.lrChanOption,
		Opts.positionOption,
		Opts.paddingOption,
		Opts.offsetOption,
		Opts.meterWidthOption,
		Opts.minValOption,
	],
	callback: async (feedback, _context) => {
		if (!('image' in feedback) || feedback.image === undefined) {
			instance.log('warn', `Feedback ${feedback.id} does not support images}`)
			return {}
		}

		const opt = feedback.options
		const min = Number(opt.min)
		const max = 0
		const streamNum = intRangeLimiter(String(opt.stream), 1, 2)
		const channel = (opt.channel ?? 'L') as 'L' | 'R'
		if (!API.isOneOrTwo(streamNum)) throw new Error(`Invalid Stream Number: ${streamNum}`)
		const value = instance.device.audioStreams[streamNum].outputs[channel]

		if (Number.isNaN(value) || value === undefined) throw new Error('Value is a NaN/Undefined')
		if (min >= max) {
			throw new Error(`Invalid min/max choices for level-meter.\n${JSON.stringify(opt)}`)
		}

		const position = opt.position?.toString() ?? 'right'
		const padding = Number(opt.padding)
		const offset = Number(opt.offset)
		const width = Number(opt.width ?? 6)

		const { ofsX1, ofsY1, bWidth, bLength } = calculateBarDimensions(
			position,
			padding,
			offset,
			width,
			feedback.image.width,
			feedback.image.height,
		)

		const barColors: graphics.BarColor[] = [
			{ size: 50, color: colors.greenBright, background: colors.greenBright, backgroundOpacity: 64 },
			{ size: 25, color: colors.yellow, background: colors.yellow, backgroundOpacity: 64 },
			{ size: 25, color: colors.red, background: colors.red, backgroundOpacity: 64 },
		]

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

		instance.debug(`Feedback: ${JSON.stringify(feedback)}\n Bar Options: ${JSON.stringify(options)}`)
		return {
			imageBuffer: graphics.bar(options),
		}
	},
})

export function UpdateFeedbacks(self: ModuleInstance, model: Model): void {
	const feedbacks: CompanionFeedbackDefinitions = {}
	feedbacks.systemStatus = {
		name: 'System Status',
		type: 'value',
		options: [],
		callback: (_feedback) => {
			return self.device.system.status
		},
	}
	switch (model) {
		case 'D4':
			feedbacks.dockBroadcastName = {
				name: 'Position - Broadcast Name',
				type: 'value',
				options: [Opts.dockPositionOption],
				callback: (feedback) => {
					const position = Number.parseInt(feedback.options?.position?.toString() ?? '1')
					if (!API.isOneToThirtyTwo(position)) throw new Error(`Invalid position - ${feedback.id}`)
					return self.device.dock[position]?.broadcastName ?? ''
				},
			}
			feedbacks.dockPrivKey = {
				name: 'Position - Privacy Key',
				type: 'value',
				options: [Opts.dockPositionOption],
				callback: (feedback) => {
					const position = Number.parseInt(feedback.options?.position?.toString() ?? '1')
					if (!API.isOneToThirtyTwo(position)) throw new Error(`Invalid position - ${feedback.id}`)
					return self.device.dock[position]?.privacyKey ?? ''
				},
			}
			break
		case 'TX2N':
			feedbacks.radioEncryption = {
				name: 'Radio - Encryption',
				type: 'boolean',
				defaultStyle: blackOnRead,
				options: [Opts.rxChanOption],
				callback: (feedback) => {
					const channel = Number.parseInt(feedback.options?.channel?.toString() ?? '1')
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel - ${feedback.id}`)
					return self.device.radios[channel]?.encryption ?? false
				},
			}
			feedbacks.transmitterOutput = {
				name: 'Radio - Transmitter Output',
				type: 'boolean',
				defaultStyle: blackOnRead,
				options: [Opts.rxChanOption],
				callback: (feedback) => {
					const channel = Number.parseInt(feedback.options?.channel?.toString() ?? '1')
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel - ${feedback.id}`)
					return self.device.radios[channel]?.transmitterOutput ?? false
				},
			}
			feedbacks.broadcastName = {
				name: 'Radio - Broadcast Name',
				type: 'value',
				options: [Opts.rxChanOption],
				callback: (feedback) => {
					const channel = Number.parseInt(feedback.options?.channel?.toString() ?? '1')
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel - ${feedback.id}`)
					return self.device.radios[channel]?.broadcastName ?? ''
				},
			}
			feedbacks.privKey = {
				name: 'Radio - Privacy Key',
				type: 'value',
				options: [Opts.rxChanOption],
				callback: (feedback) => {
					const channel = Number.parseInt(feedback.options?.channel?.toString() ?? '1')
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel - ${feedback.id}`)
					return self.device.radios[channel]?.privacyKey ?? ''
				},
			}
			feedbacks.programInfo = {
				name: 'Audio Stream - Program Info',
				type: 'value',
				options: [Opts.streamOption],
				callback: (feedback) => {
					const stream = Number.parseInt(feedback.options?.stream?.toString() ?? '1')
					if (!API.isOneOrTwo(stream)) throw new Error(`Invalid stream - ${feedback.id}`)
					return self.device.audioStreams[stream]?.programInfo ?? ''
				},
			}
			feedbacks.inputMute = {
				name: 'Audio Stream - Input Mute',
				type: 'boolean',
				defaultStyle: blackOnRead,
				options: [Opts.streamOption, Opts.inputChanOption],
				callback: (feedback) => {
					const stream = Number.parseInt(feedback.options?.stream?.toString() ?? '1')
					const input = Number.parseInt(feedback.options?.input?.toString() ?? '1')
					if (!API.isOneOrTwo(stream)) throw new Error(`Invalid stream - ${feedback.id}`)
					if (!API.isOneOrTwo(input)) throw new Error(`Invalid input - ${feedback.id}`)
					return self.device.audioStreams[stream]?.inputs?.[input]?.mute ?? false
				},
			}
			feedbacks.outputLevel = {
				name: 'Audio Stream - Output Level',
				type: 'value',
				options: [Opts.streamOption, Opts.lrChanOption],
				callback: (feedback) => {
					const channel = feedback.options?.channel?.toString() ?? 'L'
					const stream = Number.parseInt(feedback.options?.stream?.toString() ?? '1')
					if (!API.isOneOrTwo(stream)) throw new Error(`Invalid stream - ${feedback.id}`)
					const output = self.device.audioStreams[stream]?.outputs
					if (output) {
						if (channel === 'L' || channel === 'R') {
							return output[channel]
						}
					}
					return -100
				},
				subscribe: () => {
					self.startMetering().catch(() => {})
				},
			}
			feedbacks.levelMeterDspOutput = createLevelMeterFeedback(self, 'Audio Stream - Output Level Meter')
			break
		default:
			throw new Error(`Invalid model, no feedback definitions: ${model}`)
	}

	self.setFeedbackDefinitions(feedbacks)
}
