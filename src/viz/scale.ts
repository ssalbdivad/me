/**
 * Hand-rolled scales for the site's charts. Every scale maps a value to a
 * fraction of its range (0..1), so charts can lay marks out in percentages
 * and stay correct at any width, before hydration and without JS.
 */

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const steps = [1, 2, 2.5, 5, 10]

/** The smallest {1, 2, 2.5, 5} × 10^k that is ≥ v. */
export const niceCeil = (v: number): number => {
	if (v <= 0) return 1
	const k = 10 ** Math.floor(Math.log10(v))
	const step = steps.find(s => s * k >= v * (1 - 1e-12)) ?? 10
	return step * k
}

/** ticks from 0 to max on a nice step: 4 or 5 intervals, never 62.5 */
export const linearTicks = (max: number) => {
	const step = niceFloor(max / 4)
	const count = Math.round(max / step)
	return Array.from({ length: count + 1 }, (_, i) => step * i)
}

/** the largest {1, 2, 2.5, 5} × 10^k that is ≤ v */
const niceFloor = (v: number): number => {
	const k = 10 ** Math.floor(Math.log10(v))
	const step = [...steps].reverse().find(s => s * k <= v * (1 + 1e-12)) ?? 1
	return step * k
}

/** decades from 10^a to 10^b */
export const decades = (a: number, b: number) =>
	Array.from({ length: b - a + 1 }, (_, i) => 10 ** (a + i))

/** 0 · 400K · 1.2M · 10M: an axis label that never lies by rounding up */
const tick = new Intl.NumberFormat("en", {
	notation: "compact",
	maximumFractionDigits: 1,
	roundingMode: "trunc"
})
export const formatTick = (v: number) => tick.format(v)

export const pct = (fraction: number) => `${(fraction * 100).toFixed(3)}%`
