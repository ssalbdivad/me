import { useEffect } from "react"
import { prefersReducedMotion } from "./motion"

/**
 * Reveal-once for [data-reveal] (styles.css). Everything already on or above
 * the screen is marked data-in="now" and never hides, so nothing visible at
 * load blinks or animates. Each block below the screen gets data-wait (or
 * data-wait-kids for a stagger list), which is what hides it, and data-in the
 * first time ~15% of it (or 15% of the viewport, for tall blocks) is visible.
 * Hiding is per block, not a class on <html>: a root class would restyle the
 * whole document after hydration. Keyboard focus moving into a block still
 * waiting shows it at once, so focus never lands on something invisible.
 */
export const useReveals = () => {
	useEffect(() => {
		// nothing hides under reduced motion, so there is nothing to reveal
		if (prefersReducedMotion()) return
		const pending = new Set<Element>()
		// idempotent, so a remount (StrictMode, HMR) re-observes what's left
		const blocks = [
			...document.querySelectorAll("[data-reveal]:not([data-in])")
		]
		// every read, then every write: interleaved, each write would force a
		// fresh style and layout pass for the next read
		const tops = blocks.map(el => el.getBoundingClientRect().top)
		blocks.forEach((el, i) => {
			if (tops[i]! < innerHeight) el.setAttribute("data-in", "now")
			else {
				// two names, so the `> *` rule only ever matches stagger lists' children
				el.setAttribute(
					el.getAttribute("data-reveal") === "stagger" ?
						"data-wait-kids"
					:	"data-wait",
					""
				)
				pending.add(el)
			}
		})
		if (!pending.size) return
		const reveal = (el: Element, now: boolean) => {
			el.setAttribute("data-in", now ? "now" : "")
			observer.unobserve(el)
			pending.delete(el)
		}
		const observer = new IntersectionObserver(
			entries => {
				for (const entry of entries) {
					// passed it without stopping: show it, don't animate it
					if (entry.boundingClientRect.bottom < 0) reveal(entry.target, true)
					else if (
						entry.intersectionRatio >= 0.15 ||
						entry.intersectionRect.height >= innerHeight * 0.15
					)
						reveal(entry.target, false)
				}
			},
			// every 1% up to 15%: a tall block (case 01 is ~1,850px) crosses
			// 15% of itself far too late, so the viewport branch above must be
			// re-checked as it scrolls in, not only at 0% and 15%
			{ threshold: Array.from({ length: 16 }, (_, i) => i / 100) }
		)
		for (const el of pending) observer.observe(el)
		// A jump link (or the browser restoring scroll late) can carry the page
		// from above a block to below it in one step: it never intersects, so
		// the observer never reports it, and it would rise in on the way back
		// up. Once scrolling settles, show whatever starts above the screen:
		// a sliver of one still showing under the nav included.
		const sweep = () => {
			for (const el of pending)
				if (el.getBoundingClientRect().top < 0) reveal(el, true)
			if (!pending.size) removeEventListener("scroll", onScroll)
		}
		let settle: ReturnType<typeof setTimeout> | undefined
		const onScroll = () => {
			clearTimeout(settle)
			settle = setTimeout(sweep, 150)
		}
		addEventListener("scroll", onScroll, { passive: true })
		const first = requestAnimationFrame(sweep)
		const onFocus = (e: FocusEvent) => {
			let block = (e.target as Element | null)?.closest?.(
				"[data-reveal]:not([data-in])"
			)
			while (block) {
				reveal(block, true)
				block = block.parentElement?.closest("[data-reveal]:not([data-in])")
			}
		}
		document.addEventListener("focusin", onFocus)
		return () => {
			observer.disconnect()
			cancelAnimationFrame(first)
			clearTimeout(settle)
			removeEventListener("scroll", onScroll)
			document.removeEventListener("focusin", onFocus)
		}
	}, [])
}

/**
 * Twoslash popups open on :hover and :focus-visible. Escape hides the one
 * under the pointer and the focused one (WCAG 1.4.13) until neither the
 * pointer nor focus is on it any more.
 */
const useTwoslashEscape = () => {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return
			const focused = (e.target as Element | null)?.closest?.(".twoslash-hover")
			// the innermost hovered token: :hover matches its ancestors too
			const hovered = [
				...document.querySelectorAll(".twoslash-hover:hover")
			].at(-1)
			for (const hover of new Set([focused, hovered])) {
				if (!hover || hover.hasAttribute("data-dismissed")) continue
				hover.setAttribute("data-dismissed", "")
				const clear = () => {
					if (hover.matches(":hover") || hover.contains(document.activeElement))
						return
					hover.removeAttribute("data-dismissed")
					hover.removeEventListener("pointerleave", later)
					hover.removeEventListener("focusout", later)
				}
				// both fire before :hover and focus have moved on: check after
				const later = () => setTimeout(clear)
				hover.addEventListener("pointerleave", later)
				hover.addEventListener("focusout", later)
			}
		}
		document.addEventListener("keydown", onKey)
		return () => document.removeEventListener("keydown", onKey)
	}, [])
}

/**
 * Twoslash popups hang from their token's left edge, so a token near the
 * right of a code block (the hero card's `exec`) would push its popup past
 * the viewport. Just before one opens, measure it and slide it back inside
 * by --shift; the caret moves the other way so it still points at the token.
 */
const useTwoslashClamp = () => {
	useEffect(() => {
		const margin = 12
		const clamp = (e: Event) => {
			const hover = (e.target as Element | null)?.closest?.(".twoslash-hover")
			const popup = hover?.querySelector<HTMLElement>(
				":scope > .twoslash-popup-container"
			)
			if (!popup) return
			popup.style.removeProperty("--shift")
			// the closed popup is scaled down a touch around its centre; measure
			// the box it will have once open
			const r = popup.getBoundingClientRect()
			const left = r.left - (popup.offsetWidth - r.width) / 2
			const right = left + popup.offsetWidth
			const max = document.documentElement.clientWidth - margin
			const shift =
				right > max ? Math.max(max - right, margin - left)
				: left < margin ? margin - left
				: 0
			if (shift) popup.style.setProperty("--shift", `${Math.round(shift)}px`)
		}
		document.addEventListener("pointerover", clamp, true)
		document.addEventListener("focusin", clamp, true)
		return () => {
			document.removeEventListener("pointerover", clamp, true)
			document.removeEventListener("focusin", clamp, true)
		}
	}, [])
}

/**
 * Document-wide behaviour that belongs to no one section. Reveals are not in
 * here: they mutate section DOM, so they must run from the route that owns
 * it, after that (lazily loaded) route has hydrated.
 */
export const useShellEffects = () => {
	useTwoslashEscape()
	useTwoslashClamp()
}
