/**
 * Snapshots the shape of the agent session that built this site into
 * src/data/agent-replay.json, for the replay in the agents section.
 *
 * METADATA ONLY. From each transcript line it keeps the timestamp, the entry
 * type, whether an assistant turn called a tool, and whether a turn ended;
 * labels and phases come from the sub-agents' .meta.json files. It reads a
 * user line's text only to spot Ntwine's injected wake check-ins (so they
 * aren't counted as the human's prompts); it never stores or prints message
 * content.
 *
 * A transcript that goes quiet after a finished turn and is later resumed (a
 * builder sent back to fix review findings) becomes one strand per working
 * stretch, so the braid never draws an idle agent as a busy one.
 *
 * It refuses to write while any agent is still working: a snapshot of an
 * unfinished session would make the page's generated copy claim a build that
 * hadn't finished. Pass --partial to write one anyway (for testing), and
 * --out=<path> to write somewhere other than src/data. Once shipped, the JSON
 * is a stored measurement: regenerate it only to extend the record.
 *
 * Run: node scripts/replay.ts [sessionId] [--partial] [--out=<path>]
 */
import { type } from "arktype"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"

const args = process.argv.slice(2)
const session =
	args.find(a => !a.startsWith("--")) ?? "29312f15-5357-48c3-80ee-cb69248d1c14"
const partial = args.includes("--partial")
const outArg = args.find(a => a.startsWith("--out="))?.slice("--out=".length)
const project =
	process.env.REPLAY_PROJECT_DIR ??
	join(homedir(), ".claude/projects/-home-ssalb-me")
const out =
	outArg ?
		new URL(`file://${resolve(outArg)}`)
	:	new URL("../src/data/agent-replay.json", import.meta.url)
/** a finished turn followed by this much silence ends a working stretch */
const resumeGap = 5 * 60_000

const Phase = type("'research' | 'design' | 'build' | 'review'")
type Phase = typeof Phase.infer

const Strand = type({
	/** the transcript's agent id */
	id: "string",
	label: "string",
	phase: Phase,
	startedAt: "string.date.iso",
	endedAt: "string.date.iso",
	/** false while the agent is still working at snapshot time */
	done: "boolean",
	/** the workflow recorded it as failed (it stopped without handing anything back) */
	"failed?": "true",
	toolCalls: "number.integer >= 0",
	/** each tool call, in whole seconds since the session started */
	ticks: "(number.integer >= 0)[]",
	/** the file it handed back */
	artifact: "string"
}).narrow(
	(s, ctx) =>
		s.ticks.length === s.toolCalls || ctx.mustBe("one tick per tool call")
)

export const AgentReplay = type({
	session: "string",
	generatedAt: "string.date.iso",
	root: {
		label: "string",
		startedAt: "string.date.iso",
		endedAt: "string.date.iso",
		toolCalls: "number.integer >= 0",
		ticks: "(number.integer >= 0)[]",
		/** messages typed by the human, in seconds since start (timing only) */
		prompts: "(number.integer >= 0)[]"
	},
	strands: Strand.array()
})

/** what each sub-agent was asked to produce, by its dispatch label */
const known: Record<
	string,
	{ label?: string; phase: Phase; artifact: string }
> = {
	"perf-case-studies": { phase: "research", artifact: "research-perf.md" },
	"talks-media": { phase: "research", artifact: "research-media.md" },
	"voice-buzz": { phase: "research", artifact: "research-voice.md" },
	"brand-local": { phase: "research", artifact: "research-brand.md" },
	"stats-apis": { phase: "research", artifact: "research-stats.md" },
	"tech-stack": { phase: "research", artifact: "research-stack.md" },
	story: { phase: "design", artifact: "design-story.md" },
	delight: { phase: "design", artifact: "design-delight.md" },
	visual: { phase: "design", artifact: "design-visual.md" },
	dataviz: { phase: "design", artifact: "design-dataviz.md" },
	synthesis: { phase: "design", artifact: "concept.md" },
	Work: { label: "work", phase: "build", artifact: "Work.tsx" },
	Perf: { label: "perf", phase: "build", artifact: "Perf.tsx" },
	"Agents talks": {
		label: "agents-talks",
		phase: "build",
		artifact: "Agents.tsx"
	},
	Eggs: { label: "eggs", phase: "build", artifact: "Eggs.tsx" },
	// dispatched to fix review findings in the shared shell, so every stretch of it is fixes
	"Shell fixes": {
		label: "shell · fixes",
		phase: "build",
		artifact: "styles.css"
	}
}

const reviewish =
	/review|audit|critic|verify|confirm|qa\b|armstrong|colin|check/i

