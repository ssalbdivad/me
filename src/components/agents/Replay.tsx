import {
	useMotionValue,
	useMotionValueEvent,
	useReducedMotion,
	type AnimationPlaybackControls
} from "motion/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { loadAnimate, warmAnimate } from "~/viz/animate"
import { Braid } from "./Braid"
import { layout } from "./geometry"
import {
	allTicks,
	clock,
	countUpTo,
	data,
	duration,
	events,
	groups,
	phases,
	plural,
	rootWaits,
	sessionDay,
	strands,
	total,
	totals
} from "./model"

const playSeconds = 8
const captionMs = 2400

/**
 * David's rules, each paraphrased from the "Working here (David)" list in
 * his Ntwine AGENTS.md (commit 35f616c6). Rules that trace to Colin
 * McDonnell's Frizz design (the queue, the board, the worker contract, the
 * agent completion invariant) are deliberately left out: the intro credits
 * that design to Frizz instead. Array order matters: the replay's captions
 * play them in this order, cued by the session itself (see `cues`).
 */
export const principles = [
	{
		n: "01",
		title: "Size work by scope, never in days.",
		body: "Agents do the building, so hours are the wrong unit. Scope is the code paths a change touches, its risk, and what needs a human decision."
	},
	{
		n: "02",
		title: "Report honest effect sizes.",
		body: "Say how strong a claim is right next to it, and treat pushback as a bug report on the measurement before defending the result. (The case studies above say which numbers are single runs.)"
	},
	{
		n: "03",
		title: "Lead with what changed.",
		body: "An agent's report leads with what changed or what is true. The why goes in the commit message and code comments, where the next reader will find it- not in the chat."
	},
	{
		n: "04",
		title: "Preserve evidence.",
		body: "Never delete or rewrite a stored measurement. Experiments are temporary: record the conclusion and its numbers, then delete the harness."
	}
] as const

const h = layout("h")
const v = layout("v")
/** both layouts share one compressed time axis; this maps p → seconds */
const timeAt = (p: number) => (p >= 1 ? total : h.toTime(h.playhead(p)))
const pAt = (s: number) => {
	let lo = 0
	let hi = 1
	for (let i = 0; i < 30; i++) {
		const mid = (lo + hi) / 2
		if (timeAt(mid) < s) lo = mid
		else hi = mid
	}
	return hi
}

/**
 * When each principle surfaces during the replay, always in numeric order:
 * 01 (scope) at the first fan-out, 02 (effect sizes) while the root waits on
 * its sub-agents, 03 (lead with what changed: a report) at the next hand-back
 * after that, and 04 (preserve evidence) at the end, where the replay itself
 * is a stored measurement. Each gets a caption's length before the next.
 */
const cues = (() => {
	const gap = captionMs / 1000 / playSeconds
	const first = groups[0] ? pAt(groups[0].s0) : 0
	const waiting = rootWaits
		.map(w => ({ a: pAt(w.s0), b: pAt(w.s1) }))
		.find(w => w.b > first + gap)
	const wait = Math.max(waiting?.a ?? 0, first + gap)
	// the first hand-back once 02 has had its turn, so 03 lands on a report in the readout
	const ready = timeAt(wait + gap)
	const handBack = strands
		.filter(s => s.done && s.s1 >= ready)
		.sort((a, b) => a.s1 - b.s1)[0]
	const back = handBack ? Math.max(pAt(handBack.s1), wait + gap) : wait + gap
	// late cues are pulled earlier together, so the order (and the spacing) survives any session;
	// 04 waits for 03's turn to end (see onComplete)
	const at = [first, wait, back].map((a, i, all) =>
		Math.min(a, 0.99 - (all.length - 1 - i) * gap)
	)
	return [
		...at.map((a, principle) => ({ at: a, principle })),
		{ at: 1, principle: 3 }
	]
})()

const latestEvent = (s: number) => {
	let i = -1
	while (i + 1 < events.length && events[i + 1]!.s <= s) i++
	return i
}

const running = (s: number) => strands.filter(x => x.s0 <= s && s < x.s1).length

