import { Regex, type SomeCompanionConfigField } from '@companion-module/base'

export type Model = 'TX2N' | 'D4'
export interface ModuleConfig {
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
			default: 'TX2N',
			choices: [
				{ id: 'TX2N', label: 'TX2N / TX2N-D' },
				{ id: 'D4', label: 'D4 / D16' },
			],
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
