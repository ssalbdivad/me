import { useEffect, useRef, useState } from "react"
import { isOnscreen, prefersReducedMotion } from "~/lib/motion"

const lines = [
	{
		label: "rivals",
		quote: `once you go type("string") you never go z.back()`,
		by: "@arktypeio",
		href: "https://x.com/arktypeio/status/1996993043614814329"
	},
	{
		label: "co-authors",
		quote:
			"written collaboratively by the creators of Zod (👋), Valibot, and ArkType",
		by: "Colin, announcing Standard Schema 1.0",
		href: "https://x.com/colinhacks/status/1883907825384190418"
	},
	{
		label: "co-founders",
		quote:
			"sounds fake but I'm starting a company with my nemesis Colin P. Zod",
		by: "me",
		href: "https://bsky.app/profile/ssalbdivad.dev/post/3m7nm3dbfhs2v"
	},
	{
		label: "",
		quote: "BETRAYAL",
		by: "@arktype.io",
		href: "https://bsky.app/profile/arktype.io/post/3m7nm5a327k2v"
	}
]

type State = "static" | "hidden" | "play"

/**
 * Rivals → co-authors → co-founders, as a four-line changelog. It plays once
 * when it scrolls in, and again when the `z.cofounder()` egg lands here.
 */
/** "— by ↗", wrapping only between words: the dash holds the first word, the ↗ the last */
const By = ({ by }: { by: string }) => {
	const text = `—\u00a0${by}`
	const cut = text.lastIndexOf(" ") + 1
	return (
		<span className="arc-by mono">
			{text.slice(0, cut)}
			<span className="arc-tail">
				{text.slice(cut)}
				<span className="arc-ext" aria-hidden>
					{" "}
					↗
				</span>
			</span>
		</span>
	)
}

export const Arc = () => {
	const root = useRef<HTMLElement>(null)
	const [state, setState] = useState<State>("static")

	useEffect(() => {
		const el = root.current
		if (!el || prefersReducedMotion()) return
		let io: IntersectionObserver | undefined
		let timer: ReturnType<typeof setTimeout> | undefined
		const arm = () => {
			setState("hidden")
			io?.disconnect()
			io = new IntersectionObserver(
				entries => {
					// or most of a short landscape screen, where the stacked arc is taller than it
					const enough = (e: IntersectionObserverEntry) =>
						e.intersectionRatio >= 0.45 ||
						e.intersectionRect.height >= innerHeight * 0.45
					if (!entries.some(enough)) return
					io?.disconnect()
					timer = setTimeout(() => setState("play"), 60)
				},
				{ threshold: [0, 0.15, 0.3, 0.45] }
			)
			io.observe(el)
		}
		if (!isOnscreen(el)) arm()
		window.addEventListener("arc:replay", arm)
		return () => {
			io?.disconnect()
			clearTimeout(timer)
			window.removeEventListener("arc:replay", arm)
		}
	}, [])

	return (
		<section
			className="arc"
			id="arc"
			ref={root}
			data-state={state}
			aria-label="The arc"
		>
			<ol className="arc-lines">
				{lines.map((line, i) => (
					<li
						key={line.quote}
						className="arc-line"
						data-last={i === lines.length - 1 || undefined}
						style={{ "--i": i } as React.CSSProperties}
					>
						<span className="arc-label mono">{line.label}</span>
						<a
							className="arc-quote"
							href={line.href}
							target="_blank"
							rel="noreferrer"
						>
							<span className="arc-mark mono" aria-hidden>
								"
							</span>
							<span className="arc-text">{line.quote}</span>
							<span className="arc-mark mono" aria-hidden>
								"
							</span>
						</a>
						<By by={line.by} />
					</li>
				))}
			</ol>
		</section>
	)
}
