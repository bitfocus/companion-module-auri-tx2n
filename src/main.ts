import {
	InstanceBase,
	runEntrypoint,
	InstanceStatus,
	SomeCompanionConfigField,
	UDPHelper,
} from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { StatusManager } from './status.js'
import * as API from './api.js'
import PQueue from 'p-queue'

declare module '@companion-module/base' {
	interface UDPHelperEvents {
		response: [msg: string]
	}
}

const LISTEN_TIMEOUT = 1000

const METER_POLL_INTERVAL = 100

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	#config!: ModuleConfig // Setup in init()
	#queue = new PQueue({ concurrency: 1 })
	#controller = new AbortController()
	#statusManager = new StatusManager(this, { status: InstanceStatus.Connecting, message: 'Initialising' }, 2000)
	#socket!: UDPHelper
	#pollTimer: NodeJS.Timeout | undefined = undefined
	#meterTimer: NodeJS.Timeout | undefined = undefined
	device: API.DeviceState = {
		system: {
			status: 0,
		},
		radios: {},
		audioStreams: {
			1: {
				programInfo: '',
				inputs: {
					1: { mute: false },
					2: { mute: false },
				},
				outputs: {
					L: -200,
					R: -200,
				},
			},
			2: {
				programInfo: '',
				inputs: {
					1: { mute: false },
					2: { mute: false },
				},
				outputs: {
					L: -200,
					R: -200,
				},
			},
		},
		dock: {},
	}

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.#config = config

		this.configUpdated(config).catch(() => {})
	}
	// When module gets deleted
	async destroy(): Promise<void> {
		this.log('debug', `destroy ${this.id}: ${this.label}`)
		if (this.#pollTimer) clearTimeout(this.#pollTimer)
		if (this.#meterTimer) clearTimeout(this.#meterTimer)
		this.#controller.abort()
		this.#statusManager.destroy()
		this.#queue.clear()
		if (this.#socket) {
			this.#socket.removeAllListeners()
			this.#socket.destroy()
		}
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.#config = config
		if (this.#pollTimer) clearTimeout(this.#pollTimer)
		if (this.#meterTimer) clearTimeout(this.#meterTimer)
		this.#queue.clear()
		this.#controller.abort()
		this.#statusManager.updateStatus(InstanceStatus.Connecting)
		this.#controller = new AbortController()
		this.initUDP(config.host, config.port)
		try {
			this.updateActions() // export actions
			this.updateFeedbacks() // export feedbacks
			this.updatePresets() // export Presets
			this.updateVariableDefinitions() // export variable definitions
		} catch (err) {
			if (err instanceof Error) this.log('warn', err.message)
			else this.log('warn', String(err))
		}
	}

	public debug(msg: string | object): void {
		if (this.#config.verbose) {
			if (typeof msg == 'object') msg = JSON.stringify(msg)
			this.log('debug', `${msg}`)
		}
	}

	initUDP(host: string = this.#config.host, port: number = this.#config.port): void {
		if (!host) {
			this.#statusManager.updateStatus(InstanceStatus.BadConfig, 'No host')
			throw new Error('No Host')
		}
		if (this.#socket) {
			this.#socket.removeAllListeners()
			this.#socket.destroy()
		}
		this.#socket = new UDPHelper(host, port)
		this.#socket.addListener('data', (msg, rinfo): void => {
			if (rinfo.address !== host) {
				this.log('warn', `Message recieved from unknown host: ${rinfo.address}:${rinfo.port}\n${msg}`)
			} else {
				this.debug(`Message recieved from host: ${rinfo.address}:${rinfo.port}\n${msg}`)
				this.#socket.emit('response', msg.toString())
			}
		})
		this.#socket.addListener('error', (err): void => {
			this.log('error', err.message)
			this.debug(err)
		})
		this.#socket.addListener('status_change', (status, message): void => {
			this.#statusManager.updateStatus(status, message)
		})
		this.#socket.addListener('listening', (): void => {
			this.#statusManager.updateStatus(InstanceStatus.Connecting, 'Listening')
			this.startPolling().catch(() => {})
		})
	}

	async send(data: string, priority = 0, timeout = LISTEN_TIMEOUT): Promise<string> {
		return this.#queue.add(
			async () => {
				return new Promise<string>((resolve, reject) => {
					const responseHandler: (msg: string) => void = (msg: string) => {
						clearTimeout(timeoutId)
						this.#socket.removeListener('response', responseHandler)
						resolve(msg)
					}

					const timeoutId: NodeJS.Timeout = setTimeout(() => {
						this.#socket.removeListener('response', responseHandler)
						reject(new Error('Response timeout'))
					}, timeout)

					// Listen for the response
					this.#socket.once('response', responseHandler)

					// Send the data
					this.#socket.send(data + '\r').catch((err) => {
						clearTimeout(timeoutId)
						this.#socket.removeListener('response', responseHandler)
						if (err instanceof Error) reject(err)
						reject(new Error(`Message send failure: ${data}`))
					})
				})
			},
			{ priority: priority },
		)
	}

	async startPolling(): Promise<void> {
		if (this.#pollTimer) clearTimeout(this.#pollTimer)
		if (this.#controller.signal.aborted) return
		const device = this.device
		try {
			if (this.#config.model == 'TX2N') {
				const [
					systemStatus,
					encrypt1,
					encrypt2,
					bcName1,
					bcName2,
					privKey1,
					privKey2,
					out1,
					out2,
					streamInfo1,
					streamInfo2,
					mute1_1,
					mute1_2,
					mute2_1,
					mute2_2,
				] = await Promise.all([
					this.send(API.TX2N.Get.SystemStatus()).then(API.SystemStatus),
					this.send(API.TX2N.Get.RadioEncryption(1)).then(API.RadioEncryption),
					this.send(API.TX2N.Get.RadioEncryption(2)).then(API.RadioEncryption),
					this.send(API.TX2N.Get.RadioEncryptionBroadcastName(1)).then(API.RadioEncryptionBroadcastName),
					this.send(API.TX2N.Get.RadioEncryptionBroadcastName(2)).then(API.RadioEncryptionBroadcastName),
					this.send(API.TX2N.Get.RadioEncryptionPrivacyKey(1)).then(API.RadioEncryptionPrivacyKey),
					this.send(API.TX2N.Get.RadioEncryptionPrivacyKey(2)).then(API.RadioEncryptionPrivacyKey),
					this.send(API.TX2N.Get.TransmitterOutput(1)).then(API.RadioTransmitterOutput),
					this.send(API.TX2N.Get.TransmitterOutput(2)).then(API.RadioTransmitterOutput),
					this.send(API.TX2N.Get.AudioStreamProgramInfo(1)).then(API.AudioStreamProgramInfo),
					this.send(API.TX2N.Get.AudioStreamProgramInfo(2)).then(API.AudioStreamProgramInfo),
					this.send(API.TX2N.Get.AudioStreamInputMute(1, 1)).then(API.AudioStreamInputMute),
					this.send(API.TX2N.Get.AudioStreamInputMute(1, 2)).then(API.AudioStreamInputMute),
					this.send(API.TX2N.Get.AudioStreamInputMute(2, 1)).then(API.AudioStreamInputMute),
					this.send(API.TX2N.Get.AudioStreamInputMute(2, 2)).then(API.AudioStreamInputMute),
				])
				device.system.status = systemStatus

				// Populate device object - Radios
				device.radios[1] = {
					encryption: encrypt1.encryption,
					broadcastName: bcName1.name,
					privacyKey: privKey1.key,
					transmitterOutput: out1.output,
				}

				device.radios[2] = {
					encryption: encrypt2.encryption,
					broadcastName: bcName2.name,
					privacyKey: privKey2.key,
					transmitterOutput: out2.output,
				}

				// Populate device object - Audio Streams
				device.audioStreams[1].programInfo = streamInfo1.info
				device.audioStreams[1].inputs[1].mute = mute1_1.mute
				device.audioStreams[1].inputs[2].mute = mute1_2.mute
				device.audioStreams[2].programInfo = streamInfo2.info
				device.audioStreams[2].inputs[1].mute = mute2_1.mute
				device.audioStreams[2].inputs[2].mute = mute2_2.mute
				this.checkFeedbacks(
					'systemStatus',
					'radioEncryption',
					'transmitterOutput',
					'broadcastName',
					'privKey',
					'programInfo',
					'inputMute',
				)
			} else {
				const allQueries: Promise<any>[] = [this.send(API.TX2N.Get.SystemStatus()).then(API.SystemStatus)]

				const dockPositions: API.OneToThirtyTwo[] = Array.from({ length: 32 }, (_, i) => (i + 1) as API.OneToThirtyTwo)

				for (const position of dockPositions) {
					allQueries.push(
						this.send(API.D4.Get.DockEncryptionBroadcastName(position)).then(API.DockEncryptionBroadcastName),
						this.send(API.D4.Get.DockEncryptionPrivacyKey(position)).then(API.DockEncryptionPrivacyKey),
					)
				}

				// Execute all queries in parallel (65 total: 1 system + 64 dock)
				const results = await Promise.all(allQueries)

				// Extract system status
				const systemStatus = results[0] as number
				device.system.status = systemStatus

				// Extract dock results (indices 1 onwards)
				const dockResults = results.slice(1)

				// Populate device.dock
				device.dock = {}
				for (let i = 0; i < dockResults.length; i += 2) {
					const bcName = dockResults[i] as { position: number; name: string }
					const privKey = dockResults[i + 1] as { position: number; key: string }

					// Use the position from the parsed result instead of calculating it
					device.dock[bcName.position] = {
						broadcastName: bcName.name,
						privacyKey: privKey.key,
					}
				}
				this.checkFeedbacks('systemStatus', 'dockBroadcastName', 'dockPrivKey')
			}
			this.#statusManager.updateStatus(InstanceStatus.Ok)
		} catch (err) {
			this.#statusManager.updateStatus(InstanceStatus.UnknownError)
			if (typeof err == 'string') this.log('error', `Error during polling ${err}`)
			else if (err instanceof Error) this.log('error', `Error during polling ${err.message}`)
			else this.log('error', `Error during polling: ${String(err)}`)
		}

		this.#pollTimer = setTimeout(() => {
			this.startPolling().catch(() => {})
		}, this.#config.interval)
	}

	async startMetering(): Promise<void> {
		if (this.#meterTimer) clearTimeout(this.#meterTimer)
		if (this.#controller.signal.aborted || this.#config.model !== 'TX2N') return
		const device = this.device
		try {
			const outputLevelQueries: Promise<{ stream: number; output: 'L' | 'R'; level: number }>[] = []
			for (let stream = 1; stream <= 2; stream++) {
				outputLevelQueries.push(
					this.send(API.TX2N.Get.AudioStreamOutputLevelLeft(stream as API.OneOrTwo)).then(API.AudioStreamOutputLevel),
					this.send(API.TX2N.Get.AudioStreamOutputLevelRight(stream as API.OneOrTwo)).then(API.AudioStreamOutputLevel),
				)
			}

			const outputLevels = await Promise.all(outputLevelQueries)
			outputLevels.forEach((response) => {
				if (device.audioStreams[response.stream]) {
					device.audioStreams[response.stream].outputs[response.output] = response.level
				}
			})
			this.checkFeedbacks('outputLevel', 'levelMeterAudioStreamOutput')
		} catch (err) {
			this.#statusManager.updateStatus(InstanceStatus.UnknownError)
			if (typeof err == 'string') this.log('error', `Error during meter polling ${err}`)
			else if (err instanceof Error) this.log('error', `Error during meter polling ${err.message}`)
			else this.log('error', `Error during meter polling: ${String(err)}`)
		}
		this.#meterTimer = setTimeout(() => {
			this.startMetering().catch(() => {})
		}, METER_POLL_INTERVAL)
	}

	// Return config fields for web config
	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this, this.#config.model)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this, this.#config.model)
	}

	updatePresets(): void {
		UpdatePresets(this, this.#config.model)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this, this.#config.model)
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
