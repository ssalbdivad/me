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
	/**
	 * a strand's thickness per tool call a minute (its average rate), so its
	 * area (length = duration) is proportional to its tool calls
	 */
	perMin: number
	/** the thinnest a strand is drawn, whatever its rate: enough to read as heavier than its stem */
	minWeight: number
	/** the root's own calls: its width at rest, ink per call (square units), and smoothing σ */
	rootBase: number
	callArea: number
	sigma: number
	/** radius of the elbow where a strand turns off its group's trunk onto its lane */
	elbow: number
	/**
	 * room after an end dot's centre (a plain dot's ring reaches 4–4.25)
	 * before another stem may pass it, plus however much a dot grew (see `hold`)
	 */
	clear: number
	/** the closest two groups' trunks may run on one side before they read as one line */
	trunkSep: number
	/** lane choice: what widening the figure by a lane costs, against 100 for a crossing */
	deepen: number
	/** lane choice: how many layouts stay in play */
	beam: number
	/** lane choice: how many dispatches ahead each plan's prospects are judged */
	lookahead: number
	/** half the gap a stem cuts through a bar it crosses */
	cut: number
	/** label font size in viewBox units, sized so the smallest rendering stays ≥11px */
	labelSize: number
	/** vertical only: room for lanes on each side of the root, and from there to the counts' marks */
	room: number
	column: number
	gapWidth: number
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
		laneGap: 17,
		perMin: 0.9,
		minWeight: 1.5,
		rootBase: 2,
		callArea: 0.7,
		sigma: 4,
		elbow: 9,
		clear: 8,
		trunkSep: 5,
		deepen: 40,
		beam: 600,
		lookahead: 3,
		cut: 2,
		labelSize: 13.5,
		room: 0,
		column: 0,
		// wide enough that the "27m idle" beside the ≈ stays inside the gap, clear of the end dots either side
		gapWidth: 86,
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
		perMin: 0.7,
		minWeight: 1.5,
		rootBase: 2,
		callArea: 0.45,
		sigma: 3,
		elbow: 6,
		clear: 7,
		trunkSep: 5,
		deepen: 40,
		beam: 200,
		lookahead: 3,
		cut: 2,
		// agents.css sets 10–15 by breakpoint; lay out for the largest
		labelSize: 15.5,
		room: 74,
		// far enough out that no strand's end dot reads as the count's own mark
		column: 13,
		gapWidth: 40,
		before: 0,
		after: 0
	}
}

/**
 * The replay's clock: position p ∈ [0, 1] → seconds into the session, the
 * same for both layouts, so each sweeps to the same moment and the readout
 * matches whichever is shown. Paced by the wide layout's time axis, where an
 * idle gap takes its share of the sweep.
 */
const pace = timeScale(configs.h.span, configs.h.gapWidth)
export const timeAt = (p: number) =>
	p >= 1 ? total : pace.s(p * pace.u(total))

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

type StrandShape = {
	id: string
	phase: Phase
	/** the way out: straight from the root, round the elbow onto its lane */
	path: string
	/**
	 * the strand's body along its lane, start to end, drawn `weight` thick;
	 * none where it couldn't show past its end dot, which carries its calls
	 * instead (see `barOf`)
	 */
	band: string | undefined
	weight: number
	/** gaps cut through earlier strands' bars where this one's stem crosses them */
	cuts: { x: number; y: number; w: number; h: number }[]
	end: { x: number; y: number }
	dotR: number
	/**
	 * the bar is thicker than its dot (and at least as long as it is thick):
	 * the dot drops its ring and merges into the bar as its rounded end,
	 * which a ring would cut into crumbs
	 */
	flush: boolean
	done: boolean
	failed: boolean
	/** only some strands carry one: see `named` */
	label: (Label & { box: Box }) | undefined
	/** vertical: the phase-colored dash (as in the legend) that ties a count in the column to its cluster */
	mark: { x: number; y: number } | undefined
	title: string
	s1: number
}

