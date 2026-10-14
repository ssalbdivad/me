import {
	useMotionValue,
	useTransform,
	type AnimationPlaybackControls
} from "motion/react"
import { useEffect, useRef, useState } from "react"
import { VIEM_TRACE } from "~/data/caseStudies"
import { formatNumber } from "~/lib/format"
import { isOnscreen, prefersReducedMotion } from "~/lib/motion"
import { loadAnimate, warmAnimate } from "~/viz/animate"
import { Live } from "~/viz/Live"
import { pct } from "~/viz/scale"

const [, DOMAIN] = VIEM_TRACE.domainMs
const BEFORE = VIEM_TRACE.before.ms
const AFTER = VIEM_TRACE.after.ms
const at = (ms: number) => pct(ms / DOMAIN)
const ruler = [0, 500, 1000, 1500, 2000]
const rulerLabel = (ms: number) =>
	ms === 0 ? "0ms"
	: ms < 1000 ? `${ms}`
	: `${(ms / 1000).toFixed(1)}s`

/**
 * A Perfetto-style trace strip, played back at 1×: the violet slice grows in
 * exactly as many milliseconds as the compiler spent on it. Linear on purpose-
 * any easing or speed-up would misstate the duration.
 */
export const ViemTrace = () => {
	const ref = useRef<HTMLElement>(null)
	const before = useMotionValue<number>(BEFORE)
	const after = useMotionValue<number>(AFTER)
	/** which track the playhead is on, or -1 when idle */
	const [playing, setPlaying] = useState<-1 | 0 | 1>(-1)
	const [canReplay, setCanReplay] = useState(false)
	const lane = useMotionValue(0)
	const run = useRef<AnimationPlaybackControls>(undefined)
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

	// each slice is drawn at its full width and revealed by clip-path: paint only, no layout
	const reveal = (mv: typeof before, full: number) =>
		`inset(0 ${((1 - mv.get() / full) * 100).toFixed(3)}% 0 0 round 3px)`
	const beforeClip = useTransform(() => reveal(before, BEFORE))
	const afterClip = useTransform(() => reveal(after, AFTER))
	const now = () => (lane.get() ? after.get() : before.get())
	const headAt = useTransform(
		() => `translateX(${((now() / DOMAIN) * 100).toFixed(3)}cqw)`
	)
	const elapsed = useTransform(() => `${formatNumber(Math.round(now()))} ms`)
	const markerLabel = useTransform((): number =>
		after.get() >= AFTER - 0.5 ? 1 : 0
	)

	const play = async () => {
		// aria-disabled rather than disabled while playing, so a keyboard user's focus stays put
		if (playing >= 0) return
		const animate = await loadAnimate()
		run.current?.stop()
		clearTimeout(timer.current)
		before.set(0)
		after.set(0)
		setPlaying(0)
		lane.set(0)
		run.current = animate(before, BEFORE, {
			duration: BEFORE / 1000,
			ease: "linear",
			onComplete: () => {
				timer.current = setTimeout(() => {
					setPlaying(1)
					lane.set(1)
					run.current = animate(after, AFTER, {
						duration: AFTER / 1000,
						ease: "linear",
						onComplete: () => {
							setPlaying(-1)
							setCanReplay(true)
						}
					})
				}, 400)
			}
		})
	}

	useEffect(() => {
		const el = ref.current
		if (!el || prefersReducedMotion()) return
		if (isOnscreen(el)) {
			setCanReplay(true)
			return
		}
		before.set(0)
		after.set(0)
		warmAnimate()
		const io = new IntersectionObserver(
			([entry]) => {
				if (!entry || entry.intersectionRatio < 0.6) return
				io.disconnect()
				void play()
			},
			{ threshold: 0.6 }
		)
		io.observe(el)
		return () => {
			io.disconnect()
			run.current?.stop()
			clearTimeout(timer.current)
		}
	}, [])

	return (
		<figure className="trace" ref={ref} aria-labelledby="viem-cap">
			<figcaption id="viem-cap" className="sr-only">
				Trace of MUD's build: one viem type's variance computation before, the
				whole file after.
			</figcaption>
			<div
				className="trace-body"
				role="img"
				aria-labelledby="viem-cap"
				aria-describedby="viem-desc"
				data-playing={playing >= 0 || undefined}
			>
				<div className="trace-ruler mono" aria-hidden>
					{ruler.map(ms => (
						<span
							key={ms}
							style={{ left: at(ms) }}
							data-minor={ms % 1000 ? true : undefined}
						>
							{rulerLabel(ms)}
						</span>
					))}
				</div>
				<div className="trace-grid" aria-hidden>
					{ruler.map(ms => (
						<span key={ms} style={{ left: at(ms) }} />
					))}
				</div>

				<div className="track" data-track="before">
					<span className="track-label mono">before</span>
					<div className="lane">
						<div className="slice parent">
							<span className="slice-name mono">
								{VIEM_TRACE.beforeParent.name} · {VIEM_TRACE.beforeParent.file}
							</span>
							<span className="slice-bar" />
							<span className="unpublished mono">total not published</span>
						</div>
						<div
							className="slice violet"
							style={{ "--w": at(BEFORE) } as React.CSSProperties}
						>
							<span className="slice-name mono">
								{VIEM_TRACE.before.name} · {VIEM_TRACE.before.subject}
							</span>
							<Live
								as="span"
								className="slice-bar"
								style={{ clipPath: beforeClip }}
							>
								<span className="slice-name mono" aria-hidden>
									{VIEM_TRACE.before.name} · {VIEM_TRACE.before.subject}
								</span>
							</Live>
							<span className="dur mono tnum" style={{ left: at(BEFORE) }}>
								{formatNumber(BEFORE)} ms
							</span>
						</div>
					</div>
				</div>

				<div className="track" data-track="after">
					<span className="track-label mono">after</span>
					<div className="lane">
						<div
							className="slice teal"
							style={{ "--w": at(AFTER) } as React.CSSProperties}
						>
							<span className="slice-name mono">
								{VIEM_TRACE.after.name} · {VIEM_TRACE.after.file} (annotated)
							</span>
							<Live
								as="span"
								className="slice-bar"
								style={{ clipPath: afterClip }}
							>
								<span className="slice-name mono" aria-hidden>
									{VIEM_TRACE.after.name} · {VIEM_TRACE.after.file} (annotated)
								</span>
							</Live>
							<span className="dur mono tnum" style={{ left: at(AFTER) }}>
								{formatNumber(AFTER)} ms
							</span>
						</div>
					</div>
				</div>

				<div className="trace-overlay" aria-hidden>
					<span className="marker" style={{ left: at(AFTER) }}>
						<Live
							as="span"
							className="marker-label mono"
							style={{ opacity: markerLabel }}
						>
							the whole file, after
						</Live>
					</span>
					{playing >= 0 && (
						<Live as="span" className="playhead" style={{ transform: headAt }}>
							<Live as="span" className="elapsed mono tnum" text={elapsed} />
						</Live>
					)}
				</div>
			</div>
			<div className="trace-foot">
				{/* only true when something plays: hidden (space kept) under reduced motion and
				    without JS, shown during the first playback and whenever a replay is offered */}
				<span
					className="mono"
					style={
						canReplay || playing >= 0 ? undefined : { visibility: "hidden" }
					}
				>
					played back in real time
				</span>
				{/* always laid out, so its arrival doesn't shift the caption */}
				<button
					type="button"
					className="btn btn-ghost btn-sm"
					style={canReplay ? undefined : { visibility: "hidden" }}
					onClick={() => void play()}
					aria-disabled={playing >= 0}
				>
					▶ replay at 1×
				</button>
			</div>
			<p id="viem-desc" className="sr-only">
				Trace comparison. Before: one type's variance computation,
				getVariancesWorker, took 1,866 milliseconds. After adding variance
				annotations, the whole file setupNetwork.ts checked in 1,288
				milliseconds.
			</p>
			<details className="viz-table twin">
				<summary>Data</summary>
				<div className="viz-table-scroll">
					<table className="mono tnum">
						<thead>
							<tr>
								<th scope="col">track</th>
								<th scope="col">slice</th>
								<th scope="col">duration</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<th scope="row">before</th>
								<td className="text">checkSourceFile · setupNetwork.ts</td>
								<td>not published</td>
							</tr>
							<tr>
								<th scope="row">before</th>
								<td className="text">
									getVariancesWorker · SimulateContractReturnType (9 type
									parameters)
								</td>
								<td>1,866 ms</td>
							</tr>
							<tr>
								<th scope="row">after</th>
								<td className="text">
									checkSourceFile · setupNetwork.ts (annotated)
								</td>
								<td>1,288 ms</td>
							</tr>
						</tbody>
					</table>
				</div>
			</details>
		</figure>
	)
}
