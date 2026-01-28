type OneOrTwo = 1 | 2

export function isOneOrTwo(value: number): value is OneOrTwo {
	return Number.isInteger(value) && value >= 1 && value <= 2
}

export type OneToThirtyTwo =
	| 1
	| 2
	| 3
	| 4
	| 5
	| 6
	| 7
	| 8
	| 9
	| 10
	| 11
	| 12
	| 13
	| 14
	| 15
	| 16
	| 17
	| 18
	| 19
	| 20
	| 21
	| 22
	| 23
	| 24
	| 25
	| 26
	| 27
	| 28
	| 29
	| 30
	| 31
	| 32

export function isOneToThirtyTwo(value: number): value is OneToThirtyTwo {
	return Number.isInteger(value) && value >= 1 && value <= 32
}

export type OnOrOff = 'ON' | 'OFF'

export interface DeviceState {
	system: {
		status: number
	}
	radios: {
		[channel: number]: {
			encryption: boolean
			broadcastName: string
			privacyKey: string
			transmitterOutput: boolean
		}
	}
	audioStreams: {
		[stream: number]: {
			programInfo: string
			inputs: {
				[input: number]: {
					mute: boolean
				}
			}
			outputs: {
				L: number
				R: number
			}
		}
	}
	dock: {
		[position: number]: {
			broadcastName: string
			privacyKey: string
		}
	}
}

export const TX2N = {
	Get: {
		SystemStatus: (): string => 'GET SYSTEM STATUS',
		RadioEncryption: (Chan: OneOrTwo): string => `GET RADIO ${Chan} ENCRYPTION`,
		RadioEncryptionBroadcastName: (Chan: OneOrTwo): string => `GET RADIO ${Chan} ENCRYPTION BROADCAST_NAME`,
		RadioEncryptionPrivacyKey: (Chan: OneOrTwo): string => `GET RADIO ${Chan} ENCRYPTION PRIVACY_KEY`,
		TransmitterOutput: (Chan: OneOrTwo): string => `GET RADIO ${Chan} TRANSMITTER OUTPUT`,
		AudioStreamProgramInfo: (Chan: OneOrTwo): string => `GET AUDIO STREAM ${Chan} PROGRAM INFO`,
		AudioStreamInputMute: (Chan: OneOrTwo, Input: OneOrTwo): string => `GET AUDIO STREAM ${Chan} INPUT ${Input} MUTE`,
		AudioStreamOutputLevelLeft: (Chan: OneOrTwo): string => `GET AUDIO STREAM ${Chan} OUTPUT LEVEL LEFT`,
		AudioStreamOutputLevelRight: (Chan: OneOrTwo): string => `GET AUDIO STREAM ${Chan} OUTPUT LEVEL RIGHT`,
	},
	Set: {
		SystemIdentify: (): string => 'SET SYSTEM IDENTIFY = ON',
		RadioEncryption: (Chan: OneOrTwo, Value: OnOrOff): string => `SET RADIO ${Chan} ENCRYPTION = ${Value}`,
		RadioEncryptionBroadcastName: (Chan: OneOrTwo, Name: string): string =>
			`SET RADIO ${Chan} ENCRYPTION BROADCAST_NAME = "${Name.substring(0, 32).padEnd(4, ' ')}"`,
		RadioEncryptionPrivacyKey: (Chan: OneOrTwo, Key: string): string =>
			`SET RADIO ${Chan} ENCRYPTION PRIVACY_KEY = "${Key.length > 0 ? Key.substring(0, 16).padEnd(4, ' ') : ''}"`,
		TransmitterOutput: (Chan: OneOrTwo, Value: OnOrOff): string => `SET RADIO ${Chan} TRANSMITTER OUTPUT = ${Value}`,
		AudioStreamProgramInfo: (Chan: OneOrTwo, PgmInfo: string): string =>
			`SET AUDIO STREAM ${Chan} PROGRAM INFO = "${PgmInfo.length > 0 ? PgmInfo.substring(0, 32).padEnd(4, ' ') : ''}"`,
		AudioStreamInputMute: (Chan: OneOrTwo, Input: OneOrTwo, Value: OnOrOff): string =>
			`SET AUDIO STREAM ${Chan} INPUT ${Input} MUTE = ${Value}`,
	},
}

export const D4 = {
	Get: {
		SystemStatus: (): string => 'GET SYSTEM STATUS',
		DockEncryptionBroadcastName: (Number: OneToThirtyTwo): string => `GET DOCK ENCRYPTION BROADCAST_NAME ${Number}`,
		DockEncryptionPrivacyKey: (Number: OneToThirtyTwo): string => `GET DOCK ENCRYPTION PRIVACY_KEY ${Number}`,
	},
	Set: {
		SetSystemIdentify: (): string => 'SET SYSTEM IDENTIFY = ON',
		SetDockEncryptionBroadcastName: (Number: OneToThirtyTwo, Name: string): string =>
			`SET DOCK ENCRYPTION BROADCAST_NAME ${Number} = "${Name.length > 0 ? Name.substring(0, 32).padEnd(4, ' ') : ''}"`,
		SetDockEncryptionPrivacyKey: (Number: OneToThirtyTwo, PrivKey: string): string =>
			`SET DOCK ENCRYPTION PRIVACY_KEY ${Number} = "${PrivKey.length > 0 ? PrivKey.substring(0, 16).padEnd(4, ' ') : ''}"`,
	},
} as const

export const Cmds = {
	TX2N: TX2N,
	D4: D4,
} as const

