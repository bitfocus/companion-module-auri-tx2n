import type {
	CompanionInputFieldNumber,
	CompanionInputFieldDropdown,
	CompanionInputFieldTextInput,
	CompanionInputFieldCheckbox,
	DropdownChoice,
} from '@companion-module/base'

export type LrChannel = 'L' | 'R'

const LR_CHANNEL_CHOICES = [
	{ id: 'L', label: 'Left' },
	{ id: 'R', label: 'Right' },
] as const satisfies DropdownChoice<LrChannel>[]

export type BarPosition = 'left' | 'right' | 'top' | 'bottom'

const BAR_POSITION_CHOICES = [
	{ id: 'left', label: 'Left' },
	{ id: 'right', label: 'Right' },
	{ id: 'top', label: 'Top' },
	{ id: 'bottom', label: 'Bottom' },
] as const satisfies DropdownChoice<BarPosition>[]

export const streamOption = {
	type: 'number',
	id: 'stream',
	label: 'Stream',
	default: 1,
	min: 1,
	max: 2,
	asInteger: true,
	description: '1 or 2',
} as const satisfies CompanionInputFieldNumber<'stream'>

export const lrChanOption = {
	type: 'dropdown',
	id: 'channel',
	label: 'Channel',
	default: LR_CHANNEL_CHOICES[0].id,
	choices: LR_CHANNEL_CHOICES,
} as const satisfies CompanionInputFieldDropdown<'channel', LrChannel>

export const dockPositionOption = {
	type: 'number',
	id: 'position',
	label: 'Position',
	default: 1,
	min: 1,
	max: 32,
	asInteger: true,
	description: '1 to 32',
} as const satisfies CompanionInputFieldNumber<'position'>

export const positionOption = {
	type: 'dropdown',
	label: 'Position',
	id: 'position',
	default: BAR_POSITION_CHOICES[1].id,
	choices: BAR_POSITION_CHOICES,
} as const satisfies CompanionInputFieldDropdown<'position', BarPosition>

export const rxChanOption = {
	type: 'number',
	id: 'channel',
	label: 'Channel',
	default: 1,
	min: 1,
	max: 2,
	asInteger: true,
	description: '1 or 2',
} as const satisfies CompanionInputFieldNumber<'channel'>

export const inputChanOption = {
	type: 'number',
	id: 'input',
	label: 'Input',
	default: 1,
	min: 1,
	max: 2,
	asInteger: true,
	description: '1 or 2',
} as const satisfies CompanionInputFieldNumber<'input'>

export const paddingOption = {
	type: 'number',
	label: 'Padding',
	id: 'padding',
	description: 'Distance from edge of button, perpendicular orientation',
	min: 0,
	max: 72,
	default: 1,
} as const satisfies CompanionInputFieldNumber<'padding'>

export const offsetOption = {
	type: 'number',
	label: 'Offset',
	id: 'offset',
	description: 'Distance from edge of button, axial orientation',
	min: 0,
	max: 20,
	default: 5,
} as const satisfies CompanionInputFieldNumber<'offset'>

export const meterWidthOption = {
	type: 'number',
	label: 'Meter Width',
	id: 'width',
	default: 6,
	min: 1,
	max: 20,
} as const satisfies CompanionInputFieldNumber<'width'>

export const minValOption = {
	type: 'number',
	label: 'Minimum Value',
	id: 'min',
	default: -60,
	description: 'Value less than or equal to this will result in no metering',
	min: -100,
	max: -20,
} as const satisfies CompanionInputFieldNumber<'min'>

export const nameOption = {
	type: 'textinput',
	id: 'name',
	label: 'Name',
	default: '',
	useVariables: true,
	description: '32 Characters max',
} as const satisfies CompanionInputFieldTextInput<'name'>

export const privKeyOption = {
	type: 'textinput',
	id: 'privKey',
	label: 'Privacy Key',
	default: '',
	useVariables: true,
	description: '16 Characters max',
} as const satisfies CompanionInputFieldTextInput<'privKey'>

export const enableOption = {
	type: 'checkbox',
	id: 'enable',
	label: 'Enable',
	default: true,
} as const satisfies CompanionInputFieldCheckbox<'enable'>

export const muteOption = {
	type: 'checkbox',
	id: 'mute',
	label: 'Mute',
	default: true,
} as const satisfies CompanionInputFieldCheckbox<'mute'>

export const pgmInfoOption = {
	type: 'textinput',
	id: 'pgmInfo',
	label: 'Program Info',
	default: '1',
	useVariables: true,
	description: '32 Characters max',
} as const satisfies CompanionInputFieldTextInput<'pgmInfo'>