export const Replay = () => {
	const p = useMotionValue(1)
	const reduce = useReducedMotion()
	const [cursor, setCursor] = useState(Number.POSITIVE_INFINITY)
	const [event, setEvent] = useState(events.length - 1)
	const [caption, setCaption] = useState<number>()
	const [playing, setPlaying] = useState(false)
	/** paused mid-way resumes from the scrub point, so the button only says "Replay" at the end */
	const [atEnd, setAtEnd] = useState(true)
	const [ready, setReady] = useState(false)
	const figure = useRef<HTMLElement>(null)
	const clockRef = useRef<HTMLSpanElement>(null)
	const tallyRef = useRef<HTMLSpanElement>(null)
	const range = useRef<HTMLInputElement>(null)
	const controls = useRef<AnimationPlaybackControls>(undefined)
	const captionTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
	const endTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
	const captionAt = useRef(Number.NEGATIVE_INFINITY)
	const last = useRef(1)

	const sync = (value: number, fromPlayback: boolean) => {
		const s = timeAt(value)
		const done = value >= 1
		setAtEnd(done)
		const i = latestEvent(s)
		setEvent(i)
		setCursor(done ? Number.POSITIVE_INFINITY : (events[i]?.s ?? -1))
		if (clockRef.current) clockRef.current.textContent = clock(s)
		if (tallyRef.current)
			tallyRef.current.textContent =
				done ?
					`${totals.subAgents} sub-agents · ${totals.toolCalls.toLocaleString("en")} tool calls · ${duration(total)} wall clock`
				:	`${plural(running(s), "sub-agent")} running · ${plural(countUpTo(allTicks, s), "tool call")} so far`
		if (range.current) {
			// always: a scrub sets p to exactly this value, so writing it back can't fight a drag,
			// and skipping it while focused froze the slider and made the next arrow key rewind
			range.current.value = String(Math.round(value * 1000))
			range.current.setAttribute("aria-valuetext", `${clock(s)} UTC`)
		}
		if (fromPlayback) {
			const cue = cues.find(
				c => c.at < 1 && last.current < c.at && c.at <= value
			)
			if (cue) showCaption(cue.principle)
		}
		last.current = value
	}

	const showCaption = (principle: number) => {
		captionAt.current = performance.now()
		setCaption(principle)
		clearTimeout(captionTimer.current)
		captionTimer.current = setTimeout(() => setCaption(undefined), captionMs)
	}

	useMotionValueEvent(p, "change", value => sync(value, !!controls.current))

	const play = async () => {
		const animate = await loadAnimate()
		clearTimeout(endTimer.current)
		const from = p.get() >= 1 ? 0 : p.get()
		p.set(from)
		last.current = from
		setPlaying(true)
		controls.current = animate(p, 1, {
			duration: playSeconds * (1 - from),
			ease: "linear",
			onComplete: () => {
				controls.current = undefined
				setPlaying(false)
				// the end: the replay you just watched is itself a stored measurement
				// (once 03, if it landed late, has had its full turn)
				const wait = Math.max(
					0,
					captionAt.current + captionMs - performance.now()
				)
				endTimer.current = setTimeout(
					() => showCaption(cues.at(-1)!.principle),
					wait
				)
			}
		})
	}
	const pause = () => {
		controls.current?.stop()
		controls.current = undefined
		setPlaying(false)
	}

	useEffect(() => {
		setReady(true)
		const el = figure.current
		if (!el || reduce) return
		let primed = false
		// a big on-screen slice counts too: on a landscape phone the figure is
		// several viewports tall and never reaches 40% of itself
		const enough = (e: IntersectionObserverEntry) =>
			e.intersectionRatio >= 0.4 ||
			e.intersectionRect.height >= innerHeight * 0.4
		const io = new IntersectionObserver(
			entries => {
				const entry = entries[0]
				if (!entry) return
				if (!primed) {
					primed = true
					// already on screen at load: leave it complete rather than rewinding under the reader
					if (enough(entry)) {
						io.disconnect()
						return
					}
					p.set(0)
					sync(0, false)
					warmAnimate()
					return
				}
				if (enough(entry)) {
					io.disconnect()
					void play()
				}
			},
			{ threshold: [0, 0.1, 0.2, 0.3, 0.4] }
		)
		io.observe(el)
		return () => {
			io.disconnect()
			controls.current?.stop()
			clearTimeout(captionTimer.current)
			clearTimeout(endTimer.current)
		}
	}, [reduce])

	const shown = events[event]
	const endClock = clock(total)
	const legend = useMemo(
		() =>
			phases
				.map(ph => ({ ph, n: strands.filter(s => s.phase === ph).length }))
				.filter(x => x.n),
		[]
	)

	return (
		<>
			<figure className="replay" ref={figure} aria-labelledby="replay-cap">
				<div className="replay-top">
					<p
						className="replay-caption"
						aria-hidden="true"
						data-on={caption !== undefined}
					>
						{caption !== undefined && (
							<>
								<span className="mono">// {principles[caption]!.n}</span>{" "}
								{principles[caption]!.title}
							</>
						)}
					</p>
					<ul className="replay-legend" aria-label="phases">
						{legend.map(({ ph, n }) => (
							<li key={ph} className={`ph-${ph}`}>
								{ph} <span className="tnum">{n}</span>
							</li>
						))}
						<li className="legend-tick">tool call</li>
					</ul>
				</div>

				<Braid
					l={h}
					p={p}
					cursor={cursor}
					describedBy="replay-desc"
					className="only-wide"
				/>
				<Braid
					l={v}
					p={p}
					cursor={cursor}
					describedBy="replay-desc"
					className="only-narrow"
				/>
				<p id="replay-desc" className="sr-only">
					A braid of the session that built this page. One root thread,{" "}
					{data.root.label}, fans out to {totals.subAgents} sub-agents across{" "}
					{totals.phases.join(", ")}; each strand's length is its real duration
					and each tick is one tool call. The table below lists every strand.
				</p>

				<div className="replay-readout mono tnum">
					<span className="ro-line">
						<span className="ro-clock" ref={clockRef}>
							{endClock}
						</span>
						<span
							className={`ro-event ${shown?.phase ? `ph-${shown.phase}` : ""}`}
						>
							{shown?.text}
						</span>
					</span>
					<span className="ro-tally" ref={tallyRef}>
						{totals.subAgents} sub-agents ·{" "}
						{totals.toolCalls.toLocaleString("en")} tool calls ·{" "}
						{duration(total)} wall clock
					</span>
				</div>

				<div className="replay-controls">
					<button
						type="button"
						className="btn btn-ghost btn-sm replay-play"
						disabled={!ready}
						onClick={() => (playing ? pause() : play())}
					>
						{playing ?
							"Pause"
						: atEnd ?
							"Replay"
						:	"Play"}
					</button>
					<label className="replay-scrub">
						<span className="sr-only">Replay position</span>
						<input
							ref={range}
							type="range"
							min={0}
							max={1000}
							step={1}
							defaultValue={1000}
							disabled={!ready}
							aria-valuetext={`${endClock} UTC`}
							onInput={e => {
								pause()
								p.set(Number(e.currentTarget.value) / 1000)
							}}
						/>
					</label>
					<span className="replay-utc mono">UTC · {sessionDay}</span>
				</div>
				<figcaption id="replay-cap" className="sr-only">
					Replay of the agent session that built this page
				</figcaption>
			</figure>
		</>
	)
}