const classify = (description: string, workflowPhase: string | undefined) => {
	const hit = known[description]
	if (hit)
		return {
			label: hit.label ?? description,
			phase: hit.phase,
			artifact: hit.artifact
		}
	// keep workflow labels like `review:a11y` as they are; slug anything else
	const label =
		/^[\w:.-]+$/.test(description) ? description : (
			description
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "")
		)
	const phase: Phase =
		reviewish.test(description) || reviewish.test(workflowPhase ?? "") ?
			"review"
		: workflowPhase === "Research" ? "research"
		: workflowPhase === "Propose" || workflowPhase === "Synthesize" ? "design"
		: "build"
	return { label, phase, artifact: "" }
}

type Line = {
	type?: string
	timestamp?: string
	isMeta?: boolean
	isCompactSummary?: boolean
	isVisibleInTranscriptOnly?: boolean
	origin?: unknown
	message?: { stop_reason?: string | null; content?: unknown }
	/** a message typed while the agent was busy arrives as a queued_command attachment */
	attachment?: {
		type?: string
		commandMode?: string
		origin?: unknown
		prompt?: unknown
	}
}

/**
 * A user line the human didn't type: injected context, a notification, a
 * compaction summary, or one of Ntwine's wake check-ins (⏰/⚠️/⏳), which carry
 * the same metadata as a typed prompt and are only told apart by their text.
 * The text is tested here and dropped; nothing from it is kept.
 */
