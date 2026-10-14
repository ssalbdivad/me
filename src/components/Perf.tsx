import { measuredDay, MONGOOSE, PRISMA, TS59_CREDIT } from "~/data/caseStudies"
import { formatNumber } from "~/lib/format"
import { Dumbbell } from "./perf/Dumbbell"
import { MergeChart } from "./perf/MergeChart"
import { Payoffs } from "./perf/Payoffs"
import { ViemTrace } from "./perf/ViemTrace"
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
					Clients have included tRPC, Drizzle, Prisma, Convex, AWS Amplify,
					Speakeasy, Stately, wevm, Vanta and Cloudinary. Most of that work is
					private; these three cases are public.
				</p>
			</>
		}
	>
		<CaseTs59 />
		<PullQuote />
		<CaseViem />
		<CasePrisma />
	</Section>
)

const Meta = ({ n, what, year }: { n: string; what: string; year: string }) => (
	<div className="case-meta mono">
		<b>case {n}</b>
		<span>{what}</span>
		<span aria-hidden>·</span>
		<span>{year}</span>
	</div>
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
				reproduced {measuredDay}. 5.9 checks the same chain without a word.
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

const CaseTs59 = () => (
	<article className="case case-01" aria-labelledby="case-01-title" data-reveal>
		<div className="case-text">
			<Meta n="01" what="TypeScript compiler" year="2025" />
			<h3 className="h3" id="case-01-title">
				Two innocent-looking <span className="decl fn">useMutation</span> calls
				took about 2 seconds each to type-check.
			</h3>
			<div className="case-cols">
				<p>
					Chained Zod- and tRPC-style types made the compiler redo every earlier
					link- O(3
					<sup>N</sup>) instantiations, ending in <Ts2589 /> errors.
				</p>
				<p>
					<b>I traced it into TypeScript itself,</b> minimized the repro,
					benchmarked it with Attest and argued it through review- including my
					reply to Anders Hejlsberg:{" "}
					<a
						className="inline-quote"
						href="https://github.com/microsoft/TypeScript/pull/61505#issuecomment-2816034728"
					>
						"…if there are O(3^N) of them, they will eventually dominate the
						check time of the entire type."
					</a>{" "}
					Mateusz Burzyński (@Andarist) wrote the compiler patch; it shipped in
					TypeScript 5.9 and was ported to the Go compiler.
				</p>
			</div>
		</div>
		<MergeChart />
		<Payoffs />
		<p className="credit">
			Compiler patch by Mateusz Burzyński (@Andarist) ·{" "}
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
		<p className="case-foot">
			The ~2× is 5 runs per side with no overlap. My 13.04s → 6.00s is one run.
			Klarna's ~3× is self-reported, in one comment.
		</p>
	</article>
)

const PullQuote = () => (
	<figure className="pull" data-reveal>
		<blockquote>
			<span className="qm">"</span>Please contact @ssalbdivad. He is probably
			the best TypeScript performance consultant in the world…
			<span className="qm">"</span>
		</blockquote>
		<figcaption className="mono">
			a stranger in Prisma's issue tracker ·{" "}
			<a
				className="link"
				href="https://github.com/prisma/orm/issues/29011#issuecomment-4167854903"
			>
				prisma/orm#29011
			</a>
		</figcaption>
	</figure>
)

const CaseViem = () => (
	<article className="case case-02" aria-labelledby="case-02-title" data-reveal>
		<div className="case-text case-split">
			<div>
				<Meta n="02" what="viem + MUD" year="2024" />
				<h3 className="h3" id="case-02-title">
					One type. Nine type parameters.
					<br />
					<Claim id="viemVariance">1.86 seconds.</Claim>
				</h3>
				<p>
					In MUD's build, TypeScript spent 1.86s just computing the variance of
					one viem type, and instantiation counts never showed it. Only a trace
					did. With variance annotated by hand, the entire file checked in
					1.28s. Explicit <code className="kw">in</code>/
					<code className="kw">out</code> annotations now ship in viem itself,
					so every consumer skips that work.
				</p>
			</div>
			<figure className="case-quote">
				<blockquote>
					<span className="qm">"</span>avoiding the variance checks reduced the
					check time for a simple repo by over a second locally.
					<span className="qm">"</span>
				</blockquote>
				<figcaption className="mono">
					— me, in{" "}
					<a className="link" href="https://github.com/wevm/viem/pull/2557">
						wevm/viem#2557
					</a>
				</figcaption>
			</figure>
		</div>
		<ViemTrace />
		<p className="case-foot">
			Slices aligned at 0; offsets within the original Perfetto trace omitted.
			Source:{" "}
			<a className="link" href="https://github.com/latticexyz/mud/pull/2956">
				latticexyz/mud#2956
			</a>
			.
		</p>
	</article>
)

const pctOf = (before: number, after: number) => (after / before) * 100

const CasePrisma = () => (
	<article className="case case-03" aria-labelledby="case-03-title" data-reveal>
		<div className="case-text">
			<Meta n="03" what="Prisma ORM + Mongoose" year="2025" />
			<h3 className="h3" id="case-03-title">
				Prisma: 45% less check time on the generated file we restructured.
			</h3>
			<p className="badges mono">
				<Claim id="prismaCheck">
					<b>−45%</b> check time · <b>−75%</b> lines
				</Claim>
			</p>
			<figure className="case-quote">
				<blockquote>
					<span className="qm">"</span>We've worked with TypeScript expert David
					Blass to find ways for improving the type checking performance in
					Prisma ORM…<span className="qm">"</span>
				</blockquote>
				<figcaption className="mono">
					—{" "}
					<a className="link" href={PRISMA.sources[1]}>
						Prisma 6.16.0 release notes
					</a>
				</figcaption>
			</figure>
		</div>
		<div className="dumbbells">
			<Dumbbell
				title={
					<>
						Prisma · <code>{PRISMA.file}</code>, % of before
					</>
				}
				rows={PRISMA.rows.map(r => ({
					label: r.label,
					code: r.unit === "µs",
					before: 100,
					after: pctOf(r.before, r.after),
					beforeText:
						r.unit === "µs" ? `${formatNumber(r.before)}µs` : String(r.before),
					afterText:
						r.unit === "µs" ? `${formatNumber(r.after)}µs` : String(r.after)
				}))}
				max={100}
				ticks={[0, 25, 50, 75, 100]}
				mobileTicks={[0, 50, 100]}
				tickLabel={v => `${v}%`}
				axisTitle="% of before"
				describe="Prisma generated file, as a share of before: check 54.6 percent, parse 30.9, bind 27.0, lines of code 24.2."
			>
				<p className="case-foot">
					The 45% is one file (<code>{PRISMA.file}</code>), not the whole
					client. Measured in{" "}
					<a className="link" href={PRISMA.sources[0]}>
						prisma/orm#27046
					</a>
					; Prisma reports the same result on{" "}
					<a className="link" href={PRISMA.sources[2]}>
						its blog
					</a>
					.
				</p>
				<DumbbellTable
					unit="µs or lines"
					rows={PRISMA.rows.map(r => [
						r.label,
						`${formatNumber(r.before)} ${r.unit}`,
						`${formatNumber(r.after)} ${r.unit}`
					])}
				/>
			</Dumbbell>
			<Dumbbell
				title={
					<>
						Also shipped: Mongoose 8.19, <code>InferRawDocType</code>,{" "}
						<Claim id="mongooseInst">36–67% fewer instantiations</Claim>.
					</>
				}
				rows={MONGOOSE.rows}
				max={4500}
				ticks={[0, 1000, 2000, 3000, 4000]}
				mobileTicks={[0, 2000, 4000]}
				tickLabel={v => (v ? `${v / 1000}K` : "0")}
				axisTitle="instantiations"
				describe="Mongoose instantiations before and after: simple 501 to 320, mixed 1,626 to 535, nested 4,214 to 2,097."
			>
				<p className="case-foot">
					On its benchmarks. The maintainer's whole-repo count was flat (+0.9%).{" "}
					<a className="link" href={MONGOOSE.sources[0]}>
						Automattic/mongoose#15588
					</a>
					.
				</p>
				<DumbbellTable
					unit="instantiations"
					rows={MONGOOSE.rows.map(r => [
						r.label,
						formatNumber(r.before),
						formatNumber(r.after)
					])}
				/>
			</Dumbbell>
		</div>
	</article>
)

const DumbbellTable = ({ rows, unit }: { rows: string[][]; unit: string }) => (
	<details className="viz-table twin">
		<summary>Data</summary>
		<div className="viz-table-scroll">
			<table className="mono tnum">
				<caption className="sr-only">{unit}</caption>
				<thead>
					<tr>
						<th scope="col" />
						<th scope="col">before</th>
						<th scope="col">after</th>
					</tr>
				</thead>
				<tbody>
					{rows.map(([label, ...cells]) => (
						<tr key={label}>
							<th scope="row">{label}</th>
							{cells.map((c, i) => (
								<td key={i}>{c}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	</details>
)
