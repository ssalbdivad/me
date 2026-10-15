import type { ReactNode } from "react"
import { measuredDay, TS59_CREDIT } from "~/data/caseStudies"
import { MergeChart } from "./perf/MergeChart"
import { Claim, Quickinfo } from "./Quickinfo"
import { Section } from "./Section"

export const Perf = () => (
	<Section
		id="perf"
		index="02"
		label="perf"
		title="Why your types are slow"
		className="perf"
		deck={
			<>
				<blockquote className="perf-epigraph">
					<span className="qm">"</span>our two-step process for fast typescript
					types: 1️⃣ build a type‑level benchmarking library 2️⃣ spend the prime
					of your life on cache optimizations
					<span className="qm">"</span>{" "}
					<a
						className="by mono link ext"
						href="https://bsky.app/profile/arktype.io/post/3lzbujo2cys2u"
					>
						@arktype.io
					</a>
				</blockquote>
				<p className="perf-lede">
					Most of my consulting happened in private repos. This one ended up in
					the compiler.
				</p>
			</>
		}
	>
		<CaseTs59 />
		<More />
	</Section>
)

const Ts2589 = () => (
	<Quickinfo
		className="squiggle"
		label="excessively deep and possibly infinite: the TS2589 error"
		trigger="excessively deep and possibly infinite"
	>
		<span className="qi-body qi-error">
			<span className="err">error</span> <span className="k">TS2589</span>: Type
			instantiation is excessively deep and possibly infinite.
		</span>
		<span className="qi-doc">
			<span className="qi-line">
				What TypeScript 5.8.2 says about 13 chained{" "}
				<code className="mono">.merge()</code> calls: the bench below,
				reproduced {measuredDay}.
			</span>
		</span>
		<span className="qi-foot">
			<span>tsc 5.8.2 · reproduced</span>
			<span>
				<i>TS 5.9.3: 0 errors</i>
			</span>
		</span>
	</Quickinfo>
)

/** One step of the story: a copper mono label beside its prose (perf.css `.beats`). */
const Beat = ({ label, children }: { label: string; children: ReactNode }) => (
	<li className="beat">
		<span className="beat-label mono">{label}</span>
		{children}
	</li>
)