const isInjected = (line: Line, content: unknown) => {
	if (
		line.isMeta ||
		line.origin ||
		line.isCompactSummary ||
		line.isVisibleInTranscriptOnly
	)
		return true
	const text =
		typeof content === "string" ? content
		: Array.isArray(content) ?
			content.map(c => (c as { text?: string })?.text ?? "").join("")
		:	""
	return (
		/<!-- ntwine-wake:[\w-]+ -->\s*$/.test(text) ||
		/^\s*(<task-notification>|\[SYSTEM NOTIFICATION|<system-reminder>|<ntwine-|\[ntwine\]|\[Cross-session )/.test(
			text
		)
	)
}

type Stretch = { start: number; end: number; tools: number[]; ended: boolean }

/**
 * Reads a transcript down to timing facts, split into working stretches.
 * Content never leaves this function.
 */
const scan = (path: string) => {
	const stretches: Stretch[] = []
	const prompts: number[] = []
	let current: Stretch | undefined
	const lines: Line[] = []
	for (const raw of readFileSync(path, "utf8").split("\n")) {
		if (!raw.trim()) continue
		try {
			const line: Line = JSON.parse(raw)
			if (line.timestamp) lines.push(line)
		} catch {}
	}
	lines.sort((a, b) => Date.parse(a.timestamp!) - Date.parse(b.timestamp!))
	for (const line of lines) {
		const t = Date.parse(line.timestamp!)
		if (!current || (current.ended && t - current.end > resumeGap)) {
			current = { start: t, end: t, tools: [], ended: false }
			stretches.push(current)
		}
		current.end = t
		const content = line.message?.content
		if (line.type === "assistant") {
			const calls =
				Array.isArray(content) ?
					content.filter(c => c?.type === "tool_use").length
				:	0
			for (let i = 0; i < calls; i++) current.tools.push(t)
			const stop = line.message?.stop_reason
			current.ended = stop === "end_turn" || stop === "stop_sequence"
		}
		const typed =
			typeof content === "string" ||
			(Array.isArray(content) &&
				content.length > 0 &&
				content.every(c => c?.type === "text"))
		if (line.type === "user" && typed && !isInjected(line, content))
			prompts.push(t)
		const queued =
			line.type === "attachment" && line.attachment?.type === "queued_command"
		if (
			queued &&
			line.attachment!.commandMode === "prompt" &&
			!line.attachment!.origin &&
			!isInjected(line, line.attachment!.prompt)
		)
			prompts.push(t)
	}
	const all = stretches.flatMap(s => s.tools)
	return {
		start: stretches[0]?.start,
		end: stretches.at(-1)?.end,
		tools: all,
		prompts,
		stretches
	}
}

const sessionDir = join(project, session)
const rootScan = scan(join(project, `${session}.jsonl`))
if (rootScan.start === undefined)
	throw new Error(`No events in the root transcript for ${session}`)
const t0 = rootScan.start

type Outcome = "result" | "failed"
const agentFiles: {
	path: string
	meta: { description: string; workflowPhase?: string; spawnDepth?: number }
	/** how the workflow journal says it ended, if it did */
	outcome: Outcome | undefined
}[] = []
const collect = (dir: string) => {
	if (!existsSync(dir)) return
	// a workflow's journal records each agent's result or failure (metadata lines only)
	const outcomes = new Map<string, Outcome>()
	const journal = join(dir, "journal.jsonl")
	if (existsSync(journal))
		for (const raw of readFileSync(journal, "utf8").split("\n")) {
			try {
				const { type, agentId } = JSON.parse(raw) as {
					type?: string
					agentId?: string
				}
				if (agentId && (type === "result" || type === "failed"))
					outcomes.set(agentId, type)
			} catch {}
		}
	for (const f of readdirSync(dir).filter(f => f.endsWith(".meta.json"))) {
		const path = join(dir, f.replace(".meta.json", ".jsonl"))
		if (!existsSync(path)) continue
		const agentId = f.replace(/^agent-|\.meta\.json$/g, "")
		agentFiles.push({
			path,
			meta: JSON.parse(readFileSync(join(dir, f), "utf8")),
			outcome: outcomes.get(agentId)
		})
	}
}
collect(join(sessionDir, "subagents"))
const workflows = join(sessionDir, "subagents/workflows")
if (existsSync(workflows))
	for (const wf of readdirSync(workflows)) collect(join(workflows, wf))

const offset = (t: number) => Math.max(0, Math.round((t - t0) / 1000))
const iso = (t: number) => new Date(t).toISOString()

const strands = agentFiles
	.filter(({ meta }) => (meta.spawnDepth ?? 1) === 1)
	.flatMap(({ path, meta, outcome }) => {
		const id = path
			.split("/")
			.at(-1)!
			.replace(/^agent-|\.jsonl$/g, "")
		const kind = classify(meta.description, meta.workflowPhase)
		const stretches = scan(path).stretches
		return stretches.map((s, i) => ({
			id: i === 0 ? id : `${id}-${i + 1}`,
			...kind,
			// a resumed builder is back for review fixes
			...(i > 0 &&
				!kind.label.endsWith("fixes") && { label: `${kind.label} · fixes` }),
			startedAt: iso(s.start),
			endedAt: iso(s.end),
			done: s.ended || (i === stretches.length - 1 && outcome !== undefined),
			...(i === stretches.length - 1 &&
				outcome === "failed" && { failed: true as const }),
			toolCalls: s.tools.length,
			ticks: s.tools.map(offset)
		}))
	})
	.sort(
		(a, b) =>
			a.startedAt.localeCompare(b.startedAt) || a.label.localeCompare(b.label)
	)

const running = strands.filter(s => !s.done)
if (running.length && !partial) {
	console.error(
		`Not writing: ${running.length} sub-agent stretch(es) still working: ${running.map(s => s.label).join(", ")}.\n` +
			"Re-run once they land, or pass --partial to write an unfinished snapshot."
	)
	process.exit(1)
}

const lastEvent = Math.max(
	rootScan.end ?? t0,
	...strands.map(s => Date.parse(s.endedAt))
)

const replay = AgentReplay.assert({
	session,
	generatedAt: new Date().toISOString(),
	root: {
		label: "@personal-page",
		startedAt: iso(t0),
		endedAt: iso(lastEvent),
		toolCalls: rootScan.tools.length,
		ticks: rootScan.tools.map(offset),
		prompts: rootScan.prompts.map(offset)
	},
	strands
})

// one line per tick array keeps the snapshot diffable
const json = JSON.stringify(replay, null, "\t").replace(
	/\[([\d,\s]*)\]/g,
	(_, xs: string) => `[${xs.trim().split(/,\s*/).filter(Boolean).join(", ")}]`
)
writeFileSync(out, `${json}\n`)

const dur = (a: string, b: string) => {
	const s = Math.round((Date.parse(b) - Date.parse(a)) / 1000)
	return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`
}
console.log(
	`${replay.root.label}  ${replay.root.startedAt} → ${replay.root.endedAt}  ${replay.root.toolCalls} tool calls`
)
for (const s of replay.strands)
	console.log(
		[
			s.phase.padEnd(8),
			s.label.padEnd(18),
			s.startedAt.slice(11, 19),
			s.endedAt.slice(11, 19),
			dur(s.startedAt, s.endedAt).padStart(7),
			String(s.toolCalls).padStart(4),
			s.failed ? "(failed)"
			: s.done ? ""
			: "(running)"
		].join("  ")
	)
console.log(
	`wrote ${out.pathname}: ${replay.strands.length} sub-agents, ${replay.strands.reduce((n, s) => n + s.toolCalls, 0)} tool calls`
)
