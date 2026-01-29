import { combineRgb, CompanionFeedbackDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import type { Model } from './config.js'
import * as API from './api.js'

const blackOnRead = {
	bgcolor: combineRgb(255, 0, 0),
	color: combineRgb(0, 0, 0),
}

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
				options: [
					{
						type: 'textinput',
						id: 'position',
						label: 'Position',
						default: '1',
						useVariables: { local: true },
						description: '1 to 32',
					},
				],
				callback: (feedback) => {
					const position = Number.parseInt(feedback.options?.position?.toString() ?? '1')
					if (!API.isOneToThirtyTwo(position)) throw new Error(`Invalid position - ${feedback.id}`)
					return self.device.dock[position]?.broadcastName ?? ''
				},
			}
			feedbacks.dockPrivKey = {
				name: 'Position - Privacy Key',
				type: 'value',
				options: [
					{
						type: 'textinput',
						id: 'position',
						label: 'Position',
						default: '1',
						useVariables: { local: true },
						description: '1 to 32',
					},
				],
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
				options: [
					{
						type: 'textinput',
						id: 'channel',
						label: 'Channel',
						default: '1',
						useVariables: { local: true },
						description: '1 or 2',
					},
				],
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
				options: [
					{
						type: 'textinput',
						id: 'channel',
						label: 'Channel',
						default: '1',
						useVariables: { local: true },
						description: '1 or 2',
					},
				],
				callback: (feedback) => {
					const channel = Number.parseInt(feedback.options?.channel?.toString() ?? '1')
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel - ${feedback.id}`)
					return self.device.radios[channel]?.transmitterOutput ?? false
				},
			}
			feedbacks.broadcastName = {
				name: 'Radio - Broadcast Name',
				type: 'value',
				options: [
					{
						type: 'textinput',
						id: 'channel',
						label: 'Channel',
						default: '1',
						useVariables: { local: true },
						description: '1 or 2',
					},
				],
				callback: (feedback) => {
					const channel = Number.parseInt(feedback.options?.channel?.toString() ?? '1')
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel - ${feedback.id}`)
					return self.device.radios[channel]?.broadcastName ?? ''
				},
			}
			feedbacks.privKey = {
				name: 'Radio - Privacy Key',
				type: 'value',
				options: [
					{
						type: 'textinput',
						id: 'channel',
						label: 'Channel',
						default: '1',
						useVariables: { local: true },
						description: '1 or 2',
					},
				],
				callback: (feedback) => {
					const channel = Number.parseInt(feedback.options?.channel?.toString() ?? '1')
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel - ${feedback.id}`)
					return self.device.radios[channel]?.privacyKey ?? ''
				},
			}
			feedbacks.programInfo = {
				name: 'Audio Stream - Program Info',
				type: 'value',
				options: [
					{
						type: 'textinput',
						id: 'stream',
						label: 'Stream',
						default: '1',
						useVariables: { local: true },
						description: '1 or 2',
					},
				],
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
				options: [
					{
						type: 'textinput',
						id: 'stream',
						label: 'Stream',
						default: '1',
						useVariables: { local: true },
						description: '1 or 2',
					},
					{
						type: 'textinput',
						id: 'input',
						label: 'Input',
						default: '1',
						useVariables: { local: true },
						description: '1 or 2',
					},
				],
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
				options: [
					{
						type: 'textinput',
						id: 'stream',
						label: 'Stream',
						default: '1',
						useVariables: { local: true },
						description: '1 or 2',
					},
					{
						type: 'dropdown',
						id: 'channel',
						label: 'Channel',
						default: 'L',
						choices: [
							{ id: 'L', label: 'Left' },
							{ id: 'R', label: 'Right' },
						],
					},
				],
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
			break
		default:
			throw new Error(`Invalid model, no feedback definitions: ${model}`)
	}

	self.setFeedbackDefinitions(feedbacks)
}
