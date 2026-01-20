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
import PQueue from 'p-queue'

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	#config!: ModuleConfig // Setup in init()
	#queue = new PQueue({ concurrency: 1, interval: 50, intervalCap: 1 })
	#controller = new AbortController()
	#statusManager = new StatusManager(this, { status: InstanceStatus.Connecting, message: 'Initialising' }, 2000)
	#socket!: UDPHelper

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
				return
			}
			this.debug(`Message recieved from host: ${rinfo.address}:${rinfo.port}\n${msg}`)
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
			this.startPolling()
		})
	}

	startPolling(): void {}

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
