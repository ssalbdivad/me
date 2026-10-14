import type { MotionValue } from "motion/react"
import {
	createElement,
	useEffect,
	useRef,
	type CSSProperties,
	type ReactNode
} from "react"

type Value = MotionValue<string> | MotionValue<number>
type Bindings = Record<string, Value>

const current = (bindings: Bindings) =>
	Object.fromEntries(
		Object.entries(bindings).map(([key, mv]) => [key, mv.get()])
	)

/**
 * Deliberately not generic over `keyof JSX.IntrinsicElements`: that version
 * (`as: tag` + `Omit<JSX.IntrinsicElements[tag], …>`) cost ~108K type
 * instantiations on its own and tripled the project's count (200K → 637K).
 * Static props are the few the charts use; add one here when a chart needs it.
 */
type LiveProps = {
	as: "span" | "path" | "rect" | "line"
	attrs?: Bindings
	style?: Bindings
	/** the element's whole text content */
	text?: Value
	children?: ReactNode
	className?: string
	"aria-hidden"?: boolean
	vectorEffect?: "non-scaling-stroke"
	x?: number
	y?: number
	width?: number
	height?: number
	x1?: number
	x2?: number
	y1?: number
	y2?: number
	[data: `data-${string}`]: string | boolean | undefined
}

/**
 * An element whose attributes and style follow MotionValues, written straight
 * to the DOM on change: no React re-render per frame, and none of Motion's `m`
 * component machinery (or its feature bundles) on the page. The first render
 * uses the values' current state, so the prerendered HTML is the final chart.
 *
 * Bound keys must be the same in React and the DOM (d, width, x1, opacity…)
 * and style keys camelCase (transform, clipPath…). The MotionValues must be
 * stable for the element's lifetime.
 */
export const Live = ({
	as,
	attrs = {},
	style = {},
	text,
	...rest
}: LiveProps) => {
	const ref = useRef<HTMLElement | SVGElement>(null)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const css = el.style as unknown as Record<string, string>
		const stops = [
			...Object.entries(attrs).map(([key, mv]) => {
				const set = (v: string | number) => el.setAttribute(key, String(v))
				set(mv.get())
				return mv.on("change", set)
			}),
			...Object.entries(style).map(([key, mv]) => {
				const set = (v: string | number) => {
					css[key] = String(v)
				}
				set(mv.get())
				return mv.on("change", set)
			})
		]
		if (text) {
			const set = (v: string | number) => {
				el.textContent = String(v)
			}
			set(text.get())
			stops.push(text.on("change", set))
		}
		return () => stops.forEach(stop => stop())
		// bindings are MotionValues, stable for the element's lifetime
	}, [])
	const props = {
		...rest,
		...current(attrs),
		style: current(style) as CSSProperties,
		ref
	}
	return text ?
			createElement(as, props, String(text.get()))
		:	createElement(as, props)
}
