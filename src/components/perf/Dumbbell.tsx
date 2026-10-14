import { useRef, type ReactNode } from "react"
import { formatNumber } from "~/lib/format"
import { pct } from "~/viz/scale"
import { useEntrance } from "./useEntrance"

type DumbbellRow = {
	label: string
	/** mono: the label is a code identifier */
	code?: boolean
	before: number
	after: number
	/** the printed values, when they differ from the plotted ones */
	beforeText?: string
	afterText?: string
}

/**
 * Before (violet) → after (teal) per row on one shared axis. On first view the
 * after dot starts on top of the before dot and slides out to its value.
 */
export const Dumbbell = ({
	title,
	rows,
	max,
	ticks,
	mobileTicks,
	tickLabel,
	axisTitle,
	describe,
	children
}: {
	title: ReactNode
	rows: readonly DumbbellRow[]
	max: number
	ticks: readonly number[]
	mobileTicks: readonly number[]
	tickLabel: (v: number) => string
	axisTitle: string
	describe: string
	children?: ReactNode
}) => {
	const ref = useRef<HTMLElement>(null)
	const phase = useEntrance(ref, 0.4)
	const at = (v: number) => pct(v / max)
	const cq = (v: number) => `${((v / max) * 100).toFixed(3)}cqw`
	return (
		<figure className="dumbbell" ref={ref} data-phase={phase}>
			<figcaption className="viz-title">{title}</figcaption>
			<div className="legend mono" aria-hidden>
				<span>
					<i className="dot-key v-before" /> before
				</span>
				<span>
					<i className="dot-key v-after" /> after
				</span>
			</div>
			<div className="db-rows" role="img" aria-label={describe}>
				{rows.map((row, i) => {
					// truncated toward zero: a reduction is never overstated (bind is −72.9%, not −73%)
					const delta = Math.trunc(
						((row.after - row.before) / row.before) * 100
					)
					return (
						<div
							className="db-row"
							key={row.label}
							aria-hidden
							style={
								{
									"--i": i,
									// container-query units of .db-plot, so the dots move by transform
									"--b": cq(row.before),
									"--a": cq(row.after)
								} as React.CSSProperties
							}
						>
							<span className={`db-label${row.code ? " mono" : ""}`}>
								{row.label}
							</span>
							<span className="db-plot">
								{ticks.map(v => (
									<i
										key={v}
										className="db-grid"
										data-mobile={mobileTicks.includes(v) || undefined}
										style={{ left: at(v) }}
									/>
								))}
								<span className="db-bar" />
								<span className="db-dot v-before" />
								<span className="db-dot v-after" />
								<span className="db-val v-before mono tnum">
									{row.beforeText ?? formatNumber(row.before)}
								</span>
								<span className="db-val v-after mono tnum">
									{row.afterText ?? formatNumber(row.after)}
								</span>
							</span>
							<span className="db-delta mono tnum">
								{delta > 0 ? "+" : "−"}
								{Math.abs(delta)}%
							</span>
						</div>
					)
				})}
				<div className="db-axis mono" aria-hidden>
					<span className="db-label">{axisTitle}</span>
					<span className="db-plot">
						{ticks.map(v => (
							<span
								key={v}
								data-mobile={mobileTicks.includes(v) || undefined}
								style={{ left: at(v) }}
							>
								{tickLabel(v)}
							</span>
						))}
					</span>
				</div>
			</div>
			{children}
		</figure>
	)
}