const CaseTs59 = () => (
	<article className="case case-01" aria-labelledby="case-01-title" data-reveal>
		<div className="case-text">
			<div className="case-meta mono">
				<b>TypeScript 5.9</b>
				<span aria-hidden>·</span>
				<span>2025</span>
			</div>
			<h3 className="h3" id="case-01-title">
				Two innocuous-looking <span className="decl fn">useMutation</span> calls
				took about 2 seconds each to type-check.
			</h3>
		</div>
		<ol className="beats">
			<Beat label="the itch">
				<p>
					I was digging into tRPC type performance, and those two calls were in
					AnswerOverflow, a public tRPC app- so, for once,{" "}
					<a
						className="link ext"
						href="https://github.com/ssalbdivad/trpc-tsperf/blob/main/answeroverflow/client/summary.txt"
					>
						the trace is still up
					</a>
					. Zod schemas derived in chains like theirs are very common in the
					wild, especially in the repos I investigate.
				</p>
			</Beat>
			<Beat label="the hunt">
				<p>
					I minimized it to a chain of merges, the kind Zod's{" "}
					<code>.merge().pick().omit()</code> and tRPC's{" "}
					<code>{"merge<merge<…>>"}</code> produce. Each link roughly tripled
					the compiler's work until, 13 links in, TypeScript declared the chain{" "}
					<Ts2589 />. I counted it with Attest{" "}
					<span className="beat-down" aria-hidden="true">
						↓
					</span>
				</p>
				<MergeChart />
			</Beat>
			<Beat label="the fix">
				<p>
					I worked on it with Andarist (Mateusz Burzyński), who wrote the
					compiler patch: cache instantiations on type mappers. His PR opens:{" "}
					<a className="inline-quote" href={TS59_CREDIT.pr}>
						"@ssalbdivad found out that a chain of somewhat trivial operations
						can easily end up with dreaded 'Type instantiation is excessively
						deep and possibly infinite'."
					</a>{" "}
					I tested it on <Claim id="ts59Trpc">a bunch of tRPC monorepos</Claim>:
					it removed the depth errors, cut check time in half or better, or
					both.
				</p>
				{/* in the margin from 1024px, like Work's reactions; under the beat below that */}
				<p className="beat-aside mono">
					<a
						className="ext"
						href="https://bsky.app/profile/ssalbdivad.dev/post/3laetuvq4ac2u"
					>
						<span aria-hidden="true">// </span>"How has this man not been hired
						by the TypeScript team yet?" — me, about Andarist, 2024
					</a>
				</p>
			</Beat>
			<Beat label="the review">
				<p>
					Anders Hejlsberg's review asked to cache only the expensive
					instantiations. My reply:{" "}
					<a
						className="inline-quote"
						href="https://github.com/microsoft/TypeScript/pull/61505#issuecomment-2816034728"
					>
						"whether or not individual instantiations are expensive, if there
						are O(3^N) of them, they will eventually dominate the check time of
						the entire type."
					</a>
				</p>
			</Beat>
			<Beat label="shipped">
				<p>
					It merged in June 2025 and shipped in TypeScript 5.9 as "Cache
					Instantiations on Mappers"; the release notes name Zod and tRPC. Jake
					Bailey ported it to the Go compiler.
				</p>
			</Beat>
			<Beat label="what repos saw">
				<p>
					Type-checking AnswerOverflow's dashboard dropped from{" "}
					<Claim id="ts59AnswerOverflow">about 6.7s to 3.3s</Claim> (5 runs
					each, no overlap), and Jake Bailey on the TypeScript team
					independently reproduced the halving on the same repo. At Klarna, an
					engineer reported their check time dropping from{" "}
					<Claim id="ts59Klarna">six and a half minutes to about two</Claim>:{" "}
					<a
						className="inline-quote"
						href="https://github.com/microsoft/TypeScript/pull/61505#issuecomment-3102636519"
					>
						"This was a game-changer PR for us."
					</a>
				</p>
			</Beat>
		</ol>
		<p className="credit">
			{TS59_CREDIT.text} ·{" "}
			<a className="link ext" href={TS59_CREDIT.pr}>
				microsoft/TypeScript#61505
			</a>{" "}
			·{" "}
			<a className="link ext" href={TS59_CREDIT.blog}>
				TS 5.9 notes
			</a>{" "}
			·{" "}
			<a className="link ext" href={TS59_CREDIT.tsgo}>
				typescript-go#1358
			</a>
		</p>
	</article>
)

/** The public rest, one line each: no charts, a link where the receipt lives. */
const More = () => (
	<div className="more" data-reveal>
		<h3 className="more-label mono">
			<span aria-hidden="true">// </span>a few more, briefly
		</h3>
		<ul className="more-list">
			<li>
				<b className="mono">viem</b>
				<p>
					In MUD's build, TypeScript spent{" "}
					<Claim id="viemVariance">almost two seconds</Claim> just computing the
					variance of one viem type. I added <code className="kw">in</code>/
					<code className="kw">out</code> annotations to{" "}
					<a className="link ext" href="https://github.com/wevm/viem/pull/2557">
						viem itself
					</a>
					.
				</p>
			</li>
			<li>
				<b className="mono">Prisma</b>
				<p>
					I built their type benchmarks and helped speed up their generated
					types, which Prisma kindly wrote up in its{" "}
					<a
						className="link ext"
						href="https://github.com/prisma/orm/releases/tag/6.16.0"
					>
						6.16 release notes
					</a>
					.
				</p>
			</li>
			<li>
				<b className="mono">Mongoose</b>
				<p>
					I reworked <code className="kw">InferRawDocType</code>; it shipped in{" "}
					<a
						className="link ext"
						href="https://github.com/Automattic/mongoose/pull/15588"
					>
						8.19
					</a>
					.
				</p>
			</li>
		</ul>
		<p className="more-clients">
			Clients have included tRPC, Prisma, Convex, AWS Amplify, Speakeasy,
			Stately, wevm, Vanta and Cloudinary. Some stuff that looks super expensive
			is actually irrelevant; some stuff that looks innocuous is actually a
			massive problem. All you can do is learn heuristics, iterate and pray.
		</p>
	</div>
)
