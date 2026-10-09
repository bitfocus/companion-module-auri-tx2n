import { describe, expect, it, vi } from 'vitest'
import type {
	CompanionFeedbackAdvancedEvent,
	CompanionFeedbackCallbackContext,
	CompanionFeedbackContext,
	CompanionFeedbackDefinitions,
	CompanionFeedbackInfo,
	CompanionFeedbackValueEvent,
} from '@companion-module/base'
import { FeedbackId, UpdateFeedbacks, type FeedbackSchema } from '../feedbacks.js'
import type ModuleInstance from '../main.js'
import type { DeviceState } from '../api.js'

const METER_OPTIONS = {
	stream: 1,
	channel: 'L',
	position: 'right',
	padding: 1,
	offset: 5,
	width: 6,
	min: -60,
} as const

function setup() {
	const device: DeviceState = {
		system: { status: 0 },
		radios: {},
		audioStreams: {
			1: { programInfo: '', inputs: { 1: { mute: false }, 2: { mute: false } }, outputs: { L: -30, R: -200 } },
			2: { programInfo: '', inputs: { 1: { mute: false }, 2: { mute: false } }, outputs: { L: -200, R: -200 } },
		},
		dock: {},
	}
	const setFeedbackDefinitions = vi.fn<(defs: CompanionFeedbackDefinitions<FeedbackSchema>) => void>()
	const subscribeMetering = vi.fn<(id: string) => void>()
	const unsubscribeMetering = vi.fn<(id: string) => void>()
	const self = {
		device,
		log: vi.fn(),
		subscribeMetering,
		unsubscribeMetering,
		setFeedbackDefinitions,
	} as unknown as ModuleInstance
	UpdateFeedbacks(self, 'TX2N')
	const defs = setFeedbackDefinitions.mock.calls[0][0]
	const context = { signal: new AbortController().signal } as CompanionFeedbackCallbackContext

	const meter = defs[FeedbackId.LevelMeterAudioStreamOutput]
	const level = defs[FeedbackId.OutputLevel]
	if (!meter || !level) throw new Error('TX2N should define both level feedbacks')

	const info = { type: 'advanced', id: 'fb-meter', controlId: 'bank-1', previousOptions: null } as const
	const runMeter = async (image?: { width: number; height: number }) =>
		await meter.callback(
			{
				...info,
				feedbackId: FeedbackId.LevelMeterAudioStreamOutput,
				options: METER_OPTIONS,
				image,
			} satisfies CompanionFeedbackAdvancedEvent<typeof METER_OPTIONS>,
			context,
		)
	const runLevel = async () =>
		await level.callback(
			{
				type: 'value',
				id: 'fb-level',
				controlId: 'bank-2',
				feedbackId: FeedbackId.OutputLevel,
				options: { stream: 1, channel: 'L' },
				previousOptions: null,
			} satisfies CompanionFeedbackValueEvent<{ stream: number; channel: 'L' | 'R' }>,
			context,
		)
	return { device, defs, meter, level, runMeter, runLevel, subscribeMetering, unsubscribeMetering }
}

/** ARGB bytes of the pixel at (x, y) in a 72 pixel wide image */
function pixelAt(pixels: Buffer, x: number, y: number): number[] {
	const offset = (y * 72 + x) * 4
	return [...pixels.subarray(offset, offset + 4)]
}

describe('level meter feedback', () => {
	it('returns its image base64 encoded, as API 2.x requires', async () => {
		const { runMeter } = setup()
		const result = await runMeter({ width: 72, height: 72 })

		expect(typeof result.imageBuffer).toBe('string')
		expect(Buffer.from(result.imageBuffer ?? '', 'base64')).toHaveLength(72 * 72 * 4)
	})

	it('declares ARGB, which is what companion-module-utils draws', async () => {
		const { runMeter } = setup()
		const result = await runMeter({ width: 72, height: 72 })
		const pixels = Buffer.from(result.imageBuffer ?? '', 'base64')

		expect(result.imageBufferEncoding).toEqual({ pixelFormat: 'ARGB' })
		// -30 on a -60..0 meter is half full. A right hand bar 6 wide, 1 in from the edge and 5 from top and bottom,
		// spans x 65-70 and y 5-66. Alpha comes first: the lit bottom is opaque green, the unlit top translucent red.
		expect(pixelAt(pixels, 65, 66)).toEqual([255, 0, 255, 0])
		expect(pixelAt(pixels, 65, 5)).toEqual([64, 255, 0, 0])
		expect(pixelAt(pixels, 0, 0)).toEqual([0, 0, 0, 0])
	})

	it('declares the property it affects', () => {
		const { meter } = setup()

		expect(meter.affectedProperties).toEqual(['imageBuffer'])
	})

	it('is marked deprecated, pointing at the presets and composite that replace it', () => {
		const { defs } = setup()
		const advanced = Object.values(defs).filter((def) => def && def.type === 'advanced')

		expect(advanced).toHaveLength(1)
		for (const def of advanced) {
			expect(def && def.description).toMatch(/^Deprecated: .*Output Meter presets.*Level Meter composite/)
		}
	})

	it('draws nothing where the button has no image, but still starts metering', async () => {
		const { runMeter, subscribeMetering } = setup()

		expect(await runMeter(undefined)).toEqual({})
		expect(subscribeMetering).toHaveBeenCalledWith('fb-meter')
	})
})

describe('metering registration', () => {
	// API 2.x dropped the feedback subscribe hook these used to start metering from
	it('the meter registers from its callback and drops out on unsubscribe', async () => {
		const { meter, runMeter, subscribeMetering, unsubscribeMetering } = setup()
		await runMeter({ width: 72, height: 72 })
		expect(subscribeMetering).toHaveBeenCalledWith('fb-meter')

		await meter.unsubscribe?.({ id: 'fb-meter' } as CompanionFeedbackInfo<never>, {} as CompanionFeedbackContext)
		expect(unsubscribeMetering).toHaveBeenCalledWith('fb-meter')
	})

	it('the output level value registers from its callback and drops out on unsubscribe', async () => {
		const { level, runLevel, subscribeMetering, unsubscribeMetering } = setup()

		expect(await runLevel()).toBe(-30)
		expect(subscribeMetering).toHaveBeenCalledWith('fb-level')

		await level.unsubscribe?.({ id: 'fb-level' } as CompanionFeedbackInfo<never>, {} as CompanionFeedbackContext)
		expect(unsubscribeMetering).toHaveBeenCalledWith('fb-level')
	})

	it('no other feedback registers for metering', () => {
		const { defs } = setup()
		const withUnsubscribe = Object.entries(defs)
			.filter(([, def]) => def && def.unsubscribe !== undefined)
			.map(([id]) => id)

		expect(withUnsubscribe.sort()).toEqual([FeedbackId.LevelMeterAudioStreamOutput, FeedbackId.OutputLevel].sort())
	})
})
