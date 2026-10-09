import type { CompanionActionDefinitions } from '@companion-module/base'
import type ModuleInstance from './main.js'
import type { Model } from './config.js'
import { FeedbackId } from './feedbacks.js'
import * as API from './api.js'
import * as Opts from './options.js'

/**
 * Action ids. The values are the ids saved against every button using the action, so they must never change —
 * they predate this enum and are camelCase for that reason.
 */
export enum ActionId {
	Identify = 'identify',
	DockBroadcastName = 'dockBroadcastName',
	DockPrivKey = 'dockPrivKey',
	RadioEncryption = 'radioEncryption',
	RadioEncryptionBroadcastName = 'radioEncryptionBroadcastName',
	RadioEncryptionPrivacyKey = 'radioEncryptionPrivacyKey',
	TransmitterOutput = 'transmitterOutput',
	AudioStreamInputMute = 'audioStreamInputMute',
	AudioStreamProgramInfo = 'audioStreamProgramInfo',
}

export type ActionSchema = {
	[ActionId.Identify]: { options: Record<string, never> }
	[ActionId.DockBroadcastName]: { options: { position: number; name: string } }
	[ActionId.DockPrivKey]: { options: { position: number; privKey: string } }
	[ActionId.RadioEncryption]: { options: { channel: number; enable: boolean } }
	[ActionId.RadioEncryptionBroadcastName]: { options: { channel: number; name: string } }
	[ActionId.RadioEncryptionPrivacyKey]: { options: { channel: number; privKey: string } }
	[ActionId.TransmitterOutput]: { options: { channel: number; enable: boolean } }
	[ActionId.AudioStreamInputMute]: { options: { stream: number; input: number; mute: boolean } }
	[ActionId.AudioStreamProgramInfo]: { options: { stream: number; pgmInfo: string } }
}

/**
 * Sets every action the selected model doesn't offer to `undefined`, which is how Companion is told it isn't
 * available. The definitions type requires every key, so this also narrows away the `Partial`.
 */
