import { CompanionActionDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import type { Model } from './config.js'
import * as API from './api.js'

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
					await self.send(msg, 1)
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
					await self.send(msg, 1)
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
					await self.send(msg, 1)
				},
			}
			actions.RadioEncryptionBroadcastName = {
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
					await self.send(msg, 1)
				},
			}
			actions.RadioEncryptionPrivacyKey = {
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
					await self.send(msg, 1)
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
					await self.send(msg, 1)
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
					await self.send(msg, 1)
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
					await self.send(msg, 1)
				},
			}
			break
		default:
			throw new Error(`Invalid model, no action definitions: ${model}`)
	}
	self.setActionDefinitions(actions)
}
