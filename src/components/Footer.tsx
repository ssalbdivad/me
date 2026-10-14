import { useEffect, useRef, useState } from "react"
import { statsAsOf } from "~/data/claims"
import siteCost from "~/data/site-cost.json"
import { formatNumber } from "~/lib/format"
import { prefersReducedMotion } from "~/lib/motion"
import { local } from "~/lib/storage"
import { email } from "~/data/site"
import {
	ArrowIcon,
	BlueskyIcon,
	GitHubIcon,
	LinkedInIcon,
	XIcon
} from "./icons"
import { Quickinfo } from "./Quickinfo"

export const Contact = () => {
	const [copied, setCopied] = useState<boolean>()
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
	useEffect(() => () => clearTimeout(timer.current), [])
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(email)
			setCopied(true)
		} catch {
			// no clipboard permission (or an insecure origin): say so, not "Copied"
			setCopied(false)
		}
		// each click restarts the 1.6s, so a second copy isn't cut short
		clearTimeout(timer.current)
		timer.current = setTimeout(() => setCopied(undefined), 1600)
	}
	return (
		<section
			id="contact"
			className="contact block wrap"
			aria-labelledby="contact-title"
		>
			<div className="contact-inner" data-reveal>
				<span className="sec-label">
					<b>07</b> // contact
				</span>
				<h2 className="h2" id="contact-title">
					Say hi
				</h2>
				<p className="sec-deck">
					Building something hard in TypeScript or AI? I'd love to hear about
					it.
				</p>
				<div className="contact-ctas">
					<a className="btn btn-gold" href={`mailto:${email}`}>
						{/* mono, as in the hero: the address is set one way everywhere */}
						<span className="mono">{email}</span> <ArrowIcon />
					</a>
					<button
						type="button"
						className="btn btn-ghost copy js-only"
						onClick={copy}
					>
						{copied ?
							"Copied. ⛵"
						: copied === false ?
							"Copy failed"
						:	"Copy"}
					</button>
					<span role="status" className="sr-only">
						{copied ?
							"Copied"
						: copied === false ?
							"Copy failed"
						:	""}
					</span>
				</div>
				<ul className="socials">
					<li>
						<a href="https://github.com/ssalbdivad">
							<GitHubIcon /> <span>ssalbdivad</span>
						</a>
					</li>
					<li>
						<a href="https://www.linkedin.com/in/ssalbdivad">
							<LinkedInIcon /> <span>in/ssalbdivad</span>
						</a>
					</li>
					<li>
						<a href="https://x.com/ssalbdivad">
							<XIcon /> <span>@ssalbdivad</span>
						</a>
					</li>
					<li>
						<a href="https://bsky.app/profile/ssalbdivad.dev">
							<BlueskyIcon /> <span>@ssalbdivad.dev</span>
						</a>
					</li>
					<li>
						<a href="/resume">
							<FileIcon /> <span>résumé</span>
						</a>
					</li>
				</ul>
			</div>
		</section>
	)
}

type Theme = "dark" | "light"

const themes = ["dark", "light"] as const

const ThemeToggle = () => {
	const [theme, setTheme] = useState<Theme>("dark")
	const group = useRef<HTMLDivElement>(null)
	useEffect(() => {
		setTheme(
			document.documentElement.dataset.theme === "light" ? "light" : "dark"
		)
	}, [])

	/** origin: the click point, or the button's centre for keyboard and AT */
	const choose = (next: Theme, origin: { x: number; y: number }) => {
		if (next === theme) return
		const root = document.documentElement
		const apply = () => {
			root.dataset.theme = next
			document
				.querySelector('meta[name="theme-color"]')
				?.setAttribute("content", next === "light" ? "#f9f5d7" : "#080d17")
			setTheme(next)
			local.set("theme", next)
		}
		if (!document.startViewTransition || prefersReducedMotion()) return apply()
		// clamp: a keyboard origin can still be mid-scroll, off screen
		const x = Math.min(Math.max(origin.x, 0), innerWidth)
		const y = Math.min(Math.max(origin.y, 0), innerHeight)
		root.style.setProperty("--vt-x", `${x}px`)
		root.style.setProperty("--vt-y", `${y}px`)
		root.style.setProperty(
			"--vt-r",
			`${Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)))}px`
		)
		root.dataset.switching = ""
		document
			.startViewTransition(apply)
			.finished.finally(() => delete root.dataset.switching)
	}

	const originOf = (e: React.MouseEvent<HTMLButtonElement>) => {
		// detail is 0 for keyboard-triggered clicks, whose clientX/Y are 0,0
		if (e.detail) return { x: e.clientX, y: e.clientY }
		const r = e.currentTarget.getBoundingClientRect()
		return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
	}

	// a radio group: one tab stop, arrows move and select
	const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
		if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))
			return
		e.preventDefault()
		const next = theme === "dark" ? "light" : "dark"
		const button = group.current?.querySelector<HTMLButtonElement>(
			`[data-theme-option="${next}"]`
		)
		button?.focus()
		const r = button?.getBoundingClientRect()
		choose(
			next,
			r ?
				{ x: r.left + r.width / 2, y: r.top + r.height / 2 }
			:	{ x: 0, y: innerHeight }
		)
	}

	return (
		<div
			className="theme-toggle js-only"
			role="radiogroup"
			aria-label="Theme"
			ref={group}
		>
			{themes.map(t => (
				<button
					key={t}
					type="button"
					role="radio"
					data-theme-option={t}
					aria-checked={theme === t}
					tabIndex={theme === t ? 0 : -1}
					onClick={e => choose(t, originOf(e))}
					onKeyDown={onKeyDown}
				>
					{t === "dark" ? "ArkDark" : "ArkLight"}
				</button>
			))}
		</div>
	)
}

