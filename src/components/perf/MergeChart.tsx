import {
	useMotionValue,
	useTransform,
	type AnimationPlaybackControls,
	type MotionValue
} from "motion/react"
import { useEffect, useId, useRef, useState } from "react"
import { MERGE, measuredDay } from "~/data/caseStudies"
import chainHtml from "~/data/snippets/perf-chain.html?raw"
import { formatNumber, truncFixed } from "~/lib/format"
import { isOnscreen, prefersReducedMotion } from "~/lib/motion"
import {
	getAnimate,
	loadAnimate,
	warmAnimate,
	type AnimateFn
} from "~/viz/animate"
import { Live } from "~/viz/Live"
import {
	decades,
	formatTick,
	lerp,
	linearTicks,
	niceCeil,
	pct
} from "~/viz/scale"

const before = MERGE.before.chained
const after = MERGE.after.chained
const maxCalls = after.length
/** the first call count where 5.8 bails with TS2589 (13) */
const bailAt = before.find(p => p.ts2589)?.calls ?? maxCalls + 1
const lastPlotted = bailAt - 1
const beforeValues = before.slice(0, lastPlotted).map(p => p.instantiations)
const afterValues = after.map(p => p.instantiations)
const ssrCalls = 11
const autoplayTo = 11
const EASE = [0.22, 1, 0.36, 1] as const
const LOG_FLOOR = 1 // 10^1
const LOG_CEIL = 7 // 10^7

const logNote = "5.9 still grows quadratically, just not 3× per link"

/** runs during parsing, right after the bench's </details>; must match the effect's query */
const closeOnNarrow = `matchMedia("(max-width: 1023px)").matches&&document.currentScript.previousElementSibling.removeAttribute("open")`

/** the code panel: chain line k is the (CHAIN_OFFSET + k)th line of the snippet */
const CHAIN_OFFSET = 10

const domainFor = (n: number) =>
	niceCeil(beforeValues[Math.min(n, lastPlotted) - 1]!)
const fmt = formatNumber
const ratioAt = (n: number) => {
	const r = beforeValues[n - 1]! / afterValues[n - 1]!
	// truncated, never rounded up
	return r < 10 ? truncFixed(r, 1) : fmt(Math.floor(r))
}
const perLink = (n: number) =>
	(beforeValues[n - 1]! / beforeValues[n - 2]!).toFixed(3)

/** 0..1 along x for call count i */
const xAt = (i: number) => (i - 1) / (maxCalls - 1)

type Scale = {
	dom: MotionValue<number>
	t: MotionValue<number>
	head: MotionValue<number>
}

/** height fraction (0 = baseline, 1 = top) blended between linear and log */
const yFrac = (v: number, dom: number, t: number) => {
	const lin = v / dom
	const log = (Math.log10(Math.max(v, 10)) - LOG_FLOOR) / (LOG_CEIL - LOG_FLOOR)
	return lerp(lin, log, t)
}

/** value of a series at a fractional head, interpolated */
const valueAt = (values: number[], h: number) => {
	const whole = Math.max(1, Math.floor(h))
	const f = h - whole
	const a = values[whole - 1]!
	const b = values[Math.min(whole, values.length - 1)]!
	return lerp(a, b, f)
}

/** the live y-domain: never lets the drawing head leave the plot */
const liveDomain = (s: Scale) =>
	Math.max(
		s.dom.get(),
		valueAt(beforeValues, Math.min(s.head.get(), lastPlotted))
	)

/** points (in a 1000×1000 box, y down) for a series drawn up to head h */
const points = (values: number[], h: number, dom: number, t: number) => {
	const cap = Math.min(h, values.length)
	const whole = Math.max(1, Math.floor(cap))
	const out: [number, number][] = []
	for (let i = 1; i <= whole; i++)
		out.push([xAt(i) * 1000, (1 - yFrac(values[i - 1]!, dom, t)) * 1000])
	const f = cap - whole
	if (f > 0.001 && whole < values.length) {
		const [ax, ay] = out[out.length - 1]!
		const bx = xAt(whole + 1) * 1000
		const by = (1 - yFrac(values[whole]!, dom, t)) * 1000
		out.push([lerp(ax, bx, f), lerp(ay, by, f)])
	}
	return out
}