/** `shipped`: the lanes the prerender chose, read back from the figure (see `lanes`) */
export const layout = (o: Orientation, shipped?: string) => {
	const c = configs[o]
	const { u: timeU, k } = timeScale(c.span, c.gapWidth)
	const U = (s: number) => r(c.start + timeU(s))
	const pt = (u: number, v: number) =>
		o === "h" ? `${r(u)} ${r(v)}` : `${r(c.center + v)} ${r(u)}`
	const xy = (u: number, v: number) =>
		o === "h" ? { x: r(u), y: r(v) } : { x: r(c.center + v), y: r(u) }

	const labelWidth = (text: string) => text.length * charWidth * c.labelSize
	/**
	 * Which strands carry a label, and what it says: each cluster gets a
	 * single count ("review · 12", "fixes · 1"), so the counts in each phase
	 * add up to the legend's. Horizontally it follows the last strand to land
	 * of the cluster's biggest fan (the earliest, if two tie): a cluster's
	 * stragglers can land an hour after its main fan, and a count on one of
	 * them would leave the fan unlabelled. That strand holds its lane longest,
	 * label and all, so the lane search puts it outermost on its side unless
	 * a strand too short to clear the trunk takes that lane. The narrow layout puts the counts in a column beside the
	 * lanes, level with the cluster each one counts, appearing once the whole
	 * cluster has landed. Every name stays in the strand's <title> and the
	 * table below the figure.
	 */
	const named = new Map<string, { text: string; s0: number }>()
	const last = (list: (typeof strands)[number][]) =>
		list.reduce((a, b) => (b.s1 > a.s1 ? b : a))
	for (const k of clusters) {
		const fans = groups.filter(g => k.strands.includes(g.strands[0]!))
		const fan = fans.reduce((a, b) =>
			b.strands.length > a.strands.length ? b : a
		)
		named.set(last(o === "h" ? fan.strands : k.strands).id, {
			text: k.label,
			s0: k.s0
		})
	}

	/*
	 * Lanes. Each group (one fan-out) leaves the root on a single trunk at its
	 * dispatch, and its strands branch off that trunk onto lanes on one side
	 * of the root, or both. A trunk runs straight across the lanes between,
	 * so it crosses whatever still holds one of them: a bar, its end dot or,
	 * horizontally, the label after it. It must also keep `trunkSep` from any
	 * other group's trunk on its side, or the two read as one line.
	 *
	 * A group's longest-held strand goes outermost, so its inner lanes free
	 * up first and a later group can nest inside without crossing it (a
	 * strand too short to clear its own trunk may go outermost instead). Each
	 * group has a handful of options: how many strands go to each side, and
	 * whether they pack from the root or sit as far out as what is still held
	 * allows. A beam search through the session keeps the cheapest layouts,
	 * ranked with a look at the next few dispatches: a crossing through a bar
	 * costs 100 (it is drawn as a clean over, see `cuts`), past a dot 400,
	 * through a label 3000 (the knockout would break the stem); a trunk on
	 * another's line 1500, a bead (a sibling's dot the trunk runs on through)
	 * 300, each lane of depth 1, and each lane added to the figure `deepen`.
	 * A bead costs a little less than another group's dot, since it at least
	 * reads as part of its own fan; where two groups dispatched together take
	 * a side each, a group with several such strands can't avoid them all.
	 */
	/** (over 15s at least, so a strand that ended at once can't swell across its neighbours' lanes) */
	const weightOf = (s: (typeof strands)[number]) =>
		r(
			Math.max(
				c.minWeight,
				(c.perMin * s.toolCalls) / Math.max(0.25, (s.s1 - s.s0) / 60)
			)
		)
	/** an end dot's radius when it marks only the end: a hollow one (running) a little bigger */
	const plainR = (s: (typeof strands)[number]) => (s.done ? 3 : 3.5)
	/**
	 * Whether a strand gets a bar: only if what shows of it before its end
	 * dot's cover (a ring reaches r + 1, a flush dot's fill r - 1) is at
	 * least as long as the bar is thick, and never under `minShown` units (a
	 * bar barely thicker than its stem passes the first test with a 2-unit
	 * nub, all of it inside the elbow's curve). Anything less reads as a crumb
	 * beside the dot, or a slab across the lane through it. A strand that
	 * busy and that brief has no bar: its dot grows to carry its calls (see
	 * `dotR`). Judged with the dot at the bar's
	 * end, before the lanes are known (a strand shorter than its elbow ends
	 * past it, which only shows more). A hollow dot, failed or running, can't
	 * carry ink, so its strand always keeps its bar.
	 */
	const minShown = 3
	const barOf = (s: (typeof strands)[number]) => {
		const weight = weightOf(s)
		const r0 = plainR(s)
		const hollow = !s.done || !!s.failed
		if (hollow) return true
		const cover = weight > 2 * r0 ? r0 - 1 : r0 + 1
		const half = weight / 2
		const reach = half < cover ? Math.sqrt(cover ** 2 - half ** 2) : 0
		return U(s.s1) - U(s.s0) - reach >= Math.max(weight, minShown)
	}
	/**
	 * Ink per tool call, in square units: a bar's thickness per call a minute
	 * times its length a minute, so a dot that carries a strand's calls (see
	 * `dotR`) holds them at the same rate as the bars do.
	 */
	const callInk = c.perMin * 60 * k
	/**
	 * An end dot's radius: the same on every strand with a bar (on a bar
	 * thicker than the dot it is drawn flush, as the bar's rounded end: see
	 * `flush`). A strand with no bar (see `barOf`) gets a dot whose fill,
	 * inside its ring (r - 1), adds its calls' ink to a plain dot's.
	 * Thousandths, or a small one's area would round off by a few percent.
	 */
	const dotR = (s: (typeof strands)[number]) => {
		const r0 = plainR(s)
		if (barOf(s)) return r0
		const fill = Math.sqrt((r0 - 1) ** 2 + (callInk * s.toolCalls) / Math.PI)
		return Math.round((fill + 1) * 1000) / 1000
	}
	const search = () => {
		type Strand = (typeof strands)[number]
		type Pick = {
			id: string
			side: number
			depth: number
			prev: Pick | undefined
		}
		/** lanes per side the search may use (far more than any layout needs) */
		const cap = 24
		type Plan = {
			cost: number
			/**
			 * per lane, side 0 (below or right of the root) then side 1: held until
			 * `end` (the strand, its dot, and horizontally its label); its bar runs
			 * until `body`, its dot and the room after it until `bar` (a labelled
			 * strand's dot counts as part of its label); 0 if never held
			 */
			end: number[]
			body: number[]
			bar: number[]
			/** the trunks recent enough that a later one could run beside them */
			trunks: { u: number; group: number; side: number }[]
			deepest: number
			picks: Pick | undefined
		}
		/** a strand holds its lane through its end dot (and label), then `clear` more */
		const hold = (s: Strand, t: number) => {
			const end = Math.max(
				U(s.s1),
				t + Math.min(c.elbow, Math.max(1, U(s.s1) - t))
			)
			const text = o === "h" ? named.get(s.id)?.text : undefined
			// a stem passing this close to the end would run through the dot and its ring
			const body = end - dotR(s) - 2.5
			// a dot grown to carry its calls needs that much more room after it
			const after = c.clear + dotR(s) - plainR(s)
			return {
				dot: end,
				body,
				// past a labelled dot, a stem would come between the dot and its label
				bar: text ? body : end + after,
				end: end + after + (text ? 11 + labelWidth(text) : 0)
			}
		}
		/** one way to lay a side's share of a group: its depths, innermost first */
		type Way = { depths: number[]; cost: number; deepest: number }
		const none: Way[] = [{ depths: [], cost: 0, deepest: 0 }]
		const mix = (key: number, n: number) => Math.imul(key ^ n, 16777619)
		let beam: Plan[] = [
			{
				cost: 0,
				end: Array<number>(2 * cap).fill(0),
				body: Array<number>(2 * cap).fill(0),
				bar: Array<number>(2 * cap).fill(0),
				trunks: [],
				deepest: 0,
				picks: undefined
			}
		]
		/** every way to place group `gi` in each plan, cheapest first, one plan per distinct outcome, up to `keep` */
		const expand = (plans: Plan[], gi: number, keep: number) => {
			const g = groups[gi]!
			const t = U(g.s0)
			/**
			 * a lane is free once what held it has cleared the trunk, and by as
			 * much again as any of the group's dots grew (see `dotR`): a strand
			 * that ends at once has its dot at the elbow, and a grown one reaches
			 * back towards whatever ended on that lane before
			 */
			const free = t - Math.max(0, ...g.strands.map(s => dotR(s) - plainR(s)))
			const holds = new Map(g.strands.map(s => [s.id, hold(s, t)]))
			const byHold = [...g.strands].sort(
				(a, b) => holds.get(b.id)!.end - holds.get(a.id)!.end
			)
			/**
			 * too short for its dot to clear its own trunk: the trunk runs on
			 * through it, a bead, unless it goes outermost on its side, where the
			 * trunk ends at its dot
			 */
			const tiny = (s: Strand) => holds.get(s.id)!.body < t
			/**
			 * Which strands go to each side, outermost first: any number to either
			 * side, spread evenly through the group's order so each side keeps a
			 * mix of long and short. The other orders put tiny strands outermost,
			 * shortest first, so where the trunk must still run past one, it is
			 * the one whose dot stands furthest from it: all of them, or just the
			 * shortest, the rest keeping their places (inner lanes free first).
			 */
			const splits: Strand[][][] = []
			const n = g.strands.length
			const short = byHold.filter(tiny).reverse()
			const orders = [
				byHold,
				[...short, ...byHold.filter(s => !tiny(s))],
				[...short.slice(0, 1), ...byHold.filter(s => s !== short[0])]
			].filter(
				(order, i, all) =>
					!all.slice(0, i).some(o => o.every((s, j) => s === order[j]))
			)
			for (const order of orders) {
				for (let k = 0; k <= n; k++)
					for (const side of k === 0 || k === n ? [0] : [0, 1]) {
						const split: Strand[][] = [[], []]
						order.forEach((s, i) =>
							split[
								Math.floor(((i + 1) * k) / n) > Math.floor((i * k) / n) ?
									side
								:	1 - side
							]!.push(s)
						)
						splits.push(split)
					}
			}
			/** a trunk through the dot itself, or only past its ring */
			const bead = (s: Strand) =>
				holds.get(s.id)!.dot - t < dotR(s) + 1.5 ? 300 : 30
			const beads = splits.map(split =>
				split
					.flatMap(list => list.slice(1))
					.filter(tiny)
					.reduce((sum, s) => sum + bead(s), 0)
			)
			const sizes = [0, 1].map(side => [
				...new Set(splits.map(split => split[side]!.length))
			])
			/** runs of consecutive depths, shared by every plan */
			const runs = new Map<number, number[]>()
			const run = (from: number, m: number) => {
				let depths = runs.get(from * 64 + m)
				if (!depths)
					runs.set(
						from * 64 + m,
						(depths = Array.from({ length: m }, (_, i) => from + i))
					)
				return depths
			}
			// every option for every plan, as parallel lists; `rank` packs cost and index for a native sort
			const from: Plan[] = []
			const via: number[] = []
			const above: Way[] = []
			const below: Way[] = []
			const costs: number[] = []
			for (const plan of plans) {
				/** per side, per number of strands: the ways to lay them, and what each costs */
				const ways: Way[][][] = [[], []]
				for (let side = 0; side < 2; side++) {
					const at = side * cap
					let h = 1
					while (h <= cap && plan.end[at + h - 1]! <= free) h++
					let near = 0
					for (const x of plan.trunks)
						if (
							x.side === side &&
							x.group !== g.index &&
							Math.abs(x.u - t) < c.trunkSep
						)
							near++
					for (const m of sizes[side]!) {
						if (!m) ways[side]![0] = none
						else if (m < h) {
							// room inside whatever is held: pack from the root, or as far out as
							// the hold (or the figure's edge) allows, leaving the lanes inside free
							const w = [
								{
									depths: run(1, m),
									cost: near * 1500 + (m * (m + 1)) / 2,
									deepest: m
								}
							]
							const top = Math.min(h - 1, Math.max(plan.deepest, m))
							if (top > m)
								w.push({
									depths: run(top - m + 1, m),
									cost: near * 1500 + m * (top - m + 1) + (m * (m - 1)) / 2,
									deepest: top
								})
							ways[side]![m] = w
						} else {
							// too little room inside: the nearest free lanes, crossing what they must
							const depths: number[] = []
							let cost = near * 1500
							let crossed = 0
							for (let d = 1; depths.length < m; d++) {
								const i = at + d - 1
								if (plan.end[i]! > free)
									// (a lane held only until just before the trunk crosses nothing)
									crossed +=
										t >= plan.end[i]! ? 0
										: t < plan.body[i]! ? 100
										: t < plan.bar[i]! ? 400
										: 3000
								else {
									depths.push(d)
									cost += d + crossed
								}
							}
							ways[side]![m] = [{ depths, cost, deepest: depths[m - 1]! }]
						}
					}
				}
				for (let si = 0; si < splits.length; si++) {
					const split = splits[si]!
					for (const a of ways[0]![split[0]!.length]!)
						for (const b of ways[1]![split[1]!.length]!) {
							const deepest = Math.max(plan.deepest, a.deepest, b.deepest)
							from.push(plan)
							via.push(si)
							above.push(a)
							below.push(b)
							costs.push(
								plan.cost +
									beads[si]! +
									a.cost +
									b.cost +
									(deepest - plan.deepest) * c.deepen
							)
						}
				}
			}
			// costs are whole numbers: rank by cost, then by order of generation
			const rank = Float64Array.from(
				costs,
				(cost, i) => cost * 65536 + i
			).sort()
			// plans that differ only in what is held at the next dispatch are the same from there on: keep the cheapest
			const next = groups[gi + 1] ? U(groups[gi + 1]!.s0) : Infinity
			const seen = new Set<number>()
			const pool: Plan[] = []
			for (const r of rank) {
				const k = r % 65536
				const plan = from[k]!
				const split = via[k]!
				const a = above[k]!
				const b = below[k]!
				const cost = costs[k]!
				if (pool.length === keep) break
				// hash what is still held then before building anything
				let key = 0
				for (let side = 0; side < 2; side++) {
					const { depths } = side ? b : a
					const list = splits[split]![side]!
					const n = Math.max(plan.deepest, (side ? b : a).deepest)
					for (let d = 1; d <= n; d++) {
						const i = depths.indexOf(d)
						const end =
							i < 0 ?
								plan.end[side * cap + d - 1]!
							:	holds.get(list[list.length - 1 - i]!.id)!.end
						if (end > next) key = mix(mix(key, side * cap + d), end * 10)
					}
					if (depths.length && next - t < c.trunkSep)
						key = mix(key, t * 10 + side)
				}
				for (const x of plan.trunks)
					if (next - x.u < c.trunkSep) key = mix(key, x.u * 10 + x.side)
				if (seen.has(key)) continue
				seen.add(key)
				const end = plan.end.slice()
				const body = plan.body.slice()
				const bar = plan.bar.slice()
				const trunks = plan.trunks.filter(x => next - x.u < c.trunkSep)
				let picks = plan.picks
				for (let side = 0; side < 2; side++) {
					const { depths } = side ? b : a
					if (!depths.length) continue
					const list = splits[split]![side]!
					// innermost first: the shortest-held strand takes the shallowest lane
					for (let i = 0; i < depths.length; i++) {
						const d = depths[i]!
						const s = list[list.length - 1 - i]!
						end[side * cap + d - 1] = holds.get(s.id)!.end
						body[side * cap + d - 1] = holds.get(s.id)!.body
						bar[side * cap + d - 1] = holds.get(s.id)!.bar
						picks = { id: s.id, side, depth: d, prev: picks }
					}
					trunks.push({ u: t, group: g.index, side })
				}
				const deepest = Math.max(plan.deepest, a.deepest, b.deepest)
				pool.push({ cost, end, body, bar, trunks, deepest, picks })
			}
			return pool
		}
		// a stale shipment is a dev reload after an edit: search narrowly, so the page stays responsive
		const width = shipped ? Math.min(c.beam, 16) : c.beam
		for (let gi = 0; gi < groups.length; ) {
			/*
			 * Groups dispatched within `trunkSep` of each other are placed
			 * together, since where one goes decides where the other can.
			 */
			let pool = expand(beam, gi, 3 * width)
			while (
				groups[gi + 1] &&
				U(groups[gi + 1]!.s0) - U(groups[gi]!.s0) < c.trunkSep
			)
				pool = expand(pool, ++gi, 3 * width)
			/*
			 * Rank by what each plan has cost so far plus what it leaves the next
			 * few dispatches: a group with more strands than there are free lanes
			 * inside the holds on both sides will have to cross something, and one
			 * landing beside a trunk on each side will have to share a line.
			 */
			const ahead = groups.slice(gi + 1, gi + 1 + c.lookahead)
			const outlook = (p: Plan) => {
				let cost = 0
				for (let k = 0; k < ahead.length; k++) {
					const l = ahead[k]!
					const at = U(l.s0)
					const room = [0, 1].map(side => {
						let d = 1
						while (d <= cap && p.end[side * cap + d - 1]! <= at) d++
						return d - 1
					})
					const pair = ahead[k + 1]
					if (pair && U(pair.s0) - at < c.trunkSep) {
						// two groups at once take a side each
						const [m, n] = [l.strands.length, pair.strands.length]
						const over = (a: number, b: number) =>
							Math.max(0, m - room[a]!) + Math.max(0, n - room[b]!)
						cost += Math.min(over(0, 1), over(1, 0)) * 100
						k++
					} else
						cost += Math.max(0, l.strands.length - room[0]! - room[1]!) * 100
					if (
						[0, 1].every(side =>
							p.trunks.some(x => x.side === side && at - x.u < c.trunkSep)
						)
					)
						cost += 100
				}
				return cost
			}
			beam = pool
				.map(p => ({ p, rank: p.cost + outlook(p) }))
				.sort((x, y) => x.rank - y.rank)
				.slice(0, width)
				.map(x => x.p)
			gi++
		}
		const depths = new Map<string, number>()
		for (let p = beam[0]!.picks; p; p = p.prev)
			depths.set(p.id, p.side === 0 ? p.depth : -p.depth)
		return depths
	}
	/*
	 * The search is too slow to run on every page load, so the prerender
	 * ships its result in the figure (`lanes`, which Replay reads back before
	 * hydrating): a fingerprint of everything the search reads, then each
	 * strand's signed depth. A missing or stale one (a dev reload after an
	 * edit) runs the search again.
	 */
	let fingerprint = 0
	for (const ch of JSON.stringify([
		c,
		strands.map(s => [s.id, s.s0, s.s1, s.group]),
		[...named]
	]))
		fingerprint = Math.imul(fingerprint ^ ch.charCodeAt(0), 16777619)
	const tag = `${(fingerprint >>> 0).toString(36)}:`
	const sent =
		shipped?.startsWith(tag) ?
			shipped.slice(tag.length).split(",").map(Number)
		:	[]
	const depths =
		(
			sent.length === strands.length &&
			sent.every(d => Number.isInteger(d) && d !== 0)
		) ?
			new Map(strands.map((s, i) => [s.id, sent[i]!]))
		:	search()
	const lanes = tag + strands.map(s => depths.get(s.id)).join(",")
	// vertical has a fixed width: squeeze the lanes when many agents run at once
	const maxDepth = Math.max(1, ...[...depths.values()].map(Math.abs))
	const gap = o === "v" ? Math.min(c.laneGap, c.room / maxDepth) : c.laneGap
	const lane = new Map([...depths].map(([id, d]) => [id, d * gap] as const))
	/*
	 * Each group's trunk on each side, at its dispatch. Where the search
	 * could only put two groups' trunks on one side closer than `trunkSep`,
	 * the earlier steps back to clear it: its bars still start at their true
	 * times, inside the sweep of its elbow.
	 */
	const trunkAt = new Map<string, number>()
	for (const side of [1, -1]) {
		const on = groups
			.map(g => ({
				u: U(g.s0),
				strands: g.strands.filter(s => Math.sign(depths.get(s.id)!) === side)
			}))
			.filter(x => x.strands.length)
		for (let i = on.length - 2; i >= 0; i--)
			on[i]!.u = Math.min(on[i]!.u, on[i + 1]!.u - c.trunkSep)
		for (const { u, strands } of on)
			for (const s of strands) trunkAt.set(s.id, r(u))
	}
	const vs = [...lane.values(), 0]
	const vMin = Math.min(...vs) - gap * 0.9
	const vMax = Math.max(...vs) + gap * 0.9
	const uEnd = U(total)

	// drawn in dispatch order, so a stem is always drawn after any bar it crosses (see `cuts`)
	const ordered = [...strands].sort((a, b) => a.s0 - b.s0)
	/** each trunk and bar it has already been cut through */
	const cut = new Set<string>()
	const shapes: StrandShape[] = ordered.map(s => {
		const v = lane.get(s.id) ?? gap
		const t = trunkAt.get(s.id)!
		const u0 = U(s.s0)
		const u1 = U(s.s1)
		// out along the group's trunk, round the elbow, then along the lane to the bar
		const e = Math.min(c.elbow, Math.abs(v), Math.max(1, u1 - t))
		const sv = Math.sign(v)
		const bar = barOf(s)
		// with no bar, the stem runs on to the dot
		const to = bar ? u0 : u1
		const path = `M${pt(t, 0)}L${pt(t, v - sv * e)}Q${pt(t, v)} ${pt(t + e, v)}${to > t + e ? `L${pt(to, v)}` : ""}`
		// the body runs exactly its duration, so its area is its tool calls
		const band = bar ? `M${pt(u0, v)}L${pt(u1, v)}` : undefined
		const weight = weightOf(s)
		/*
		 * Where the trunk has to cross an earlier strand's bar, it goes over:
		 * a gap in the surface color cut through the bar either side of it.
		 * The first strand drawn on a trunk cuts it, so the gap never takes a
		 * piece out of a sibling's stem drawn on the same line. A gap that would
		 * leave a sliver of bar before the end dot runs on to the dot, or the
		 * sliver reads as a crumb.
		 */
		const cuts = ordered.flatMap(b => {
			const bv = lane.get(b.id) ?? gap
			if (
				b === s ||
				Math.sign(bv) !== sv ||
				Math.abs(bv) >= Math.abs(v) ||
				!barOf(b)
			)
				return []
			if (t <= U(b.s0) + 0.5 || t >= U(b.s1) - 0.5) return []
			if (cut.has(`${t} ${b.id}`)) return []
			cut.add(`${t} ${b.id}`)
			const half = weightOf(b) / 2 + 0.5
			const dot = U(b.s1) - dotR(b)
			const a = xy(t - c.cut, bv - half)
			const z = xy(dot - t - c.cut < 4 ? dot : t + c.cut, bv + half)
			return [
				{
					x: Math.min(a.x, z.x),
					y: Math.min(a.y, z.y),
					w: r(Math.abs(z.x - a.x)),
					h: r(Math.abs(z.y - a.y))
				}
			]
		})
		const n = named.get(s.id)
		const column = c.center + c.room + c.column
		const at: Label | undefined =
			!n ? undefined
			: o === "h" ?
				{
					...xy(Math.max(u1, t + e) + 8 + dotR(s) - plainR(s), v),
					text: n.text,
					anchor: "start"
				}
			:	{ x: column + 7, y: U(n.s0), text: n.text, anchor: "start" }
		// the box backs the label with a knockout, so a stem it can't avoid passes behind it
		const label = at && { ...at, box: boxOf(at, c.labelSize) }
		return {
			id: s.id,
			phase: s.phase,
			path,
			band,
			weight,
			cuts,
			end: xy(Math.max(u1, t + e), v),
			dotR: dotR(s),
			// (a hollow dot, running or failed, keeps its outline whatever it sits on)
			flush: s.done && !s.failed && bar && weight > 2 * dotR(s),
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

	/**
	 * The root's body from u0 to u1: `rootBase` wide plus its own calls' rate
	 * × callArea. Calls go in 1.5-unit cells, smoothed by a Gaussian that is
	 * reflected at both ends (about the stretch's edges, not its first and
	 * last cell), so every call's ink stays on the stretch, all of it: the
	 * outline runs through the cells' centres and holds flat for the half cell
	 * at each end, so its area above `rootBase` is exactly callArea × calls.
	 * Widths keep two decimals, or a lone call's swell would round away.
	 */
	const rootBand = (ticks: number[], u0: number, u1: number) => {
		const n = Math.max(1, Math.ceil((u1 - u0) / 1.5))
		const step = (u1 - u0) / n
		const counts = new Float64Array(n)
		for (const t of ticks) {
			const cell = Math.floor((c.start + timeU(t) - u0) / step)
			counts[Math.min(n - 1, Math.max(0, cell))]! += 1
		}
		const K = Math.ceil((4 * c.sigma) / step)
		const kernel = Array.from({ length: 2 * K + 1 }, (_, k) =>
			Math.exp(-0.5 * (((k - K) * step) / c.sigma) ** 2)
		)
		const sum = kernel.reduce((a, b) => a + b)
		// mirror any index back onto 0…n - 1, however far past either end it falls
		const refl = (j: number) => {
			const m = ((j % (2 * n)) + 2 * n) % (2 * n)
			return m < n ? m : 2 * n - 1 - m
		}
		const half = (i: number) => {
			let rate = 0
			for (let k = -K; k <= K; k++)
				rate += counts[refl(i + k)]! * kernel[k + K]!
			return (c.rootBase + (c.callArea * rate) / (sum * step)) / 2
		}
		const r2 = (n: number) => Math.round(n * 100) / 100
		const at = (u: number, v: number) =>
			o === "h" ? `${r(u)} ${r2(v)}` : `${r2(c.center + v)} ${r(u)}`
		const us = [
			u0,
			...Array.from({ length: n }, (_, i) => u0 + (i + 0.5) * step),
			u1
		]
		const ws = [0, ...Array.from({ length: n }, (_, i) => i), n - 1].map(half)
		const top = us.map((u, i) => at(u, -ws[i]!))
		const bottom = us.map((u, i) => at(u, ws[i]!)).reverse()
		return `M${top.join("L")}L${bottom.join("L")}Z`
	}

	// the root swells with its own calls, one body per stretch between idle gaps
	let root = ""
	let from = 0
	// (the snapshot rounds to the second, so the last call can land just past `total`)
	for (const g of [...gaps, { s0: total, s1: Infinity }]) {
		root += rootBand(
			data.root.ticks.filter(t => t >= from && t < g.s1),
			U(from),
			U(g.s0)
		)
		from = g.s1
	}

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
			sh.label!.box = boxOf(sh.label!, c.labelSize)
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
		...shapes.flatMap(s => (s.label ? [s.label.box] : [])),
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
	// end dots, with room for their ring and a little air, so a gap label never reads as one's own
	const dots = shapes.map(s => {
		const k = s.dotR + 4
		return {
			x0: s.end.x - k,
			x1: s.end.x + k,
			y0: s.end.y - k,
			y1: s.end.y + k
		}
	})
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
			return (
				box.x0 >= 0 &&
				box.x1 <= c.width &&
				!taken.some(t => hits(t, box)) &&
				!dots.some(t => hits(t, box))
			)
		})
		if (label) taken.push(boxOf(label, c.labelSize))
		return { mid, from: xy(a, 0), to: xy(b, 0), text, label }
	})

	// labels past the last lane, the end of time or the root's start widen the figure rather than spill out of it
	const x0 = Math.min(0, ...taken.map(b => b.x0 - 2))
	const x1 = Math.max(
		c.width,
		o === "h" ? uEnd + 6 : 0,
		...taken.map(b => b.x1 + 2)
	)
	const viewBox =
		o === "h" ?
			{ x: x0, y: vMin - 10, w: x1 - x0, h: vMax - vMin + 10 + 30 }
		:	{
				x: x0,
				y: 6,
				w: x1 - x0,
				h: Math.max(uEnd + 24, ...taken.map(b => b.y1 + 6)) - 6
			}

	/** where the sweep stands at position p ∈ [0, 1] of the replay (see `timeAt`) */
	const playhead = (p: number) => c.start + timeU(timeAt(p))

	return {
		o,
		c,
		lanes,
		viewBox,
		vMin,
		vMax,
		uEnd,
		shapes,
		root,
		rootLabel,
		rootEnd: xy(uEnd, 0),
		gapShapes,
		axis,
		prompts,
		playhead,
		pt,
		tickCount: allTicks.length
	}
}

export type Layout = ReturnType<typeof layout>
