import { useEffect, useState, type RefObject } from "react"
import { isOnscreen, prefersReducedMotion } from "~/lib/motion"

type Entrance = "static" | "armed" | "play"

/**
 * A one-shot entrance. The prerendered HTML is the final state ("static").
 * After hydration, an element that is still offscreen is "armed" (its start
 * state, which nobody can see), then plays once it is `threshold` visible.
 * Anything onscreen at load, or under reduced motion, never animates.
 */
export const useEntrance = (
	ref: RefObject<Element | null>,
	threshold = 0.4
): Entrance => {
	const [phase, setPhase] = useState<Entrance>("static")
	useEffect(() => {
		const el = ref.current
		if (!el || prefersReducedMotion() || isOnscreen(el)) return
		setPhase("armed")
		const io = new IntersectionObserver(
			([entry]) => {
				if (!entry?.isIntersecting) return
				io.disconnect()
				// one frame in the armed state, so the transition has a start
				requestAnimationFrame(() => setPhase("play"))
			},
			{ threshold }
		)
		io.observe(el)
		return () => io.disconnect()
	}, [ref, threshold])
	return phase
}
