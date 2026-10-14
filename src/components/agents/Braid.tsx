import { useTransform, type MotionValue } from "motion/react"
import { useId } from "react"
import { Live } from "~/viz/Live"
import type { Layout } from "./geometry"
import { data } from "./model"

/**
 * One orientation of the braid. Everything time-bound (strands, ticks, the
 * root) sits under a clip that sweeps with the replay's position; dots and
 * labels fade in once the replay passes the moment they mark.
 */
export const Braid = ({
	l,
	p,
	cursor,
	describedBy,
	className
}: {
	l: Layout
	p: MotionValue<number>
	/** seconds into the session the replay has passed; Infinity when complete */
	cursor: number
	describedBy: string
	className: string
}) => {
	const clipId = `braid${useId().replace(/[^a-zA-Z0-9]/g, "")}`
	const h = l.o === "h"
	const { viewBox: vb } = l
	const reach = useTransform(p, v => (v >= 1 ? 9999 : l.playhead(v)))
	const clipSize = useTransform(reach, v => Math.max(0, v - (h ? vb.x : vb.y)))
	const head = useTransform(p, v => l.playhead(v))
	const headOpacity = useTransform(p, (v): number => (v > 0 && v < 1 ? 1 : 0))
	const seen = (s: number) => s <= cursor
	const label = data.root.label

	return (
		<svg
			className={`braid braid-${l.o} ${className}`}
			viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
			role="img"
			aria-labelledby={describedBy}
		>
			<defs>
				<clipPath id={clipId}>
					{h ?
						<Live
							as="rect"
							x={vb.x}
							y={vb.y}
							height={vb.h}
							attrs={{ width: clipSize }}
						/>
					:	<Live
							as="rect"
							x={vb.x}
							y={vb.y}
							width={vb.w}
							attrs={{ height: clipSize }}
						/>
					}
				</clipPath>
			</defs>

			{l.axis.map(a => (
				<text
					key={a.text}
					className="b-axis"
					x={a.at.x}
					y={a.at.y}
					textAnchor={h ? "middle" : "start"}
				>
					{a.text}
				</text>
			))}

			<g clipPath={`url(#${clipId})`}>
				<path className="b-root" d={l.root} />
				<path className="b-root-ticks" d={l.rootTicks} />
				{l.shapes.map(s => (
					<g key={s.id} className={`b-strand ph-${s.phase}`}>
						<title>{s.title}</title>
						{s.connector && <path className="b-connector" d={s.connector} />}
						<path className="b-line" d={s.path} />
						<path className="b-ticks" d={s.ticks} />
					</g>
				))}
			</g>

			{l.gapShapes.map(g => (
				<g key={g.from.x + g.from.y} className="b-gap">
					<title>{g.text}</title>
					<text
						x={g.mid.x}
						y={g.mid.y + 4}
						textAnchor="middle"
						className="b-gap-glyph"
					>
						≈
					</text>
					{g.label && (
						<text
							x={g.label.x}
							y={g.label.y}
							dy="0.35em"
							textAnchor={g.label.anchor}
							className="b-gap-label"
						>
							{g.text}
						</text>
					)}
				</g>
			))}

			{l.shapes.map(s => (
				<g key={s.id} className={`b-end ph-${s.phase}`} data-on={seen(s.s1)}>
					<circle
						cx={s.end.x}
						cy={s.end.y}
						r={s.done ? 3 : 3.5}
						data-running={!s.done || undefined}
						data-failed={s.failed || undefined}
					/>
					{s.mark && (
						<circle className="b-mark" cx={s.mark.x} cy={s.mark.y} r={3} />
					)}
					{s.label && (
						<text
							x={s.label.x}
							y={s.label.y}
							dy="0.35em"
							textAnchor={s.label.anchor}
						>
							{s.label.text}
						</text>
					)}
				</g>
			))}

			{l.prompts.map(pr => (
				<rect
					key={pr.s}
					className="b-prompt"
					x={pr.at.x - 4}
					y={pr.at.y - 4}
					width={8}
					height={8}
					transform={`rotate(45 ${pr.at.x} ${pr.at.y})`}
				/>
			))}

			<text
				className="b-root-label"
				x={l.rootLabel.x}
				y={l.rootLabel.y}
				textAnchor={h ? "end" : "middle"}
			>
				{label}
			</text>

			{h ?
				<Live
					as="line"
					className="b-head"
					y1={l.vMin}
					y2={l.vMax}
					attrs={{ x1: head, x2: head, opacity: headOpacity }}
				/>
			:	<Live
					as="line"
					className="b-head"
					x1={l.c.center + l.vMin}
					x2={l.c.center + l.vMax}
					attrs={{ y1: head, y2: head, opacity: headOpacity }}
				/>
			}
		</svg>
	)
}
