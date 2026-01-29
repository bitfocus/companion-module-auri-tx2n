import { CompanionActionDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import type { Model } from './config.js'
import * as API from './api.js'

// Helper functions
function ensureRadioExists(device: API.DeviceState, channel: number): void {
	if (!device.radios[channel]) {
		device.radios[channel] = {
			encryption: false,
			broadcastName: '',
			privacyKey: '',
			transmitterOutput: false,
		}
	}
}

function ensureAudioStreamExists(device: API.DeviceState, stream: number): void {
	if (!device.audioStreams[stream]) {
		device.audioStreams[stream] = {
			programInfo: '',
			inputs: {
				1: { mute: false },
				2: { mute: false },
			},
			outputs: {
				L: -200,
				R: -200,
			},
		}
	}
}

function ensureAudioStreamInputExists(device: API.DeviceState, stream: number, input: number): void {
	ensureAudioStreamExists(device, stream)
	if (!device.audioStreams[stream].inputs[input]) {
		device.audioStreams[stream].inputs[input] = { mute: false }
	}
}

function ensureDockPositionExists(device: API.DeviceState, position: number): void {
	if (!device.dock[position]) {
		device.dock[position] = { broadcastName: '', privacyKey: '' }
	}
}

export function UpdateActions(self: ModuleInstance, model: Model): void {
	const actions: CompanionActionDefinitions = {}

	actions.identify = {
		name: 'Identify',
		options: [],
		callback: async (__action) => {
			const msg = API.TX2N.Set.SystemIdentify()
			await self.send(msg, 1)
		},
	}

	switch (model) {
		case 'D4':
			actions.dockBroadcastName = {
				name: 'Position - Broadcast Name',
				options: [
					{
						type: 'textinput',
						id: 'position',
						label: 'Position',
						default: '1',
						useVariables: { local: true },
						description: '1 to 32',
					},
					{
						type: 'textinput',
						id: 'name',
						label: 'Name',
						default: '',
						useVariables: { local: true },
						description: '32 Characters max',
					},
				],
				callback: async (action) => {
					const position = Number.parseInt(action.options.position?.toString() ?? '1')
					const name = action.options.name?.toString() ?? ''
					if (!API.isOneToThirtyTwo(position)) throw new Error(`Invalid position ${position}`)

					const msg = API.D4.Set.SetDockEncryptionBroadcastName(position, name)
					const bcName = API.DockEncryptionBroadcastName(await self.send(msg, 1))

					ensureDockPositionExists(self.device, bcName.position)
					self.device.dock[bcName.position].broadcastName = bcName.name
					self.checkFeedbacks('dockBroadcastName')
				},
			}

			actions.dockPrivKey = {
				name: 'Position - Privacy Key',
				options: [
					{
						type: 'textinput',
						id: 'position',
						label: 'Position',
						default: '1',
						useVariables: { local: true },
						description: '1 to 32',
					},
					{
						type: 'textinput',
						id: 'privKey',
						label: 'Privacy Key',
						default: '',
						useVariables: { local: true },
						description: '32 Characters max',
					},
				],
				callback: async (action) => {
					const position = Number.parseInt(action.options.position?.toString() ?? '1')
					const privKey = action.options.privKey?.toString() ?? ''
					if (!API.isOneToThirtyTwo(position)) throw new Error(`Invalid position ${position}`)

					const msg = API.D4.Set.SetDockEncryptionPrivacyKey(position, privKey)
					const posPrivKey = API.DockEncryptionPrivacyKey(await self.send(msg, 1))

					ensureDockPositionExists(self.device, posPrivKey.position)
					self.device.dock[posPrivKey.position].privacyKey = posPrivKey.key
					self.checkFeedbacks('dockPrivKey')
				},
			}
			break

		case 'TX2N':
			actions.radioEncryption = {
				name: 'Radio - Encryption',
				options: [
					{
						type: 'textinput',
						id: 'channel',
						label: 'Channel',
						default: '1',
						useVariables: { local: true },
						description: '1 to 2',
					},
					{
						type: 'checkbox',
						id: 'enable',
						label: 'Enable',
						default: true,
					},
				],
				callback: async (action) => {
					const channel = Number.parseInt(action.options.channel?.toString() ?? '1')
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel ${channel}`)

					const msg = API.TX2N.Set.RadioEncryption(channel, action.options.enable ? 'ON' : 'OFF')
					const rxEncrypt = API.RadioEncryption(await self.send(msg, 1))

					ensureRadioExists(self.device, rxEncrypt.ch)
					self.device.radios[rxEncrypt.ch].encryption = rxEncrypt.encryption
					self.checkFeedbacks('radioEncryption')
				},
			}

			actions.radioEncryptionBroadcastName = {
				name: 'Radio - Broadcast Name',
				options: [
					{
						type: 'textinput',
						id: 'channel',
						label: 'Channel',
						default: '1',
						useVariables: { local: true },
						description: '1 to 2',
					},
					{
						type: 'textinput',
						id: 'name',
						label: 'Name',
						default: '',
						useVariables: { local: true },
						description: '32 Characters max',
					},
				],
				callback: async (action) => {
					const channel = Number.parseInt(action.options.channel?.toString() ?? '1')
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel ${channel}`)

					const msg = API.TX2N.Set.RadioEncryptionBroadcastName(channel, action.options.name?.toString() ?? '')
					const rxBcName = API.RadioEncryptionBroadcastName(await self.send(msg, 1))

					ensureRadioExists(self.device, rxBcName.chan)
					self.device.radios[rxBcName.chan].broadcastName = rxBcName.name
					self.checkFeedbacks('broadcastName')
				},
			}

			actions.radioEncryptionPrivacyKey = {
				name: 'Radio - Privacy Key',
				options: [
					{
						type: 'textinput',
						id: 'channel',
						label: 'Channel',
						default: '1',
						useVariables: { local: true },
						description: '1 to 2',
					},
					{
						type: 'textinput',
						id: 'privKey',
						label: 'Privacy Key',
						default: '',
						useVariables: { local: true },
						description: '16 Characters max',
					},
				],
				callback: async (action) => {
					const channel = Number.parseInt(action.options.channel?.toString() ?? '1')
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel ${channel}`)

					const msg = API.TX2N.Set.RadioEncryptionPrivacyKey(channel, action.options.privKey?.toString() ?? '')
					const privKey = API.RadioEncryptionPrivacyKey(await self.send(msg, 1))

					ensureRadioExists(self.device, privKey.chan)
					self.device.radios[privKey.chan].privacyKey = privKey.key
					self.checkFeedbacks('privKey')
				},
			}

			actions.transmitterOutput = {
				name: 'Radio - Transmitter Output',
				options: [
					{
						type: 'textinput',
						id: 'channel',
						label: 'Channel',
						default: '1',
						useVariables: { local: true },
						description: '1 to 2',
					},
					{
						type: 'checkbox',
						id: 'enable',
						label: 'Enable',
						default: true,
					},
				],
				callback: async (action) => {
					const channel = Number.parseInt(action.options.channel?.toString() ?? '1')
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel ${channel}`)

					const msg = API.TX2N.Set.TransmitterOutput(channel, action.options.enable ? 'ON' : 'OFF')
					const txOut = API.RadioTransmitterOutput(await self.send(msg, 1))

					ensureRadioExists(self.device, txOut.chan)
					self.device.radios[txOut.chan].transmitterOutput = txOut.output
					self.checkFeedbacks('transmitterOutput')
				},
			}

			actions.audioStreamInputMute = {
				name: 'Audio Stream - Input Mute',
				options: [
					{
						type: 'textinput',
						id: 'channel',
						label: 'Channel',
						default: '1',
						useVariables: { local: true },
						description: '1 to 2',
					},
					{
						type: 'textinput',
						id: 'input',
						label: 'Input',
						default: '1',
						useVariables: { local: true },
						description: '1 to 2',
					},
					{
						type: 'checkbox',
						id: 'mute',
						label: 'Mute',
						default: true,
					},
				],
				callback: async (action) => {
					const channel = Number.parseInt(action.options.channel?.toString() ?? '1')
					const input = Number.parseInt(action.options.input?.toString() ?? '1')
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel ${channel}`)
					if (!API.isOneOrTwo(input)) throw new Error(`Invalid input ${input}`)

					const msg = API.TX2N.Set.AudioStreamInputMute(channel, input, action.options.mute ? 'ON' : 'OFF')
					const streamMute = API.AudioStreamInputMute(await self.send(msg, 1))

					ensureAudioStreamInputExists(self.device, streamMute.stream, streamMute.input)
					self.device.audioStreams[streamMute.stream].inputs[streamMute.input].mute = streamMute.mute
					self.checkFeedbacks('inputMute')
				},
			}

			actions.audioStreamProgramInfo = {
				name: 'Audio Stream - Program Info',
				options: [
					{
						type: 'textinput',
						id: 'channel',
						label: 'Channel',
						default: '1',
						useVariables: { local: true },
						description: '1 to 2',
					},
					{
						type: 'textinput',
						id: 'pgmInfo',
						label: 'Program Info',
						default: '1',
						useVariables: { local: true },
						description: '32 Characters max',
					},
				],
				callback: async (action) => {
					const channel = Number.parseInt(action.options.channel?.toString() ?? '1')
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel ${channel}`)

					const msg = API.TX2N.Set.AudioStreamProgramInfo(channel, action.options.pgmInfo?.toString() ?? '')
					const pgmInfo = API.AudioStreamProgramInfo(await self.send(msg, 1))

					ensureAudioStreamExists(self.device, pgmInfo.stream)
					self.device.audioStreams[pgmInfo.stream].programInfo = pgmInfo.info
					self.checkFeedbacks('programInfo')
				},
			}
			break

		default:
			throw new Error(`Invalid model, no action definitions: ${model}`)
	}

	self.setActionDefinitions(actions)
}