/** `numbers={false}` on pages with no claim tokens or code hovers (the 404, /resume) */
export const Footer = ({ numbers = true }: { numbers?: boolean }) => (
	<footer className="footer">
		<Boat />
		<div className="footer-inner wrap">
			<div className="footer-left">
				<p>David Blass · Boston, MA</p>
				<ThemeToggle />
			</div>
			<div className="fine mono">
				{numbers && (
					<p>
						// every code hover on this page is real compiler output, computed
						at build
					</p>
				)}
				{numbers ?
					<p>
						// the headline numbers carry their source; hover or tap them{" "}
						<span className="stamp">(stats as of {statsAsOf})</span>
					</p>
				:	<p>// stats as of {statsAsOf}</p>}
				{siteCost && (
					<p>
						⛳ this site: {formatNumber(siteCost.instantiations)} instantiations
						· {siteCost.checkSeconds}s check · {siteCost.errors} errors
					</p>
				)}
				<p>
					//{" "}
					<a
						className="link"
						href="https://archiveprogram.github.com/arctic-vault/"
					>
						some of my code is buried under Svalbard permafrost
					</a>
				</p>
				<p>
					//{" "}
					<a className="link" href="/resume.md">
						/resume.md
					</a>{" "}
					·{" "}
					<a className="link" href="/llms.txt">
						/llms.txt
					</a>{" "}
					for your agent
				</p>
			</div>
		</div>
	</footer>
)

/** arktype.io's FloatYourBoat, at its exact timing: 150s across, a 2s bob. */
const Boat = () => {
	const lane = useRef<HTMLDivElement>(null)
	// sail only while the footer is on screen (and, implicitly, the tab is visible)
	useEffect(() => {
		const el = lane.current
		if (!el) return
		const io = new IntersectionObserver(([entry]) => {
			if (entry?.isIntersecting) el.dataset.on = ""
			else delete el.dataset.on
		})
		io.observe(el)
		return () => io.disconnect()
	}, [])
	return (
		<div className="boat-lane" aria-hidden={false} ref={lane}>
			<span className="boat">
				{/* measured: Firefox can't anchor to the moving, transformed boat */}
				<Quickinfo trigger="⛵" label="a boat" measure>
					<span className="qi-body">
						<span className="k">const</span> <span className="n">boat</span>
						<span className="k">:</span> <span className="v">"⛵"</span>
					</span>
					<span className="qi-doc">
						An homage to the boat that floats across{" "}
						<a href="https://arktype.io" className="ext">
							arktype.io
						</a>
						.
					</span>
				</Quickinfo>
			</span>
		</div>
	)
}

const FileIcon = () => (
	<svg viewBox="0 0 16 16" fill="none" aria-hidden>
		<path
			d="M9.5 1.5H4A1.5 1.5 0 0 0 2.5 3v10A1.5 1.5 0 0 0 4 14.5h8a1.5 1.5 0 0 0 1.5-1.5V5.5l-4-4zM9.5 1.5v4h4M5.5 8.5h5M5.5 11h5"
			stroke="currentColor"
			strokeWidth="1.3"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
)
