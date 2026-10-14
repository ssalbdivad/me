import raw from "~/data/agent-replay.json"

/**
 * The session that built this page, as metadata: who ran, when, and when each
 * tool call happened. Written by scripts/replay.ts (which validates it with
 * ArkType) and kept as a stored measurement. Everything the agents section
 * says about the session is derived from this file, so it can't overclaim.
 */
export type Phase = "research" | "design" | "build" | "review"

type StrandData = {
	id: string
	label: string
	phase: Phase
	artifact: string
	startedAt: string
	endedAt: string
	done: boolean
	/** the workflow recorded it as failed: it stopped without handing anything back */
	failed?: true
	toolCalls: number
	ticks: number[]
}

type ReplayData = {
	session: string
	generatedAt: string
	root: {
		label: string
		startedAt: string
		endedAt: string
		toolCalls: number
		ticks: number[]
		prompts: number[]
	}
	strands: StrandData[]
}

export const data = raw as ReplayData

export const phases: Phase[] = ["research", "design", "build", "review"]

/** a stretch with nothing running for this long is drawn compressed */
const idleGap = 300
/** strands of one phase dispatched within this many seconds of each other fan out together */
const fanWindow = 90

const t0 = Date.parse(data.root.startedAt)
const sec = (iso: string) => (Date.parse(iso) - t0) / 1000

type Strand = StrandData & {
	s0: number
	s1: number
	group: number
	/** the label as a reader would say it */
	name: string
}

/**
 * Workflow ids, as a reader would say them: `r3-review:design` is "design
 * review · round 3", any `verify:*` is "verifier". Other labels pass through.
 */
export const displayName = (label: string) => {
	const m = /^(?:r(\d+)-)?(review|verify|check|confirm):(.+)$/.exec(label)
	if (!m) return label
	const [, round, kind, angle] = m
	const base =
		kind === "verify" || kind === "confirm" ? "verifier"
		: kind === "check" ? `${angle} check`
		: `${angle} review`
	return round ? `${base} · round ${round}` : base
}

type Group = {
	index: number
	phase: Phase
	s0: number
	/** when the last of them landed, if they all have */
	landing: number | undefined
	strands: Strand[]
}

/** total seconds, start to snapshot */
export const total = sec(data.root.endedAt)

export const strands: Strand[] = data.strands.map(s => ({
	...s,
	s0: sec(s.startedAt),
	s1: sec(s.endedAt),
	group: -1,
	name: displayName(s.label)
}))

export const groups: Group[] = []
for (const phase of phases) {
	let current: Group | undefined
	for (const s of strands
		.filter(s => s.phase === phase)
		.sort((a, b) => a.s0 - b.s0)) {
		const last = current?.strands.at(-1)
		if (!current || !last || s.s0 - last.s0 > fanWindow) {
			current = {
				index: groups.length,
				phase,
				s0: s.s0,
				landing: undefined,
				strands: []
			}
			groups.push(current)
		}
		s.group = current.index
		current.strands.push(s)
	}
}
for (const g of groups)
	g.landing =
		g.strands.every(s => s.done) ?
			Math.max(...g.strands.map(s => s.s1))
		:	undefined
groups.sort((a, b) => a.s0 - b.s0)

/**
 * Runs of one phase whose strands overlap (or follow within the fan window):
 * a review round and its verifiers, a burst of fixes. A big cluster gets one
 * count label instead of one label per strand.
 */
type Cluster = {
	phase: Phase
	s0: number
	s1: number
	strands: Strand[]
	/** "review · 12"; a build cluster made only of fix stretches says "fixes · 5" */
	label: string
}

export const clusters: Cluster[] = []
for (const phase of phases) {
	let current: Cluster | undefined
	for (const s of strands
		.filter(s => s.phase === phase)
		.sort((a, b) => a.s0 - b.s0)) {
		if (!current || s.s0 > current.s1 + fanWindow) {
			current = { phase, s0: s.s0, s1: s.s1, strands: [], label: "" }
			clusters.push(current)
		}
		current.s1 = Math.max(current.s1, s.s1)
		current.strands.push(s)
	}
}
for (const k of clusters) {
	const kind =
		k.phase === "build" && k.strands.every(s => /fix/i.test(s.label)) ?
			"fixes"
		:	k.phase
	k.label = `${kind} · ${k.strands.length}`
}

/** stretches where nothing at all was happening (e.g. waiting on me) */
export const gaps: { s0: number; s1: number }[] = (() => {
	const busy: [number, number][] = [
		...strands.map(s => [s.s0, s.s1] as [number, number]),
		...data.root.ticks.map(t => [t, t] as [number, number]),
		...data.root.prompts.map(t => [t, t] as [number, number]),
		[0, 0] as [number, number],
		[total, total] as [number, number]
	].sort((a, b) => a[0] - b[0])
	const out: { s0: number; s1: number }[] = []
	let end = 0
	for (const [a, b] of busy) {
		if (a - end > idleGap) out.push({ s0: end, s1: a })
		end = Math.max(end, b)
	}
	return out
})()

