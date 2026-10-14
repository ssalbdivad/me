/**
 * Shared motion guards. Call these from effects and handlers only, never
 * during render: the prerender has no window, and reading one at render
 * would desync hydration.
 */

/** The visitor asked for less motion. False outside a browser. */
export const prefersReducedMotion = () =>
	typeof matchMedia !== "undefined" &&
	matchMedia("(prefers-reduced-motion: reduce)").matches

/** Any part of `el` is inside the viewport right now. */
export const isOnscreen = (el: Element) => {
	const r = el.getBoundingClientRect()
	return r.top < innerHeight && r.bottom > 0
}