/**
 * Marks sit at the plot's top-left and move by transform, in container-query
 * units of the plot (a size container): correct in the prerender at any width,
 * no layout per frame, and no layout shift while the chart animates itself.
 */
const cqw = (fraction: number) => `${(fraction * 100).toFixed(3)}cqw`
const cqh = (fraction: number) => `${(fraction * 100).toFixed(3)}cqh`

const toPath = (pts: [number, number][]) =>
	pts
		.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`)
		.join("")

const useSeries = (values: number[], s: Scale) => {
	const line = useTransform(() =>
		toPath(points(values, s.head.get(), liveDomain(s), s.t.get()))
	)
	const area = useTransform(() => {
		const pts = points(values, s.head.get(), liveDomain(s), s.t.get())
		const last = pts[pts.length - 1]!
		return `${toPath(pts)}L${last[0].toFixed(2)} 1000L0 1000Z`
	})
	const headX = useTransform(() => {
		const pts = points(values, s.head.get(), liveDomain(s), s.t.get())
		return cqw(pts[pts.length - 1]![0] / 1000)
	})
	const headY = useTransform(() => {
		const pts = points(values, s.head.get(), liveDomain(s), s.t.get())
		return cqh(pts[pts.length - 1]![1] / 1000)
	})
	const at = useTransform(() => `translate(${headX.get()}, ${headY.get()})`)
	return { line, area, headX, headY, at }
}

const describe =
	"Line chart. As chained .merge() calls increase from 1 to 15, TypeScript 5.8.2's type instantiations roughly triple with each call, from 98 to 4,784,888 at 12 calls, then fail with error TS2589 from 13 calls on. TypeScript 5.9.3 stays under 1,700 throughout: 976 at 11 calls and 1,632 at 15."

const callsText = (n: number) => `${n} ${n === 1 ? "call" : "calls"}`

const summary = (n: number) =>
	n >= bailAt ?
		`${callsText(n)}. TypeScript 5.8 failed with error 2589, excessively deep. TypeScript 5.9: ${fmt(afterValues[n - 1]!)}.`
	:	`${callsText(n)}. TypeScript 5.8: ${fmt(beforeValues[n - 1]!)} instantiations. TypeScript 5.9: ${fmt(afterValues[n - 1]!)}. ${ratioAt(n)} times fewer.`

export const MergeChart = () => {
	const uid = useId().replace(/[^a-zA-Z0-9]/g, "")
	const [n, setN] = useState(ssrCalls)
	const [log, setLog] = useState(false)
	const [hover, setHover] = useState<number>()
	const [rangeFocus, setRangeFocus] = useState(false)
	const [announce, setAnnounce] = useState("")
	const [nudge, setNudge] = useState(false)
	const [flash, setFlash] = useState(false)
	const [instant, setInstant] = useState(false)
	const [codeOpen, setCodeOpen] = useState(true)
	const [tickMax, setTickMax] = useState(() => domainFor(ssrCalls))
	const [oldTickMax, setOldTickMax] = useState<number>()

	const head = useMotionValue(ssrCalls)
	const dom = useMotionValue(domainFor(ssrCalls))
	const t = useMotionValue(0)
	const shake = useMotionValue(0)
	const squiggle = useMotionValue(1)
	const nMV = useMotionValue(ssrCalls)
	const s: Scale = { dom, t, head }

	const plot = useRef<HTMLDivElement>(null)
	const wiggle = useRef<HTMLButtonElement>(null)
	const reduced = useRef(false)
	const autoplay = useRef<ReturnType<typeof setTimeout>>(undefined)
	const running = useRef<AnimationPlaybackControls[]>([])
	const nRef = useRef(n)
	const shook = useRef(false)
	const tickRef = useRef(domainFor(ssrCalls))
	const code = useRef<HTMLDivElement>(null)
	const size = useMotionValue({ w: 640, h: 360 })

	const b = useSeries(beforeValues, s)
	const a = useSeries(afterValues, s)

	// hydration: offscreen => silently reset to 1 and autoplay once at 50% visible
	useEffect(() => {
		reduced.current = prefersReducedMotion()
		if (matchMedia("(max-width: 1023px)").matches) setCodeOpen(false)
		const el = plot.current
		if (!el) return
		const ro = new ResizeObserver(
			([e]) =>
				e && size.set({ w: e.contentRect.width, h: e.contentRect.height })
		)
		ro.observe(el)
		if (reduced.current || isOnscreen(el)) return () => ro.disconnect()
		warmAnimate()
		go(1, { silent: true })
		const io = new IntersectionObserver(
			([entry]) => {
				if (!entry || entry.intersectionRatio < 0.5) return
				io.disconnect()
				play()
			},
			{ threshold: 0.5 }
		)
		io.observe(el)
		return () => {
			io.disconnect()
			ro.disconnect()
			clearTimeout(autoplay.current)
		}
	}, [])

	// the polite summary, debounced so scrubbing doesn't chatter
	useEffect(() => {
		const id = setTimeout(() => setAnnounce(summary(n)), 400)
		return () => clearTimeout(id)
	}, [n])

	const wigglePlus = () =>
		wiggle.current?.animate(
			[
				{ rotate: "0deg" },
				{ rotate: "1.5deg" },
				{ rotate: "-1.5deg" },
				{ rotate: "0deg" }
			],
			{ duration: 400, easing: "ease-in-out" }
		)

	const play = () => {
		let i = 1
		const tick = () => {
			i++
			go(i, { draw: 0.18, ease: "linear" })
			if (i < autoplayTo) autoplay.current = setTimeout(tick, 180)
			else
				autoplay.current = setTimeout(() => {
					setNudge(true)
					wigglePlus()
					// one more nudge if they still haven't touched it
					autoplay.current = setTimeout(wigglePlus, 1200)
				}, 220)
		}
		autoplay.current = setTimeout(tick, 180)
	}

	const go = (
		next: number,
		opts: {
			silent?: boolean
			draw?: number
			ease?: "linear" | typeof EASE
		} = {}
	) => {
		next = Math.max(1, Math.min(maxCalls, next))
		const prev = nRef.current
		nRef.current = next
		nMV.set(next)
		setN(next)
		const target = domainFor(next)
		if (tickRef.current !== target) {
			setOldTickMax(tickRef.current)
			tickRef.current = target
			setTickMax(target)
		}
		if (opts.silent) {
			setInstant(true)
			requestAnimationFrame(() =>
				requestAnimationFrame(() => setInstant(false))
			)
		}
		if (opts.silent || reduced.current) {
			running.current.forEach(c => c.stop())
			head.set(next)
			dom.set(target)
			squiggle.set(1)
			if (!opts.silent)
				plot.current?.animate([{ opacity: 0.4 }, { opacity: 1 }], {
					duration: 150,
					easing: "ease-out"
				})
			return
		}
		const animate = getAnimate()
		if (animate) tween(animate, next, prev, target, opts)
		// first interaction before the chunk arrived: tween as soon as it does
		else
			void loadAnimate().then(
				fn => nRef.current === next && tween(fn, next, prev, target, opts)
			)
	}

	const tween = (
		animate: AnimateFn,
		next: number,
		prev: number,
		target: number,
		opts: { draw?: number; ease?: "linear" | typeof EASE }
	) => {
		const draw = opts.draw ?? 0.3
		running.current = [
			animate(head, next, { duration: draw, ease: opts.ease ?? EASE }),
			animate(dom, target, { duration: 0.6, ease: EASE })
		]
		if (next >= bailAt && prev < bailAt) {
			if (!shook.current) {
				shook.current = true
				squiggle.set(0)
				animate(squiggle, 1, { duration: 0.4, ease: EASE, delay: draw * 0.6 })
				animate(shake, [0, 3, -3, 3, -3, 3, 0], {
					duration: 0.24,
					delay: draw * 0.6
				})
			} else squiggle.set(1)
		}
	}

	const user = (next: number) => {
		clearTimeout(autoplay.current)
		setNudge(false)
		setFlash(next > nRef.current)
		go(next)
	}

	const toggleLog = (next: boolean) => {
		clearTimeout(autoplay.current)
		setLog(next)
		if (reduced.current) {
			t.set(next ? 1 : 0)
			plot.current?.animate([{ opacity: 0.4 }, { opacity: 1 }], {
				duration: 150
			})
		} else
			void loadAnimate().then(animate =>
				animate(t, next ? 1 : 0, { duration: 0.7, ease: EASE })
			)
	}

	const washOpacity = useTransform(() => 1 - t.get())
	const failed = n >= bailAt
	const shownHover = hover ?? (rangeFocus ? n : undefined)

	// the 5.9 label never sits on top of the 5.8 one: it drops below, on a leader
	const sep = 38
	const afterLabelAt = useTransform(
		() =>
			`translate(${a.headX.get()}, min(max(${a.headY.get()}, calc(${b.headY.get()} + ${sep}px)), calc(100cqh - 15px)))`
	)
	const leaderHeight = useTransform(
		() =>
			`max(0px, min(calc(${b.headY.get()} + ${sep}px), calc(100cqh - 15px)) - ${a.headY.get()})`
	)
	const beforeDotAt = useTransform(
		() => `${b.at.get()} translateX(${shake.get()}px)`
	)

	// "×2.995 per link" rides the midpoint of 5.8's newest segment
	const linkAt = useTransform(() => {
		const h = Math.min(head.get(), lastPlotted)
		const d = liveDomain(s)
		const y1 = yFrac(valueAt(beforeValues, h), d, t.get())
		const y0 = yFrac(valueAt(beforeValues, Math.max(1, h - 1)), d, t.get())
		return `translate(${cqw((xAt(h) + xAt(h - 1)) / 2)}, ${cqh(1 - (y0 + y1) / 2)})`
	})

	// the TS2589 squiggle: point 12 to a ring on the top edge at x = 13
	const squigglePath = useTransform(() => {
		if (nMV.get() < bailAt) return ""
		const d = liveDomain(s)
		const { w, h } = size.get()
		const x0 = xAt(lastPlotted) * w
		const y0 = (1 - yFrac(beforeValues[lastPlotted - 1]!, d, t.get())) * h
		const x1 = xAt(bailAt) * w - 5
		const y1 = 0
		const len = Math.hypot(x1 - x0, y1 - y0)
		const ux = (x1 - x0) / len
		const uy = (y1 - y0) / len
		const drawn = Math.min(len, 2000) * squiggle.get()
		let path = `M${x0} ${y0}`
		for (let at = 1.5, k = 0; at <= drawn; at += 1.5, k++) {
			const amp = [0, 2, 0, -2][k % 4]!
			path += `L${(x0 + ux * at - uy * amp).toFixed(2)} ${(y0 + uy * at + ux * amp).toFixed(2)}`
		}
		return path
	})
	const ringOpacity = useTransform((): number =>
		squiggle.get() > 0.95 ? 1 : 0
	)

	const yTicks = linearTicks(tickMax)
	const oldTicks =
		oldTickMax && oldTickMax !== tickMax ?
			linearTicks(oldTickMax).filter(v => !yTicks.includes(v))
		:	[]

	const newest = CHAIN_OFFSET + n
	const codeCss = `.chain-code>pre>code>.line:nth-child(n+${newest + 1}){opacity:.16}${
		flash ?
			`.chain-code>pre>code>.line:nth-child(${newest}){animation:chain-new 1.2s var(--ease-out)}`
		:	""
	}`
	// links not yet written are inert: their cN hovers neither open (a popup would inherit
	// the ghost's .16 opacity) nor take a tab stop. Effect-only, so the prerender is untouched.
	useEffect(() => {
		code.current
			?.querySelectorAll(":scope > pre > code > .line")
			.forEach((line, i) => line.toggleAttribute("inert", i >= newest))
	}, [newest])

	return (
		<figure
			className="merge"
			aria-labelledby={`${uid}-cap`}
			data-failed={failed || undefined}
			data-instant={instant || undefined}
		>
			<figcaption id={`${uid}-cap`} className="merge-kicker">
				<a
					className="link mono"
					href="https://x.com/ssalbdivad/status/1905392450442568080"
				>
					"in case anyone was curious what O(3^N) looks like"
				</a>
				<span className="sr-only">
					: type instantiations for chained .merge() calls, TypeScript 5.8.2 vs
					5.9.3
				</span>
			</figcaption>

			<div className="merge-grid">
				<div className="merge-left">
					{/* prerendered open (desktop shows the bench); the script below closes it on
					    ≤1023px before first paint, so a #hash link further down lands on its
					    heading instead of 560-620px past it once the effect would have closed it */}
					<details
						className="merge-code"
						open={codeOpen}
						onToggle={e =>
							setCodeOpen((e.currentTarget as HTMLDetailsElement).open)
						}
						suppressHydrationWarning
					>
						<summary className="mono">show the bench</summary>
						<div className="merge-code-head mono">
							<span>
								<b>bench</b> · chained
							</span>
							<span className="tnum">
								{n} {n === 1 ? "call" : "calls"}
							</span>
						</div>
						<style>{codeCss}</style>
						<div
							ref={code}
							className="code chain-code"
							dangerouslySetInnerHTML={{ __html: chainHtml }}
						/>
					</details>
					<script dangerouslySetInnerHTML={{ __html: closeOnNarrow }} />
					<Readouts n={n} failed={failed} />
				</div>

				<div className="merge-right">
					<div className="merge-head">
						<div className="legend mono" aria-hidden>
							<span>
								<i className="key v-before" /> TS 5.8.2
							</span>
							<span>
								<i className="key v-after" /> TS 5.9.3
							</span>
						</div>
						<div className="seg" role="radiogroup" aria-label="y-axis scale">
							{(["linear", "log"] as const).map(mode => (
								<button
									key={mode}
									type="button"
									role="radio"
									aria-checked={(mode === "log") === log}
									tabIndex={(mode === "log") === log ? 0 : -1}
									onClick={() => toggleLog(mode === "log")}
									onKeyDown={e => {
										if (
											[
												"ArrowLeft",
												"ArrowRight",
												"ArrowUp",
												"ArrowDown"
											].includes(e.key)
										) {
											e.preventDefault()
											toggleLog(!log)
											;(
												e.currentTarget.parentElement?.querySelector(
													`[aria-checked="false"]`
												) as HTMLElement
											)?.focus()
										}
									}}
								>
									{mode}
								</button>
							))}
						</div>
					</div>

					<div className="merge-chart" data-log={log || undefined}>
						<span className="y-title mono">type instantiations</span>
						<div className="ticks" aria-hidden>
							{yTicks.map(v => (
								<Tick key={`l${v}`} v={v} s={s} mode="linear" />
							))}
							{oldTicks.map(v => (
								<Tick key={`o${v}`} v={v} s={s} mode="linear" fading />
							))}
							{decades(LOG_FLOOR, LOG_CEIL).map(v => (
								<Tick key={`g${v}`} v={v} s={s} mode="log" />
							))}
						</div>

						<div
							className="plot"
							ref={plot}
							role="img"
							aria-labelledby={`${uid}-cap`}
							aria-describedby={`${uid}-desc`}
							onPointerMove={e => {
								if (e.pointerType !== "mouse") return
								const r = e.currentTarget.getBoundingClientRect()
								const f = (e.clientX - r.left) / r.width
								setHover(
									Math.max(
										1,
										Math.min(maxCalls, Math.round(f * (maxCalls - 1)) + 1)
									)
								)
							}}
							onPointerLeave={() => setHover(undefined)}
						>
							<svg
								className="lines"
								viewBox="0 0 1000 1000"
								preserveAspectRatio="none"
								aria-hidden
							>
								<Live
									as="path"
									className="area v-before"
									attrs={{ d: b.area }}
									style={{ opacity: washOpacity }}
								/>
								<Live
									as="path"
									className="line v-before"
									attrs={{ d: b.line }}
									vectorEffect="non-scaling-stroke"
								/>
								<Live
									as="path"
									className="line v-after"
									attrs={{ d: a.line }}
									vectorEffect="non-scaling-stroke"
								/>
							</svg>

							{failed && (
								<svg
									className="squiggle-path"
									width="100%"
									height="100%"
									aria-hidden
								>
									<Live as="path" attrs={{ d: squigglePath }} />
								</svg>
							)}
							{failed && (
								<span
									className="mark"
									style={{ transform: `translateX(${cqw(xAt(bailAt))})` }}
									aria-hidden
								>
									<Live
										as="span"
										className="ring"
										style={{ opacity: ringOpacity }}
									>
										<span className="ring-label mono">TS2589</span>
									</Live>
								</span>
							)}

							{n >= 6 && !failed && (
								<Live
									as="span"
									className="mark"
									style={{ transform: linkAt }}
									aria-hidden
								>
									<span className="per-link mono">×{perLink(n)} per link</span>
								</Live>
							)}

							<p className="log-note" aria-hidden={!log}>
								{logNote}
							</p>

							{shownHover !== undefined && (
								<Crosshair i={shownHover} n={n} s={s} />
							)}

							<Live
								as="span"
								className="mark"
								style={{ transform: beforeDotAt }}
								aria-hidden
							>
								<span className="dot v-before" />
							</Live>
							<Live
								as="span"
								className="mark"
								style={{ transform: a.at }}
								aria-hidden
							>
								<span className="dot v-after" />
								<Live
									as="span"
									className="leader"
									style={{ height: leaderHeight }}
								/>
							</Live>

							{!failed && (
								<Live
									as="span"
									className="mark"
									style={{ transform: b.at }}
									aria-hidden
								>
									<span className="end-label">
										<b className="tnum">
											{fmt(beforeValues[Math.min(n, lastPlotted) - 1]!)}
										</b>
										<span>TS 5.8.2</span>
									</span>
								</Live>
							)}
							<Live
								as="span"
								className="mark"
								style={{ transform: afterLabelAt }}
								aria-hidden
							>
								<span className="end-label">
									<b className="tnum">{fmt(afterValues[n - 1]!)}</b>
									<span>TS 5.9.3</span>
								</span>
							</Live>
						</div>

						<div className="x-axis mono" aria-hidden>
							{[1, 5, 10, 15].map(k => (
								<span
									key={k}
									style={{ left: pct(xAt(k)) }}
									data-near={Math.abs(k - n) === 1 || undefined}
									data-hidden={k === n || undefined}
								>
									{k}
								</span>
							))}
							<span
								className="x-now"
								style={{ transform: `translateX(${cqw(xAt(n))})` }}
							>
								{n}
							</span>
							<span className="x-title">calls</span>
						</div>

						<input
							className="scrub"
							type="range"
							min={1}
							max={maxCalls}
							step={1}
							value={n}
							aria-label="chained .merge() calls"
							aria-valuetext={`${n} ${n === 1 ? "call" : "calls"}`}
							onChange={e => user(Number(e.currentTarget.value))}
							onFocus={e =>
								setRangeFocus(e.currentTarget.matches(":focus-visible"))
							}
							onBlur={() => setRangeFocus(false)}
						/>
					</div>

					<div className="merge-controls">
						{/* aria-disabled, not disabled: a button that disables itself drops focus to <body> */}
						<button
							type="button"
							className="btn btn-ghost mono"
							aria-disabled={n <= 1}
							onClick={() => n > 1 && user(nRef.current - 1)}
						>
							− .merge()
						</button>
						<button
							ref={wiggle}
							type="button"
							className="btn btn-gold mono plus"
							aria-disabled={n >= maxCalls}
							aria-describedby={n >= maxCalls ? `${uid}-cpu` : undefined}
							onClick={() => n < maxCalls && user(nRef.current + 1)}
						>
							+ .merge()
						</button>
						{n >= maxCalls ?
							<span className="keep-going mono" id={`${uid}-cpu`} data-on>
								16 is left as an exercise for your CPU
							</span>
						:	<span
								className="keep-going mono"
								data-on={nudge || undefined}
								aria-hidden
							>
								{/* a box of its own, so phones can turn it to point up at the + pill */}
								<span className="kg-arrow">←</span> keep going
							</span>
						}
						<button
							type="button"
							className="btn btn-ghost reset"
							aria-label="reset to 1 call"
							aria-disabled={n === 1}
							onClick={() => n > 1 && user(1)}
						>
							↺
						</button>
					</div>
					{/* phones: the in-plot note would sit on the 5.8 line and its end label */}
					{log && <p className="log-note-m mono">{logNote}</p>}

					<Figure n={n} failed={failed} />
				</div>
			</div>

			<p id={`${uid}-desc`} className="sr-only">
				{describe}
			</p>
			<p className="sr-only" aria-live="polite">
				{announce}
			</p>
			<p className="merge-foot">
				Instantiation counts from <code>@ark/attest</code> {MERGE.attest}:
				deterministic. Bench from{" "}
				<a
					className="link ext"
					href="https://github.com/microsoft/TypeScript/pull/61505#issuecomment-2768089049"
				>
					microsoft/TypeScript#61505
				</a>
				; re-run on {MERGE.before.version} and {MERGE.after.version},{" "}
				{measuredDay}.
			</p>
			<ChainTable />
		</figure>
	)
}

const Tick = ({
	v,
	s,
	mode,
	fading
}: {
	v: number
	s: Scale
	mode: "linear" | "log"
	fading?: boolean
}) => {
	const at = useTransform(
		() => `translateY(${cqh(1 - yFrac(v, liveDomain(s), s.t.get()))})`
	)
	const opacity = useTransform(() => {
		const f = yFrac(v, liveDomain(s), s.t.get())
		if (f > 1.001 || f < -0.001) return 0
		return mode === "log" ? s.t.get() : 1 - s.t.get()
	})
	return (
		<Live
			as="span"
			className="tick"
			style={{ transform: at, opacity }}
			data-fading={fading || undefined}
		>
			<span className="tnum">{formatTick(v)}</span>
		</Live>
	)
}

const Crosshair = ({ i, n, s }: { i: number; n: number; s: Scale }) => {
	const failedAt = i >= bailAt
	const ghost = i > n
	const x = xAt(i)
	const by = useTransform(
		() =>
			`translate(${cqw(x)}, ${cqh(1 - yFrac(beforeValues[i - 1]!, liveDomain(s), s.t.get()))})`
	)
	const ay = useTransform(
		() =>
			`translate(${cqw(x)}, ${cqh(1 - yFrac(afterValues[i - 1]!, liveDomain(s), s.t.get()))})`
	)
	return (
		<>
			<span className="crosshair" style={{ left: pct(x) }} aria-hidden />
			{ghost && !failedAt && (
				<Live as="span" className="mark" style={{ transform: by }} aria-hidden>
					<span className="ghost" />
				</Live>
			)}
			{ghost && (
				<Live as="span" className="mark" style={{ transform: ay }} aria-hidden>
					<span className="ghost" />
				</Live>
			)}
			<span
				className="chart-tip mono tnum"
				data-flip={x > 0.6 || undefined}
				style={{ left: pct(x) }}
				aria-hidden
			>
				<span className="tip-row">
					<b>{failedAt ? "TS2589 · gave up" : fmt(beforeValues[i - 1]!)}</b>
					<span>
						<i className="key v-before" />
						TS 5.8.2
					</span>
				</span>
				<span className="tip-row">
					<b>{fmt(afterValues[i - 1]!)}</b>
					<span>
						<i className="key v-after" />
						TS 5.9.3
					</span>
				</span>
				<span className="tip-foot">
					{failedAt ?
						`${i} calls`
					:	`${ratioAt(i)}× fewer · ${i} ${i === 1 ? "call" : "calls"}`}
				</span>
			</span>
		</>
	)
}

const Readouts = ({ n, failed }: { n: number; failed: boolean }) => {
	const width = fmt(beforeValues[lastPlotted - 1]!).length
	return (
		<div className="attest mono tnum" role="group" aria-label="attest output">
			<div className="attest-row" data-key="before">
				<i className="key v-before" />
				<span className="v">TS {MERGE.before.version}</span>
				<span className="swap" key={failed ? "err" : "ok"}>
					{failed ?
						<span className="err">
							✕ error TS2589: Type instantiation is{" "}
							<span className="squiggle">excessively deep</span> and possibly
							infinite.
						</span>
					:	<>
							⛳ Result: <b>{fmt(beforeValues[n - 1]!).padStart(width, " ")}</b>
							<span className="unit"> instantiations</span>
						</>
					}
				</span>
			</div>
			<div className="attest-row" data-key="after">
				<i className="key v-after" />
				<span className="v">TS {MERGE.after.version}</span>
				<span className="swap">
					⛳ Result: <b>{fmt(afterValues[n - 1]!).padStart(width, " ")}</b>
					<span className="unit"> instantiations</span>
				</span>
			</div>
		</div>
	)
}

const Figure = ({ n, failed }: { n: number; failed: boolean }) => (
	<div className="merge-figure" aria-hidden>
		<span className="fig-value" key={failed ? "f" : "ok"}>
			{failed ? "5.8 gave up." : `${ratioAt(n)}×`}
		</span>
		<span className="fig-sub">
			{failed ?
				`5.9 is at ${fmt(afterValues[n - 1]!)} and counting.`
			:	`fewer instantiations at ${n} ${n === 1 ? "call" : "calls"}`}
		</span>
	</div>
)

const ChainTable = () => (
	<details className="viz-table twin">
		<summary>Data</summary>
		<div className="viz-table-scroll">
			<table className="mono tnum">
				<caption>
					Type instantiations by number of .merge() calls (attest {MERGE.attest}
					). "TS2589" means the checker bailed; the count it reported is in
					parentheses and isn't real work.
				</caption>
				<thead>
					<tr>
						<th scope="col">calls</th>
						<th scope="col">chained 5.8.2</th>
						<th scope="col">chained 5.9.3</th>
						<th scope="col">functional 5.8.2</th>
						<th scope="col">functional 5.9.3</th>
					</tr>
				</thead>
				<tbody>
					{after.map((p, i) => (
						<tr key={p.calls}>
							<th scope="row">{p.calls}</th>
							<Cell p={MERGE.before.chained[i]!} />
							<Cell p={p} />
							<Cell p={MERGE.before.functional[i]!} />
							<Cell p={MERGE.after.functional[i]!} />
						</tr>
					))}
				</tbody>
			</table>
		</div>
	</details>
)

const Cell = ({ p }: { p: { instantiations: number; ts2589: boolean } }) =>
	p.ts2589 ?
		<td className="bailed">
			TS2589
			<br />({fmt(p.instantiations)})
		</td>
	:	<td>{fmt(p.instantiations)}</td>