function parseOnOff(value: string): boolean {
	return value.toUpperCase() === 'ON'
}

function extractNumber(match: RegExpMatchArray, index: number): number {
	return parseInt(match[index], 10)
}

// Generic parser for simple key-value messages
function parseKeyValue<T>(msg: string, pattern: RegExp, errorMsg: string, parser: (match: RegExpMatchArray) => T): T {
	const trimmed = msg.trim()
	const match = trimmed.match(pattern)

	if (!match) {
		throw new Error(`${errorMsg}, got: "${msg}"`)
	}

	return parser(match)
}

export function SystemStatus(msg: string): number {
	return parseKeyValue(
		msg,
		/^SYSTEM\s+STATUS\s*=\s*(-?\d+)$/i,
		'Invalid message format. Expected "SYSTEM STATUS = <number>"',
		(match) => extractNumber(match, 1),
	)
}

export function RadioEncryption(msg: string): { ch: number; encryption: boolean } {
	return parseKeyValue(
		msg,
		/^RADIO\s+(\d+)\s+ENCRYPTION\s*=\s*(ON|OFF)$/i,
		'Invalid message format. Expected "RADIO <number> ENCRYPTION = <ON|OFF>"',
		(match) => ({
			ch: extractNumber(match, 1),
			encryption: parseOnOff(match[2]),
		}),
	)
}

export function RadioEncryptionBroadcastName(msg: string): { chan: number; name: string } {
	return parseKeyValue(
		msg,
		/^RADIO\s+(\d+)\s+ENCRYPTION\s+BROADCAST_NAME\s*=\s*"([^"]*)"$/i,
		'Invalid message format. Expected "RADIO <number> ENCRYPTION BROADCAST_NAME = \\"<name>\\""',
		(match) => ({
			chan: extractNumber(match, 1),
			name: match[2],
		}),
	)
}

export function RadioEncryptionPrivacyKey(msg: string): { chan: number; key: string } {
	return parseKeyValue(
		msg,
		/^RADIO\s+(\d+)\s+ENCRYPTION\s+PRIVACY_KEY\s*=\s*"([^"]*)"$/i,
		'Invalid message format. Expected "RADIO <number> ENCRYPTION PRIVACY_KEY = \\"<key>\\""',
		(match) => ({
			chan: extractNumber(match, 1),
			key: match[2],
		}),
	)
}

export function RadioTransmitterOutput(msg: string): { chan: number; output: boolean } {
	return parseKeyValue(
		msg,
		/^RADIO\s+(\d+)\s+TRANSMITTER\s+OUTPUT\s*=\s*(ON|OFF)$/i,
		'Invalid message format. Expected "RADIO <number> TRANSMITTER OUTPUT = <ON|OFF>"',
		(match) => ({
			chan: extractNumber(match, 1),
			output: parseOnOff(match[2]),
		}),
	)
}

export function AudioStreamProgramInfo(msg: string): { stream: number; info: string } {
	return parseKeyValue(
		msg,
		/^AUDIO\s+STREAM\s+(\d+)\s+PROGRAM\s+INFO\s*=\s*"([^"]*)"$/i,
		'Invalid message format. Expected "AUDIO STREAM <number> PROGRAM INFO = \\"<info>\\""',
		(match) => ({
			stream: extractNumber(match, 1),
			info: match[2],
		}),
	)
}

export function AudioStreamInputMute(msg: string): { stream: number; input: number; mute: boolean } {
	return parseKeyValue(
		msg,
		/^AUDIO\s+STREAM\s+(\d+)\s+INPUT\s+(\d+)\s+MUTE\s*=\s*(ON|OFF)$/i,
		'Invalid message format. Expected "AUDIO STREAM <number> INPUT <number> MUTE = <ON|OFF>"',
		(match) => ({
			stream: extractNumber(match, 1),
			input: extractNumber(match, 2),
			mute: parseOnOff(match[3]),
		}),
	)
}

export function AudioStreamOutputLevel(msg: string): { stream: number; output: 'L' | 'R'; level: number } {
	return parseKeyValue(
		msg,
		/^AUDIO\s+STREAM\s+(\d+)\s+OUTPUT\s+LEVEL\s+(LEFT|RIGHT)\s*=\s*(-?\d+)$/i,
		'Invalid message format. Expected "AUDIO STREAM <number> OUTPUT LEVEL <LEFT|RIGHT> = <number>"',
		(match) => ({
			stream: extractNumber(match, 1),
			output: match[2].toUpperCase() === 'LEFT' ? ('L' as const) : ('R' as const),
			level: extractNumber(match, 3),
		}),
	)
}

export function DockEncryptionBroadcastName(msg: string): { position: number; name: string } {
	return parseKeyValue(
		msg,
		/^DOCK\s+(\d+)\s+ENCRYPTION\s+BROADCAST_NAME\s*=\s*"([^"]*)"$/i,
		'Invalid message format. Expected "DOCK <number> ENCRYPTION BROADCAST_NAME = \\"<name>\\""',
		(match) => ({
			position: extractNumber(match, 1),
			name: match[2],
		}),
	)
}

export function DockEncryptionPrivacyKey(msg: string): { position: number; key: string } {
	return parseKeyValue(
		msg,
		/^DOCK\s+(\d+)\s+ENCRYPTION\s+PRIVACY_KEY\s*=\s*"([^"]*)"$/i,
		'Invalid message format. Expected "DOCK <number> ENCRYPTION PRIVACY_KEY = \\"<key>\\""',
		(match) => ({
			position: extractNumber(match, 1),
			key: match[2],
		}),
	)
}
