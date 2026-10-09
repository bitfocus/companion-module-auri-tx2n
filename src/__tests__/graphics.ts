import type { ButtonGraphicsGaugeElement } from '@companion-module/base'

export type Options = Record<string, unknown>
export type Bounds = { x: number; y: number; width: number; height: number }

/**
 * Evaluates an element property as Companion would. The expressions used (option references, ternaries,
 * comparisons, arithmetic) are also valid JavaScript, so this substitutes the options and lets JS run them.
 */
export function evaluate(property: unknown, options: Options): unknown {
	if (typeof property !== 'object' || property === null || !('isExpression' in property)) return property
	const { isExpression, value } = property as { isExpression: boolean; value: unknown }
	if (!isExpression) return value
	const source = String(value).replace(/\$\(options:(\w+)\)/g, (_, key: string) => JSON.stringify(options[key]))
	// eslint-disable-next-line @typescript-eslint/no-implied-eval
	return new Function(`return (${source})`)() as unknown
}

export const num = (property: unknown, options: Options): number => Number(evaluate(property, options))

/** A gauge's bounds, as percentages of the composite it sits in */
export function gaugeBounds(gauge: ButtonGraphicsGaugeElement, options: Options): Bounds {
	return {
		x: num(gauge.x, options),
		y: num(gauge.y, options),
		width: num(gauge.width, options),
		height: num(gauge.height, options),
	}
}
