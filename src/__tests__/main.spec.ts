import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventEmitter } from 'node:events'
import ModuleInstance from '../main.js'
import type { ModuleConfig } from '../config.js'

type FakeSocket = EventEmitter & { sendAsync: ReturnType<typeof vi.fn<(msg: string) => Promise<void>>> }

const sockets = vi.hoisted(() => [] as FakeSocket[])

// Enough of InstanceBase to construct the module without a Companion host, and a UDPHelper that never binds
vi.mock('@companion-module/base', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@companion-module/base')>()
	const { EventEmitter } = await import('node:events')
	class InstanceBase {
		constructor(_internal: unknown) {}
		log(): void {}
		updateStatus(): void {}
		checkFeedbacks(): void {}
		checkAllFeedbacks(): void {}
		setActionDefinitions(): void {}
		setFeedbackDefinitions(): void {}
		setPresetDefinitions(): void {}
		setCompositeElementDefinitions(): void {}
		setVariableDefinitions(): void {}
	}
	class UDPHelper extends EventEmitter {
		sendAsync = vi.fn(async (_msg: string) => {})
		constructor() {
			super()
			sockets.push(this)
		}
		destroy(): void {}
	}
	return { ...actual, InstanceBase, UDPHelper }
})

const CONFIG: ModuleConfig = { host: '192.0.2.1', port: 54666, model: 'TX2N', interval: 5000, verbose: false }

/** The reply the TX2N gives to an output level query, eg GET AUDIO STREAM 1 OUTPUT LEVEL LEFT */
const levelReply = (query: string, level = -20) => `${query.replace(/^GET /, '')} = ${level}`

/** Four level queries per metering round: two streams, left and right */
const ROUND = 4

describe('metering', () => {
	let instance: ModuleInstance

	beforeEach(async () => {
		vi.useFakeTimers()
		instance = new ModuleInstance({})
		await instance.init(CONFIG)
	})
	afterEach(async () => {
		await instance.destroy()
		vi.useRealTimers()
	})

	it('runs only while a level feedback is subscribed, however many there are', async () => {
		const send = vi.spyOn(instance, 'send').mockImplementation(async (data) => levelReply(data))

		instance.subscribeMetering('fb-a')
		await vi.advanceTimersByTimeAsync(0)
		expect(send).toHaveBeenCalledTimes(ROUND)
		expect(instance.device.audioStreams[1].outputs.L).toBe(-20)

		// A second subscriber joins the running loop rather than starting another
		instance.subscribeMetering('fb-b')
		await vi.advanceTimersByTimeAsync(100)
		expect(send).toHaveBeenCalledTimes(2 * ROUND)

		instance.unsubscribeMetering('fb-a')
		await vi.advanceTimersByTimeAsync(100)
		expect(send).toHaveBeenCalledTimes(3 * ROUND)

		// With none left, the round already scheduled finds nothing to do and the loop stops
		instance.unsubscribeMetering('fb-b')
		await vi.advanceTimersByTimeAsync(1000)
		expect(send).toHaveBeenCalledTimes(3 * ROUND)

		instance.subscribeMetering('fb-c')
		await vi.advanceTimersByTimeAsync(0)
		expect(send).toHaveBeenCalledTimes(4 * ROUND)
	})

	it('does not run for a D4', async () => {
		const send = vi.spyOn(instance, 'send').mockImplementation(async (data) => levelReply(data))
		await instance.configUpdated({ ...CONFIG, model: 'D4' })

		instance.subscribeMetering('fb-a')
		await vi.advanceTimersByTimeAsync(1000)
		expect(send).not.toHaveBeenCalled()
	})

	/**
	 * configUpdated replaces the instance controller and clears the subscriptions, which the level feedbacks then
	 * re-register as they are checked again. Re-registering has to restart metering even though a round from before
	 * is still in flight, and that round must not then carry on as a second loop.
	 */
	it('restarts, as one loop, after a config update lands mid-round', async () => {
		let release!: () => void
		const gate = new Promise<void>((resolve) => (release = resolve))
		const send = vi.spyOn(instance, 'send').mockImplementation(async (data) => {
			await gate
			return levelReply(data)
		})

		instance.subscribeMetering('fb-a')
		await instance.configUpdated(CONFIG)
		instance.subscribeMetering('fb-a')
		release()
		await vi.advanceTimersByTimeAsync(0)
		expect(send).toHaveBeenCalledTimes(2 * ROUND)

		await vi.advanceTimersByTimeAsync(100)
		expect(send).toHaveBeenCalledTimes(3 * ROUND)
		await vi.advanceTimersByTimeAsync(100)
		expect(send).toHaveBeenCalledTimes(4 * ROUND)
	})
})

describe('send', () => {
	let instance: ModuleInstance
	let socket: FakeSocket

	beforeEach(async () => {
		vi.useFakeTimers()
		instance = new ModuleInstance({})
		await instance.init(CONFIG)
		socket = sockets[sockets.length - 1]
	})
	afterEach(async () => {
		await instance.destroy()
		vi.useRealTimers()
	})

	it('resolves with the reply', async () => {
		const reply = instance.send('GET SYSTEM STATUS')
		await vi.advanceTimersByTimeAsync(0)
		expect(socket.sendAsync).toHaveBeenCalledWith('GET SYSTEM STATUS\r')

		socket.emit('response', 'SYSTEM STATUS = 0')
		await expect(reply).resolves.toBe('SYSTEM STATUS = 0')
	})

	it('drops a request whose action was aborted before it reached the wire', async () => {
		const controller = new AbortController()
		controller.abort()

		await expect(instance.send('SET SYSTEM IDENTIFY = ON', 1, controller.signal)).rejects.toThrow()
		expect(socket.sendAsync).not.toHaveBeenCalled()
	})

	it('stops waiting for the reply once the action is aborted', async () => {
		const controller = new AbortController()
		const reply = instance.send('SET SYSTEM IDENTIFY = ON', 1, controller.signal)
		const settled = expect(reply).rejects.toThrow('aborted')
		await vi.advanceTimersByTimeAsync(0)
		expect(socket.sendAsync).toHaveBeenCalledTimes(1)

		controller.abort()
		await settled
	})
})