/** stretches where the root thread made no calls while its sub-agents worked */
export const rootWaits: { s0: number; s1: number }[] = (() => {
	const ticks = [...data.root.ticks].sort((a, b) => a - b)
	const out: { s0: number; s1: number }[] = []
	for (let i = 1; i < ticks.length; i++) {
		const a = ticks[i - 1]!
		const b = ticks[i]!
		if (b - a > 120 && strands.some(s => s.s0 < b && s.s1 > a))
			out.push({ s0: a, s1: b })
	}
	return out
})()

/**
 * Time → position along the braid. Linear, except idle gaps, which collapse
 * to a fixed width (drawn with ≈ and labelled with their true length).
 */
export const timeScale = (span: number, gapWidth: number) => {
	const idle = gaps.reduce((n, g) => n + g.s1 - g.s0, 0)
	const k = (span - gaps.length * gapWidth) / Math.max(1, total - idle)
	const u = (s: number) => {
		let at = 0
		let prev = 0
		for (const g of gaps) {
			if (s <= g.s0) break
			at += (g.s0 - prev) * k
			if (s < g.s1) return at + ((s - g.s0) / (g.s1 - g.s0)) * gapWidth
			at += gapWidth
			prev = g.s1
		}
		return at + (s - prev) * k
	}
	/** position → time (inverse of u) */
	const s = (pos: number) => {
		let lo = 0
		let hi = total
		for (let i = 0; i < 40; i++) {
			const mid = (lo + hi) / 2
			if (u(mid) < pos) lo = mid
			else hi = mid
		}
		return (lo + hi) / 2
	}
	return { u, s, k }
}

/** the readout's events, in time order */
type ReplayEvent = { s: number; text: string; phase?: Phase }

export const plural = (n: number, word: string) =>
	`${n.toLocaleString("en")} ${word}${n === 1 ? "" : "s"}`

export const events: ReplayEvent[] = [
	...data.root.prompts.map((s, i) => ({
		s,
		text: `${data.root.label} ← ${i === 0 ? "my brief" : "a note from me"}`
	})),
	...groups.map(g => ({
		s: g.s0,
		phase: g.phase,
		text:
			g.strands.length === 1 ?
				`${data.root.label} → ${g.strands[0]!.name}`
			:	`${data.root.label} → ${g.strands.length} ${g.phase} sub-agents`
	})),
	...strands
		.filter(s => s.done)
		.map(s => ({
			s: s.s1,
			phase: s.phase,
			text:
				s.failed ?
					`${s.name} stopped without a result · ${plural(s.toolCalls, "tool call")}`
				:	`${s.name} → ${s.artifact || "findings"} · ${plural(s.toolCalls, "tool call")}`
		}))
].sort((a, b) => a.s - b.s)

export const totals = (() => {
	const subCalls = strands.reduce((n, s) => n + s.toolCalls, 0)
	const agentSeconds = strands.reduce((n, s) => n + (s.s1 - s.s0), 0)
	return {
		subAgents: strands.length,
		toolCalls: data.root.toolCalls + subCalls,
		agentSeconds,
		wallSeconds: total,
		prompts: data.root.prompts.length,
		running: strands.filter(s => !s.done).length,
		phases: phases.filter(p => strands.some(s => s.phase === p))
	}
})()

/** every tool call in the session, sorted, for the running tally */
export const allTicks = [
	...data.root.ticks,
	...strands.flatMap(s => s.ticks)
].sort((a, b) => a - b)

/** count of sorted values ≤ x */
export const countUpTo = (sorted: number[], x: number) => {
	let lo = 0
	let hi = sorted.length
	while (lo < hi) {
		const mid = (lo + hi) >> 1
		if (sorted[mid]! <= x) lo = mid + 1
		else hi = mid
	}
	return lo
}

export const clock = (s: number) =>
	new Date(t0 + s * 1000).toISOString().slice(11, 19)

/** 4,256 → "1h 10m"; 290 → "4m 50s" */
export const duration = (seconds: number) => {
	const m = Math.round(seconds / 60)
	if (seconds < 600) {
		const s = Math.round(seconds)
		return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`
	}
	return m < 60 ?
			`${m}m`
		:	`${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`
}

const dayFormat = new Intl.DateTimeFormat("en", {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC"
})
const dayPart = (t: number, type: Intl.DateTimeFormatPartTypes) =>
	dayFormat.formatToParts(t).find(p => p.type === type)!.value
const tEnd = t0 + total * 1000

/** "Oct 13, 2026", or "Oct 13–14, 2026" when the session crosses UTC midnight */
export const sessionDay =
	dayFormat.format(t0) === dayFormat.format(tEnd) ? dayFormat.format(t0)
	: (
		dayPart(t0, "month") === dayPart(tEnd, "month") &&
		dayPart(t0, "year") === dayPart(tEnd, "year")
	) ?
		`${dayPart(t0, "month")} ${dayPart(t0, "day")}–${dayPart(tEnd, "day")}, ${dayPart(tEnd, "year")}`
	:	`${dayFormat.format(t0)} – ${dayFormat.format(tEnd)}`
