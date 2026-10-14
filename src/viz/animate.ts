import type { animate as Animate } from "motion/react"

/**
 * Motion's animate() is ~22K gz, and nothing above the fold animates with it.
 * The islands that need it (merge chart, viem trace, Standard Schema collapse,
 * agents replay) all sit below the fold, so it is fetched on the first scroll,
 * or on demand, and never on the initial load.
 *
 * The MotionValues themselves (useMotionValue, useTransform) stay eager: they
 * are ~5K gz and the prerendered marks are computed from them.
 */
export type AnimateFn = typeof Animate

let pending: Promise<AnimateFn> | undefined
let loaded: AnimateFn | undefined

/**
 * The fail-soft stand-in for when the chunk can't load (a daily deploy renamed
 * it under an open tab): every value lands on its target at once and callbacks
 * fire as if the animation had finished, so each island shows its final state.
 * onComplete waits a microtask because callers store the returned controls
 * before their onComplete clears them (agents/Replay).
 */
const instant = ((
	subject: { set?: (v: unknown) => void } | number,
	to: unknown,
	opts: { onUpdate?: (v: unknown) => void; onComplete?: () => void } = {}
) => {
	const end = Array.isArray(to) ? to.at(-1) : to
	if (typeof subject === "object") subject.set?.(end)
	opts.onUpdate?.(end)
	queueMicrotask(() => opts.onComplete?.())
	return { stop() {}, cancel() {}, complete() {} }
}) as unknown as AnimateFn

/** Never rejects: on a failed import it resolves to `instant` (see above). */
export const loadAnimate = (): Promise<AnimateFn> =>
	(pending ??= import("./animate-impl").then(
		mod => (loaded = mod?.animate ?? instant),
		() => (loaded = instant)
	))

/** animate(), if it has arrived: lets a handler start in the same frame */
export const getAnimate = () => loaded

/** Start fetching animate() on the visitor's first scroll. Idempotent. */
export const warmAnimate = () => {
	if (pending || typeof window === "undefined") return
	addEventListener("scroll", () => void loadAnimate(), {
		once: true,
		passive: true
	})
}
