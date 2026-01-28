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

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	#config!: ModuleConfig // Setup in init()
	#queue = new PQueue({ concurrency: 1, interval: 50, intervalCap: 1 })
	#controller = new AbortController()
	#statusManager = new StatusManager(this, { status: InstanceStatus.Connecting, message: 'Initialising' }, 2000)
	#socket!: UDPHelper
	#pollTimer: NodeJS.Timeout | undefined = undefined
	device: API.DeviceState = {
		system: {
			status: 0,
		},
		radios: {},
		audioStreams: {},
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
		this.#controller.abort()
		this.#statusManager.destroy()
		this.#queue.clear()
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.#config = config
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
					level1_L,
					level1_R,
					level2_L,
					level2_R,
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
					this.send(API.TX2N.Get.AudioStreamOutputLevelLeft(1)).then(API.AudioStreamOutputLevel),
					this.send(API.TX2N.Get.AudioStreamOutputLevelRight(1)).then(API.AudioStreamOutputLevel),
					this.send(API.TX2N.Get.AudioStreamOutputLevelLeft(2)).then(API.AudioStreamOutputLevel),
					this.send(API.TX2N.Get.AudioStreamOutputLevelRight(2)).then(API.AudioStreamOutputLevel),
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
				device.audioStreams[1] = {
					programInfo: streamInfo1.info,
					inputs: {
						1: { mute: mute1_1.mute },
						2: { mute: mute1_2.mute },
					},
					outputs: {
						L: level1_L.level,
						R: level1_R.level,
					},
				}

				device.audioStreams[2] = {
					programInfo: streamInfo2.info,
					inputs: {
						1: { mute: mute2_1.mute },
						2: { mute: mute2_2.mute },
					},
					outputs: {
						L: level2_L.level,
						R: level2_R.level,
					},
				}
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
				const systemStatus = results[0]
				device.system.status = systemStatus

				// Extract dock results (indices 1 onwards)
				const dockResults = results.slice(1)

				// Populate device.dock
				device.dock = {}
				for (let i = 1; i <= 32; i++) {
					const bcNameIndex = (i - 1) * 2
					const privKeyIndex = (i - 1) * 2 + 1

					device.dock[i] = {
						broadcastName: dockResults[bcNameIndex].name,
						privacyKey: dockResults[privKeyIndex].key,
					}
				}
			}
			this.#statusManager.updateStatus(InstanceStatus.Ok)
		} catch (err) {
			this.#statusManager.updateStatus(InstanceStatus.UnknownError)
			if (typeof err == 'string') this.log('error', `Error during polling ${err}`)
			else if (err instanceof Error) this.log('error', `Error during polling ${err.message}`)
			else this.log('error', `Error during polling: ${String(err)}`)
		}
		this.checkFeedbacks()
		this.#pollTimer = setTimeout(() => {
			this.startPolling().catch(() => {})
		}, this.#config.interval)
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
