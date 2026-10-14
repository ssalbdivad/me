import {
	allTicks,
	clusters,
	data,
	duration,
	gaps,
	groups,
	strands,
	timeScale,
	total,
	type Phase
} from "./model"

/**
 * Lays the braid out along two axes: u runs with time, v across lanes (the
 * root is v = 0). Horizontal maps (u, v) → (x, y); vertical maps it to (y, x).
 * Time is never distorted except across idle gaps, which are drawn as ≈.
 */
type Orientation = "h" | "v"

type Config = {
	width: number
	/** length of the time axis */
	span: number
	/** offset of time zero along u, in viewBox units */
	start: number
	/** offset of the root along v */
	center: number
	laneGap: number
	tick: number
	/** label font size in viewBox units, sized so the smallest rendering stays ≥11px */
	labelSize: number
	/** vertical only: room for lanes on each side of the root */
	room: number
	gapWidth: number
	thin: number
	/** extra room after the last lane (for labels) */
	before: number
	after: number
}

const configs: Record<Orientation, Config> = {
	h: {
		width: 1100,
		span: 830,
		start: 126,
		center: 0,
		laneGap: 21,
		tick: 4.5,
		labelSize: 13.5,
		room: 0,
		// wide enough that the "27m idle" above the ≈ stays inside the gap, clear of the strands either side
		gapWidth: 76,
		thin: 1,
		before: 40,
		after: 40
	},
	v: {
		width: 340,
		span: 520,
		start: 44,
		// clock on the left, lanes, then a column for the cluster counts on the right
		center: 134,
		laneGap: 24,
		tick: 4,
		// agents.css sets 10–15 by breakpoint; lay out for the largest
		labelSize: 15.5,
		room: 78,
		gapWidth: 40,
		thin: 2,
		before: 0,
		after: 0
	}
}

/** Cascadia Code's advance is 0.59em; its ascent and descent are 0.93em and 0.24em */
const charWidth = 0.6
const ascent = 0.93
const descent = 0.24
const r = (n: number) => Math.round(n * 10) / 10

/** y is the text's centre line: Braid sets dy="0.35em" */
type Label = {
	x: number
	y: number
	text: string
	anchor: "start" | "end" | "middle"
}
type Box = { x0: number; y0: number; x1: number; y1: number }

const boxOf = (l: Label, size: number): Box => {
	const w = l.text.length * charWidth * size
	const x0 =
		l.x -
		(l.anchor === "start" ? 0
		: l.anchor === "end" ? w
		: w / 2)
	return {
		x0,
		x1: x0 + w,
		y0: l.y + (0.35 - ascent) * size,
		y1: l.y + (0.35 + descent) * size
	}
}

const hits = (a: Box, b: Box) =>
	a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

const fanLength = (v: number) => 18 + Math.abs(v) * 0.75

/** the fan curve, a cubic from the root to the lane: v at a given u */
const fanV = (u: number, u0: number, f: number, v: number) => {
	const x = (t: number) =>
		u0 + f * (1.5 * (1 - t) ** 2 * t + 1.5 * (1 - t) * t ** 2 + t ** 3)
	let lo = 0
	let hi = 1
	for (let i = 0; i < 16; i++) {
		const mid = (lo + hi) / 2
		if (x(mid) < u) lo = mid
		else hi = mid
	}
	const t = (lo + hi) / 2
	return v * (3 * (1 - t) * t ** 2 + t ** 3)
}

type StrandShape = {
	id: string
	phase: Phase
	path: string
	connector: string | undefined
	ticks: string
	end: { x: number; y: number }
	done: boolean
	failed: boolean
	/** only some strands carry one: see `named` */
	label: Label | undefined
	/** vertical: the phase-colored dot that ties a count in the column to its cluster */
	mark: { x: number; y: number } | undefined
	title: string
	s1: number
}

