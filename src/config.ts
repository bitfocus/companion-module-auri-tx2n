import { Regex, type DropdownChoice, type SomeCompanionConfigField } from '@companion-module/base'

export type Model = 'TX2N' | 'D4'

const MODEL_CHOICES = [
	{ id: 'TX2N', label: 'TX2N / TX2N-D' },
	{ id: 'D4', label: 'D4 / D16' },
] as const satisfies DropdownChoice<Model>[]

// A type alias, not an interface: InstanceTypes requires config to satisfy JsonObject, and interfaces don't
export type ModuleConfig = {
	host: string
	port: number
	model: Model
	interval: number
	verbose: boolean
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Target IP',
			width: 8,
			regex: Regex.IP,
		},
		{
			type: 'number',
			id: 'port',
			label: 'Target Port',
			width: 4,
			min: 1,
			max: 65535,
			default: 54666,
		},
		{
			type: 'dropdown',
			id: 'model',
			label: 'Model',
			width: 8,
			default: MODEL_CHOICES[0].id,
			choices: MODEL_CHOICES,
		},
		{
			type: 'number',
			id: 'interval',
			label: 'Poll Interval (mS)',
			width: 4,
			min: 100,
			max: 30000,
			default: 5000,
		},
		{
			type: 'checkbox',
			id: 'verbose',
			label: 'Verbose Logs',
			width: 4,
			default: false,
		},
	]
}
