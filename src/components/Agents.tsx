import {
	clock,
	data,
	duration,
	groups,
	strands,
	total,
	totals,
	type Phase
} from "./agents/model"
import { Replay } from "./agents/Replay"
import { Section } from "./Section"

const verbs: Record<Phase, string> = {
	research: "researched",
	design: "designed",
	build: "built",
	review: "reviewed"
}

const list = (words: string[]) =>
	words.length < 2 ?
		(words[0] ?? "")
	:	`${words.slice(0, -1).join(", ")} and ${words.at(-1)}`

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// generated from the snapshot's totals, so it can only claim what the data shows;
// while any strand was still working at snapshot time it speaks in the present tense
const calls = `${totals.toolCalls.toLocaleString("en")} tool calls`
// only messages sent before the build fanned out set the bar; later ones
// ("are we close?") were chat, so they don't get credited as direction
const firstBuild =
	groups.find(g => g.phase === "build")?.s0 ?? Number.POSITIVE_INFINITY
const direction = data.root.prompts.filter(s => s < firstBuild).length
const prompts =
	direction <= 1 ? "one brief"
	: direction === 2 ? "one brief and a follow-up"
	: `one brief and ${direction - 1} follow-ups`
const colophon =
	totals.running > 0 ?
		`This page is being ${list(totals.phases.map(p => verbs[p]))} by one agent thread. So far: ${totals.subAgents} sub-agents, ${calls}, ${duration(totals.agentSeconds)} of agent time. I set the bar in ${prompts}; they do the legwork. Every strand and timestamp above is from the session.`
	:	`${capitalize(list(totals.phases.map(p => verbs[p])))} by one agent thread that fanned out to ${totals.subAgents} sub-agents: ${calls}, ${duration(totals.agentSeconds)} of agent time in ${duration(totals.wallSeconds)} of wall clock. I set the bar in ${prompts}; they did the legwork. Every strand and timestamp above is from the session.`

const span = (iso: string, s1: number) => `${iso.slice(11, 19)}–${clock(s1)}`

export const Agents = () => (
	<Section id="agents" index="03" label="agents" title="How I work with agents">
		{/* the replay's captions play these four rules; this sentence is where
		    no-JS readers and the prerender get them */}
		<p className="agents-intro" data-reveal>
			Most days I have a lot of coding agents working on Pullfrog at once. I run
			them from{" "}
			<a
				className="link ext nowrap"
				href="https://github.com/ssalbdivad/ntwine"
			>
				ntwine
			</a>
			, which I'm building to run them in parallel and queue up the ones that
			need me. The rules I've ended up with, for them and for me: size work by
			scope, never in days; report honest effect sizes; lead with what changed;
			preserve evidence.
		</p>

		<div className="replay-block">
			<h3 className="h3 replay-title" data-reveal>
				{totals.running > 0 ?
					"This page is being built that way."
				:	"The first version of this page was built that way."}
			</h3>
			<Replay />
			<p className="replay-copy">{colophon}</p>
			<p className="replay-note mono">
				// scripts/replay.ts reads the session's transcript metadata (labels,
				timestamps, tool-call counts) into a snapshot taken{" "}
				{data.generatedAt.slice(0, 16).replace("T", " ")} UTC
				{totals.running > 0 &&
					`, while ${totals.running} sub-agents were still working`}
				. It reads message text only to tell mine from automated check-ins, and
				stores none of it.
			</p>
			<details className="twin replay-table">
				<summary>Every strand, as a table</summary>
				<div className="table-scroll">
					<table className="mono tnum">
						<thead>
							<tr>
								<th scope="col">strand</th>
								<th scope="col">phase</th>
								<th scope="col">UTC</th>
								<th scope="col">length</th>
								<th scope="col">tool calls</th>
								<th scope="col">handed back</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<th scope="row">{data.root.label}</th>
								<td>root</td>
								<td>{span(data.root.startedAt, total)}</td>
								<td>{duration(total)}</td>
								<td>{data.root.toolCalls}</td>
								<td>this page</td>
							</tr>
							{strands.map(s => (
								<tr key={s.id} className={`ph-${s.phase}`}>
									<th scope="row">{s.name}</th>
									<td>
										<i className="dot" aria-hidden="true" />
										{s.phase}
									</td>
									<td>{span(s.startedAt, s.s1)}</td>
									<td>{duration(s.s1 - s.s0)}</td>
									<td>{s.toolCalls}</td>
									<td>
										{s.failed ?
											"stopped, no result"
										: s.done ?
											s.artifact || "findings"
										:	`${s.artifact || "findings"} (still working)`}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</details>
		</div>
	</Section>
)