function ensureAllActionKeys(
	actions: Partial<CompanionActionDefinitions<ActionSchema>>,
): asserts actions is CompanionActionDefinitions<ActionSchema> {
	for (const id of Object.values(ActionId)) {
		if (!(id in actions)) actions[id] = undefined
	}
}

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
	const actions: Partial<CompanionActionDefinitions<ActionSchema>> = {}

	actions[ActionId.Identify] = {
		name: 'Identify',
		options: [],
		callback: async (_action, context) => {
			const msg = API.TX2N.Set.SystemIdentify()
			await self.send(msg, 1, context.signal)
		},
	}

	switch (model) {
		case 'D4':
			actions[ActionId.DockBroadcastName] = {
				name: 'Position - Broadcast Name',
				options: [Opts.dockPositionOption, Opts.nameOption],
				callback: async (action, context) => {
					const { position, name } = action.options
					if (!API.isOneToThirtyTwo(position)) throw new Error(`Invalid position ${position}`)

					const msg = API.D4.Set.SetDockEncryptionBroadcastName(position, name)
					const bcName = API.DockEncryptionBroadcastName(await self.send(msg, 1, context.signal))

					ensureDockPositionExists(self.device, bcName.position)
					self.device.dock[bcName.position].broadcastName = bcName.name
					self.checkFeedbacks(FeedbackId.DockBroadcastName)
				},
			}

			actions[ActionId.DockPrivKey] = {
				name: 'Position - Privacy Key',
				options: [Opts.dockPositionOption, Opts.privKeyOption],
				callback: async (action, context) => {
					const { position, privKey } = action.options
					if (!API.isOneToThirtyTwo(position)) throw new Error(`Invalid position ${position}`)

					const msg = API.D4.Set.SetDockEncryptionPrivacyKey(position, privKey)
					const posPrivKey = API.DockEncryptionPrivacyKey(await self.send(msg, 1, context.signal))

					ensureDockPositionExists(self.device, posPrivKey.position)
					self.device.dock[posPrivKey.position].privacyKey = posPrivKey.key
					self.checkFeedbacks(FeedbackId.DockPrivKey)
				},
			}
			break

		case 'TX2N':
			actions[ActionId.RadioEncryption] = {
				name: 'Radio - Encryption',
				options: [Opts.rxChanOption, Opts.enableOption],
				callback: async (action, context) => {
					const channel = action.options.channel
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel ${channel}`)

					const msg = API.TX2N.Set.RadioEncryption(channel, action.options.enable ? 'ON' : 'OFF')
					const rxEncrypt = API.RadioEncryption(await self.send(msg, 1, context.signal))

					ensureRadioExists(self.device, rxEncrypt.ch)
					self.device.radios[rxEncrypt.ch].encryption = rxEncrypt.encryption
					self.checkFeedbacks(FeedbackId.RadioEncryption)
				},
			}

			actions[ActionId.RadioEncryptionBroadcastName] = {
				name: 'Radio - Broadcast Name',
				options: [Opts.rxChanOption, Opts.nameOption],
				callback: async (action, context) => {
					const channel = action.options.channel
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel ${channel}`)

					const msg = API.TX2N.Set.RadioEncryptionBroadcastName(channel, action.options.name)
					const rxBcName = API.RadioEncryptionBroadcastName(await self.send(msg, 1, context.signal))

					ensureRadioExists(self.device, rxBcName.chan)
					self.device.radios[rxBcName.chan].broadcastName = rxBcName.name
					self.checkFeedbacks(FeedbackId.BroadcastName)
				},
			}

			actions[ActionId.RadioEncryptionPrivacyKey] = {
				name: 'Radio - Privacy Key',
				options: [Opts.rxChanOption, Opts.privKeyOption],
				callback: async (action, context) => {
					const channel = action.options.channel
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel ${channel}`)

					const msg = API.TX2N.Set.RadioEncryptionPrivacyKey(channel, action.options.privKey)
					const privKey = API.RadioEncryptionPrivacyKey(await self.send(msg, 1, context.signal))

					ensureRadioExists(self.device, privKey.chan)
					self.device.radios[privKey.chan].privacyKey = privKey.key
					self.checkFeedbacks(FeedbackId.PrivKey)
				},
			}

			actions[ActionId.TransmitterOutput] = {
				name: 'Radio - Transmitter Output',
				options: [Opts.rxChanOption, Opts.enableOption],
				callback: async (action, context) => {
					const channel = action.options.channel
					if (!API.isOneOrTwo(channel)) throw new Error(`Invalid channel ${channel}`)

					const msg = API.TX2N.Set.TransmitterOutput(channel, action.options.enable ? 'ON' : 'OFF')
					const txOut = API.RadioTransmitterOutput(await self.send(msg, 1, context.signal))

					ensureRadioExists(self.device, txOut.chan)
					self.device.radios[txOut.chan].transmitterOutput = txOut.output
					self.checkFeedbacks(FeedbackId.TransmitterOutput)
				},
			}

			actions[ActionId.AudioStreamInputMute] = {
				name: 'Audio Stream - Input Mute',
				options: [Opts.streamOption, Opts.inputChanOption, Opts.muteOption],
				callback: async (action, context) => {
					const { stream, input } = action.options
					if (!API.isOneOrTwo(stream)) throw new Error(`Invalid stream ${stream}`)
					if (!API.isOneOrTwo(input)) throw new Error(`Invalid input ${input}`)

					const msg = API.TX2N.Set.AudioStreamInputMute(stream, input, action.options.mute ? 'ON' : 'OFF')
					const streamMute = API.AudioStreamInputMute(await self.send(msg, 1, context.signal))

					ensureAudioStreamInputExists(self.device, streamMute.stream, streamMute.input)
					self.device.audioStreams[streamMute.stream].inputs[streamMute.input].mute = streamMute.mute
					self.checkFeedbacks(FeedbackId.InputMute)
				},
			}

			actions[ActionId.AudioStreamProgramInfo] = {
				name: 'Audio Stream - Program Info',
				options: [Opts.streamOption, Opts.pgmInfoOption],
				callback: async (action, context) => {
					const stream = action.options.stream
					if (!API.isOneOrTwo(stream)) throw new Error(`Invalid stream ${stream}`)

					const msg = API.TX2N.Set.AudioStreamProgramInfo(stream, action.options.pgmInfo)
					const pgmInfo = API.AudioStreamProgramInfo(await self.send(msg, 1, context.signal))

					ensureAudioStreamExists(self.device, pgmInfo.stream)
					self.device.audioStreams[pgmInfo.stream].programInfo = pgmInfo.info
					self.checkFeedbacks(FeedbackId.ProgramInfo)
				},
			}
			break

		default:
			throw new Error(`Invalid model, no action definitions: ${model}`)
	}

	ensureAllActionKeys(actions)
	self.setActionDefinitions(actions)
}