export const layout = (o: Orientation) => {
	const c = configs[o]
	const { u: timeU, s: timeS } = timeScale(c.span, c.gapWidth)
	const U = (s: number) => r(c.start + timeU(s))
	const pt = (u: number, v: number) =>
		o === "h" ? `${r(u)} ${r(v)}` : `${r(c.center + v)} ${r(u)}`
	const xy = (u: number, v: number) =>
		o === "h" ? { x: r(u), y: r(v) } : { x: r(c.center + v), y: r(u) }

	// lanes alternate around the root: +1, -1, +2, -2…
	const depth = (i: number) => Math.ceil((i + 1) / 2)
	const busy: number[] = []
	const laneIndex = new Map<string, number>()
	const labelWidth = (text: string) => text.length * charWidth * c.labelSize
	/**
	 * Which strands carry a label, and what it says. A cluster of up to three
	 * names each strand (by what it handed back); a bigger one gets a single
	 * count at its last strand to land ("review · 12"). The narrow layout only
	 * has room for the counts, in a column beside the lanes, level with the
	 * fan each one counts. Every name stays in the strand's <title> and the
	 * table below the figure.
	 */
	const named = new Map<string, { text: string; s0: number }>()
	for (const k of clusters) {
		if (o === "h" && k.strands.length <= 3)
			for (const s of k.strands)
				named.set(s.id, { text: s.artifact || s.name, s0: k.s0 })
		else
			named.set(k.strands.reduce((a, b) => (b.s1 > a.s1 ? b : a)).id, {
				text: k.label,
				s0: k.s0
			})
	}
	for (const g of groups) {
		const ordered = [...g.strands].sort((a, b) => b.s1 - b.s0 - (a.s1 - a.s0))
		for (const s of ordered) {
			const from = U(s.s0) - 4
			let i = 0
			while ((busy[i] ?? -Infinity) > from) i++
			laneIndex.set(s.id, i)
			// the connector leaves the lane once it starts curving home, so the next
			// phase can take the lane and cross it on the way out- that's the plait
			const replait = g.landing !== undefined ? U(g.landing) : U(total)
			// horizontal labels run on along the lane, so they hold it too
			const text = o === "h" ? named.get(s.id)?.text : undefined
			busy[i] =
				Math.max(U(s.s1) + (text ? 8 + labelWidth(text) : 0), replait) + 2
		}
	}
	// vertical has a fixed width: squeeze the lanes when many agents run at once
	const maxDepth = Math.max(1, ...[...laneIndex.values()].map(depth))
	const gap = o === "v" ? Math.min(c.laneGap, c.room / maxDepth) : c.laneGap
	const lane = new Map(
		[...laneIndex].map(
			([id, i]) => [id, (i % 2 === 0 ? 1 : -1) * depth(i) * gap] as const
		)
	)
	const vs = [...lane.values(), 0]
	const vMin = Math.min(...vs) - gap * 0.9
	const vMax = Math.max(...vs) + gap * 0.9
	const uEnd = U(total)
	/** how far past the end the last hand-backs curve home (the tassel), so the figure makes room for it */
	let reach = uEnd

	const shapes: StrandShape[] = strands.map(s => {
		const v = lane.get(s.id) ?? gap
		const u0 = U(s.s0)
		const u1 = U(s.s1)
		const f = Math.min(fanLength(v), Math.max(6, u1 - u0))
		const path = `M${pt(u0, 0)}C${pt(u0 + f / 2, 0)} ${pt(u0 + f / 2, v)} ${pt(u0 + f, v)}L${pt(Math.max(u1, u0 + f), v)}`
		const g = groups[groups.findIndex(g => g.index === s.group)]
		let connector: string | undefined
		if (s.done) {
			if (g?.landing !== undefined) {
				const uL = Math.max(U(g.landing), u1)
				const fl = fanLength(v)
				reach = Math.max(reach, uL + fl)
				connector = `M${pt(u1, v)}L${pt(uL, v)}C${pt(uL + fl / 2, v)} ${pt(uL + fl / 2, 0)} ${pt(uL + fl, 0)}`
			} else connector = `M${pt(u1, v)}L${pt(uEnd, v)}`
		}
		let ticks = ""
		s.ticks.forEach((t, i) => {
			if (i % c.thin) return
			const u = U(t)
			const tv = u < u0 + f ? fanV(u, u0, f, v) : v
			ticks += `M${pt(u, tv - c.tick)}L${pt(u, tv + c.tick)}`
		})
		const n = named.get(s.id)
		const column = c.center + c.room + 9
		const label: Label | undefined =
			!n ? undefined
			: o === "h" ?
				{ ...xy(Math.max(u1, u0 + f) + 7, v), text: n.text, anchor: "start" }
			:	{ x: column + 7, y: U(n.s0), text: n.text, anchor: "start" }
		return {
			id: s.id,
			phase: s.phase,
			path,
			connector,
			ticks,
			end: xy(Math.max(u1, u0 + f), v),
			done: s.done,
			failed: !!s.failed,
			label,
			mark: label && o === "v" ? { x: column, y: label.y } : undefined,
			title: `${s.name}${s.artifact ? ` → ${s.artifact}` : ""} · ${duration(s.s1 - s.s0)} · ${s.toolCalls} tool calls${
				s.failed ? " · stopped without a result"
				: s.done ? ""
				: " · still working at snapshot"
			}`,
			s1: s.s1
		}
	})

	let rootTicks = ""
	const rootTick = c.tick * (o === "h" ? 1.5 : 1.25)
	for (const t of data.root.ticks)
		rootTicks += `M${pt(U(t), -rootTick)}L${pt(U(t), rootTick)}`

	// root segments, skipping the gaps
	let root = ""
	let from = 0
	for (const g of gaps) {
		root += `M${pt(U(from), 0)}L${pt(U(g.s0) + 6, 0)}`
		from = g.s1
	}
	root += `M${pt(U(from) - (gaps.length ? 6 : 0), 0)}L${pt(uEnd, 0)}`

	// clock ticks along the time axis
	const step =
		total > 4 * 3600 ? 3600
		: total > 2 * 3600 ? 1800
		: total > 3600 ? 900
		: 600
	const t0 = Date.parse(data.root.startedAt) / 1000
	const axis: { at: { x: number; y: number }; text: string }[] = []
	for (
		let wall = Math.ceil(t0 / step) * step;
		wall <= t0 + total;
		wall += step
	) {
		const s = wall - t0
		if (gaps.some(g => s > g.s0 && s < g.s1)) continue
		const text = new Date(wall * 1000).toISOString().slice(11, 16)
		axis.push({
			at: o === "h" ? xy(U(s), vMax + 22) : { x: 4, y: r(U(s) + 5) },
			text
		})
	}

	const prompts = data.root.prompts.map(s => ({ s, at: xy(U(s), 0) }))

	const rootLabel = o === "h" ? xy(c.start - 12, 4.5) : xy(c.start - 18, 0)

	// vertical: counts that would crowd each other in the column step down
	if (o === "v") {
		let floor = Number.NEGATIVE_INFINITY
		for (const sh of shapes
			.filter(s => s.label)
			.sort((a, b) => a.label!.y - b.label!.y)) {
			sh.label!.y = r(Math.max(sh.label!.y, floor))
			sh.mark!.y = sh.label!.y
			floor = sh.label!.y + (ascent + descent) * c.labelSize + 3
		}
	}

	/*
	 * Idle-gap labels go wherever they collide with nothing: beside the ≈,
	 * then a lane further out on either side (nothing runs through a gap, but
	 * labels can run into one). When every spot is taken, the ≈ keeps the
	 * length in its <title> instead.
	 */
	const glyph = 16
	const taken: Box[] = [
		...shapes.flatMap(s => (s.label ? [boxOf(s.label, c.labelSize)] : [])),
		...axis.map(a =>
			boxOf(
				{
					x: a.at.x,
					y: a.at.y - 0.35 * c.labelSize,
					text: a.text,
					anchor: o === "h" ? "middle" : "start"
				},
				c.labelSize
			)
		),
		boxOf(
			{
				x: rootLabel.x,
				y: rootLabel.y - 0.35 * 16,
				text: data.root.label,
				anchor: o === "h" ? "end" : "middle"
			},
			16
		)
	]
	const gapShapes = gaps.map(g => {
		const a = U(g.s0)
		const b = U(g.s1)
		const mid = xy((a + b) / 2, 0)
		const text = `${duration(g.s1 - g.s0)} idle`
		taken.push(boxOf({ ...mid, text: "≈", anchor: "middle" }, glyph))
		const clear = (ascent + descent) * c.labelSize * 0.5 + glyph * 0.65 + 2
		const spots: Label[] =
			o === "h" ?
				[-1, 1, -2, 2, -3, 3].map(k => ({
					x: mid.x,
					y: r(mid.y + Math.sign(k) * (clear + (Math.abs(k) - 1) * c.laneGap)),
					text,
					anchor: "middle" as const
				}))
			:	[
					{ x: mid.x + 12, y: mid.y, text, anchor: "start" },
					{ x: mid.x - 12, y: mid.y, text, anchor: "end" }
				]
		const label = spots.find(l => {
			const box = boxOf(l, c.labelSize)
			return box.x0 >= 0 && box.x1 <= c.width && !taken.some(t => hits(t, box))
		})
		if (label) taken.push(boxOf(label, c.labelSize))
		return { mid, from: xy(a, 0), to: xy(b, 0), text, label }
	})

	// labels past the last lane, the end of time or the root's start widen the figure rather than spill out of it
	const x0 = Math.min(0, ...taken.map(b => b.x0 - 2))
	// (the vertical figure never widens for the tassel: the phone braid would shrink with it)
	const x1 = Math.max(
		c.width,
		o === "h" ? reach + 6 : 0,
		...taken.map(b => b.x1 + 2)
	)
	const viewBox =
		o === "h" ?
			{ x: x0, y: vMin - 10, w: x1 - x0, h: vMax - vMin + 10 + 30 }
		:	{
				x: x0,
				y: 6,
				w: x1 - x0,
				h: Math.max(uEnd + 24, reach + 6, ...taken.map(b => b.y1 + 6)) - 6
			}

	/** a box covering everything before position p ∈ [0, 1] of the replay */
	const playhead = (p: number) => c.start + p * (uEnd - c.start)
	const toTime = (pos: number) => timeS(pos - c.start)

	return {
		o,
		c,
		viewBox,
		vMin,
		vMax,
		uEnd,
		shapes,
		root,
		rootTicks,
		rootLabel,
		rootEnd: xy(uEnd, 0),
		gapShapes,
		axis,
		prompts,
		playhead,
		toTime,
		pt,
		tickCount: allTicks.length
	}
}

export type Layout = ReturnType<typeof layout>
