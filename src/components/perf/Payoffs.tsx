import { useRef } from "react"
import type { ClaimId } from "~/data/claims"
import { TS59_PAYOFFS } from "~/data/caseStudies"
import { truncFixed } from "~/lib/format"
import { pct } from "~/viz/scale"
import { Claim } from "../Quickinfo"
import { useEntrance } from "./useEntrance"

/** the shared axis runs a little past 100% so AnswerOverflow's slowest runs stay on it */
const AXIS_MAX = 110
const at = (pctOfBefore: number) => pct(pctOfBefore / AXIS_MAX)
const mean = (xs: readonly number[]) =>
	xs.reduce((a, b) => a + b, 0) / xs.length

const claimIds: Record<(typeof TS59_PAYOFFS)[number]["id"], ClaimId> = {
	trpc: "ts59Trpc",
	answeroverflow: "ts59AnswerOverflow",
	klarna: "ts59Klarna"
}

const rows = TS59_PAYOFFS.map(row => {
	const before = "beforeRuns" in row ? mean(row.beforeRuns) : row.before
	const after = "afterRuns" in row ? mean(row.afterRuns) : row.after
	return {
		...row,
		before,
		after,
		share: (after / before) * 100,
		// truncated, never rounded up: 13.04 / 6.00 = 2.17 reads 2.1×
		speedup: truncFixed(before / after, 1),
		runs:
			"beforeRuns" in row ?
				{
					before: row.beforeRuns.map(r => (r / before) * 100),
					after: row.afterRuns.map(r => (r / before) * 100)
				}
			:	undefined
	}
})

const seconds = (v: number) => `${truncFixed(v, 2)}s`

/** "What it did to real apps": each row indexed to its own TS 5.8 time = 100%. */
export const Payoffs = () => {
	const ref = useRef<HTMLElement>(null)
	const phase = useEntrance(ref, 0.35)
	return (
		<figure
			className="payoffs"
			ref={ref}
			data-phase={phase}
			aria-labelledby="payoffs-title"
			aria-describedby="payoffs-desc"
		>
			<figcaption>
				<span className="viz-title" id="payoffs-title">
					What it did to real apps
				</span>
				<span className="viz-sub mono">
					check time on TS 5.9, as a share of TS 5.8 · shorter is faster
				</span>
			</figcaption>
			<div className="legend mono" aria-hidden>
				<span>
					<i className="key v-before" /> TS 5.8
				</span>
				<span>
					<i className="key v-after" /> TS 5.9
				</span>
			</div>
			<p id="payoffs-desc" className="sr-only">
				TypeScript check time after the 5.9 fix, as a share of 5.8: a tRPC
				monorepo, 13.04 to 6.00 seconds in one run; AnswerOverflow, 6.66 to 3.29
				seconds, mean of 5 runs each; Klarna, 395.48 to 132.09 seconds,
				self-reported.
			</p>
			<div className="pay-rows">
				<div className="pay-grid" aria-hidden>
					{[0, 50, 100].map(v => (
						<span key={v} style={{ left: at(v) }} />
					))}
				</div>
				{rows.map((row, i) => (
					<div
						className="pay-row"
						key={row.id}
						style={{ "--i": i } as React.CSSProperties}
					>
						<div className="pay-top">
							<span className="who" id={`pay-${row.id}`}>
								{row.label}
							</span>
							<span className="nums mono tnum">
								<Claim id={claimIds[row.id]} describedBy={`pay-${row.id}`}>
									{seconds(row.before)} → <b>{seconds(row.after)}</b>
									{row.runs && <span className="mean"> mean</span>}
								</Claim>
								<span className="x">{row.speedup}×</span>
							</span>
							<a className="tag mono" href={row.href}>
								{row.tag}
							</a>
						</div>
						<div className="pay-track" aria-hidden>
							<span className="bar v-before" />
							<span className="bar v-after" style={{ width: at(row.share) }} />
							{row.runs && <Runs runs={row.runs.before} track="b" />}
							{row.runs && <Runs runs={row.runs.after} track="a" />}
							<span
								className="pct mono tnum"
								style={{
									left: at(
										row.runs ?
											Math.max(row.share, ...row.runs.after)
										:	row.share
									)
								}}
							>
								{row.share.toFixed(1)}%
							</span>
						</div>
					</div>
				))}
				<div className="pay-axis mono" aria-hidden>
					<span style={{ left: at(0) }}>0%</span>
					<span style={{ left: at(50) }}>50%</span>
					<span style={{ left: at(100) }}>100%</span>
				</div>
			</div>
			<details className="viz-table twin">
				<summary>Data</summary>
				<div className="viz-table-scroll">
					<table className="mono tnum">
						<thead>
							<tr>
								<th scope="col">app</th>
								<th scope="col">TS 5.8</th>
								<th scope="col">TS 5.9</th>
								<th scope="col">share</th>
								<th scope="col">runs</th>
							</tr>
						</thead>
						<tbody>
							{TS59_PAYOFFS.map((row, i) => (
								<tr key={row.id}>
									<th scope="row">{row.label}</th>
									<td className="text">
										{"beforeRuns" in row ?
											row.beforeRuns.map(seconds).join(" / ")
										:	seconds(row.before)}
									</td>
									<td className="text">
										{"afterRuns" in row ?
											row.afterRuns.map(seconds).join(" / ")
										:	seconds(row.after)}
									</td>
									<td>{rows[i]!.share.toFixed(1)}%</td>
									<td className="text">{row.tag}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</details>
		</figure>
	)
}

/** every run as a faint tick, plus a min–max whisker across the bar's centre */
const Runs = ({ runs, track }: { runs: number[]; track: "a" | "b" }) => {
	const lo = Math.min(...runs)
	const hi = Math.max(...runs)
	return (
		<span className={`runs ${track}`}>
			<i
				className="whisker"
				style={{ left: at(lo), width: `calc(${at(hi)} - ${at(lo)})` }}
			/>
			{runs.map((r, k) => (
				<i key={k} className="run" style={{ left: at(r) }} />
			))}
		</span>
	)
}
