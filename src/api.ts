type OneOrTwo = 1 | 2

type OneToThirtyTwo =
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

export type OnOrOff = 'ON' | 'OFF'

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
		SystemIdentify: (): string => 'SET SYSTEM IDENTIFY',
		RadioEncryption: (Chan: OneOrTwo, Value: OnOrOff): string => `SET RADIO ${Chan} ENCRYPTION ${Value}`,
		RadioEncryptionBroadcastName: (Chan: OneOrTwo, Name: string): string =>
			`SET RADIO ${Chan} ENCRYPTION BROADCAST_NAME ${Name.substring(0, 32).padEnd(4, ' ')}`,
		RadioEncryptionPrivacyKey: (Chan: OneOrTwo, Key: string): string =>
			`SET RADIO ${Chan} ENCRYPTION PRIVACY_KEY ${Key.length > 0 ? Key.substring(0, 16).padEnd(4, ' ') : ''}`,
		TransmitterOutput: (Chan: OneOrTwo, Value: OnOrOff): string => `SET RADIO ${Chan} TRANSMITTER OUTPUT ${Value}`,
		AudioStreamProgramInfo: (Chan: OneOrTwo, PgmInfo: string): string =>
			`SET AUDIO STREAM ${Chan} PROGRAM INFO ${PgmInfo.length > 0 ? PgmInfo.substring(0, 16).padEnd(4, ' ') : ''}`,
		AudioStreamInputMute: (Chan: OneOrTwo, Input: OneOrTwo, Value: OnOrOff): string =>
			`SET AUDIO STREAM ${Chan} INPUT ${Input} MUTE ${Value}`,
	},
}

export const D4 = {
	Get: {
		SystemStatus: (): string => 'GET SYSTEM STATUS',
		DockEncryptionBroadcastName: (Number: OneToThirtyTwo): string => `GET DOCK ENCRYPTION BROADCAST_NAME ${Number}`,
		DockEncryptionPrivacyKey: (Number: OneToThirtyTwo): string => `GET DOCK ENCRYPTION PRIVACY_KEY ${Number}`,
	},
	Set: {
		SetSystemIdentify: (): string => 'SET SYSTEM IDENTIFY',
		SetDockEncryptionBroadcastName: (Number: OneToThirtyTwo): string => `SET DOCK ENCRYPTION BROADCAST_NAME ${Number}`,
		SetDockEncryptionPrivacyKey: (Number: OneToThirtyTwo): string => `SET DOCK ENCRYPTION PRIVACY_KEY ${Number}`,
	},
} as const

export const Cmds = {
	TX2N: TX2N,
	D4: D4,
} as const
