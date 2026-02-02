import type {
	CompanionInputFieldNumber,
	CompanionInputFieldDropdown,
	CompanionInputFieldTextInput,
	CompanionInputFieldCheckbox,
} from '@companion-module/base'

export const streamOption = {
	type: 'textinput',
	id: 'stream',
	label: 'Stream',
	default: '1',
	useVariables: { local: true },
	description: '1 or 2',
} as const satisfies CompanionInputFieldTextInput

export const lrChanOption = {
	type: 'dropdown',
	id: 'channel',
	label: 'Channel',
	default: 'L',
	choices: [
		{ id: 'L', label: 'Left' },
		{ id: 'R', label: 'Right' },
	],
} as const satisfies CompanionInputFieldDropdown

export const dockPositionOption = {
	type: 'textinput',
	id: 'position',
	label: 'Position',
	default: '1',
	useVariables: { local: true },
	description: '1 to 32',
} as const satisfies CompanionInputFieldTextInput

export const positionOption = {
	type: 'dropdown',
	label: 'Position',
	id: 'position',
	default: 'right',
	choices: [
		{ id: 'left', label: 'Left' },
		{ id: 'right', label: 'Right' },
		{ id: 'top', label: 'Top' },
		{ id: 'bottom', label: 'Bottom' },
	],
} as const satisfies CompanionInputFieldDropdown

export const rxChanOption = {
	type: 'textinput',
	id: 'channel',
	label: 'Channel',
	default: '1',
	useVariables: { local: true },
	description: '1 or 2',
} as const satisfies CompanionInputFieldTextInput

export const inputChanOption = {
	type: 'textinput',
	id: 'input',
	label: 'Input',
	default: '1',
	useVariables: { local: true },
	description: '1 or 2',
} as const satisfies CompanionInputFieldTextInput

export const paddingOption = {
	type: 'number',
	label: 'Padding',
	id: 'padding',
	description: 'Distance from edge of button, perpendicular orientation',
	min: 0,
	max: 72,
	default: 1,
	required: true,
} as const satisfies CompanionInputFieldNumber

export const offsetOption = {
	type: 'number',
	label: 'Offset',
	id: 'offset',
	description: 'Distance from edge of button, axial orientation',
	min: 0,
	max: 20,
	default: 5,
	required: true,
} as const satisfies CompanionInputFieldNumber

export const meterWidthOption = {
	type: 'number',
	label: 'Meter Width',
	id: 'width',
	default: 6,
	min: 1,
	max: 20,
} as const satisfies CompanionInputFieldNumber

export const minValOption = {
	type: 'number',
	label: 'Minimum Value',
	id: 'min',
	default: -60,
	description: 'Value less than or equal to this will result in no metering',
	min: -100,
	max: -20,
} as const satisfies CompanionInputFieldNumber

export const nameOption = {
	type: 'textinput',
	id: 'name',
	label: 'Name',
	default: '',
	useVariables: { local: true },
	description: '32 Characters max',
} as const satisfies CompanionInputFieldTextInput

export const privKeyOption = {
	type: 'textinput',
	id: 'privKey',
	label: 'Privacy Key',
	default: '',
	useVariables: { local: true },
	description: '16 Characters max',
} as const satisfies CompanionInputFieldTextInput

export const enableOption = {
	type: 'checkbox',
	id: 'enable',
	label: 'Enable',
	default: true,
} as const satisfies CompanionInputFieldCheckbox

export const muteOption = {
	type: 'checkbox',
	id: 'mute',
	label: 'Mute',
	default: true,
} as const satisfies CompanionInputFieldCheckbox

export const pgmInfoOption = {
	type: 'textinput',
	id: 'pgmInfo',
	label: 'Program Info',
	default: '1',
	useVariables: { local: true },
	description: '32 Characters max',
} as const satisfies CompanionInputFieldTextInput
