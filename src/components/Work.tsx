import type { ReactNode } from "react"
import { Claim } from "./Quickinfo"
import { Section } from "./Section"
import { Collapse } from "./work/Collapse"
import { TypeLine } from "./work/TypeLine"

type Link = { href: string; label: string; ext?: true }

const slug = (name: string) => name.toLowerCase().replace(/\W+/g, "-")

const Row = ({
	id,
	index,
	name,
	emoji,
	role,
	links,
	lead,
	body,
	margin,
	child,
	children
}: {
	id: string
	index?: string
	name: string
	emoji?: string
	role?: string
	links: Link[]
	lead: ReactNode
	body: ReactNode
	/** other people's reactions, one quote per person, then any fact said small */
	margin?: ReactNode[]
	child?: true
	children?: ReactNode
}) => (
	<article
		className="w-row"
		id={id}
		data-child={child}
		aria-labelledby={`w-${slug(name)}`}
	>
		<div className="w-main" data-reveal>
			<span className="w-idx mono" aria-hidden>
				{child ? "" : index}
			</span>
			<div className="w-head">
				<h3
					className="w-name decl"
					id={`w-${slug(name)}`}
					data-long={name.length > 12 || undefined}
				>
					{name}
					{emoji && <span className="w-emoji">{emoji}</span>}
				</h3>
				{role && <p className="w-role mono">{role}</p>}
				<p className="w-links mono">
					{links.map(link => (
						<a
							key={link.href}
							className={link.ext ? "w-go ext" : "w-go"}
							href={link.href}
							{...(link.href.startsWith("#") ?
								{}
							:	{ target: "_blank", rel: "noreferrer" })}
						>
							{link.label}
							{!link.ext && (
								<span className="w-arrow" aria-hidden>
									→
								</span>
							)}
						</a>
					))}
				</p>
			</div>
			<p className="w-pitch">
				<strong>{lead}</strong> {body}
			</p>
			{margin && (
				<ul className="w-margin mono">
					{margin.map((note, i) => (
						<li key={i}>{note}</li>
					))}
				</ul>
			)}
		</div>
		{children && <div className="w-extra">{children}</div>}
	</article>
)

const out = { target: "_blank", rel: "noreferrer" } as const

/**
 * Inline text rather than .ext's inline-block, so line breaking keeps it on
 * the word before it (an inline-block can wrap onto a line of its own).
 */
const Ext = () => (
	<span className="w-ext" aria-hidden>
		↗
	</span>
)

/**
 * Someone's words, verbatim, linked to where they said them. The dash, the
 * name and its arrow wrap as one, so a name never splits across lines and
 * the dash never ends one.
 */
const Quote = ({
	href,
	who,
	children
}: {
	href: string
	who: string
	children: string
}) => (
	<a className="w-note w-quote" href={href} {...out}>
		{`"${children}" `}
		<span className="w-who">
			{`—\u00a0${who}`}
			<Ext />
		</span>
	</a>
)

/** A note in my own words, set as a code comment. */
const Comment = ({ children }: { children: ReactNode }) => (
	<span className="w-note w-comment">// {children}</span>
)

export const Work = () => (
	<Section id="work" index="01" label="work" title="Things I've made">
		<div className="w-list">
			<Row
				id="arktype"
				index="01"
				name="ArkType"
				emoji="⛵"
				role="author · 2022–"
				links={[{ href: "https://arktype.io", label: "arktype.io" }]}
				lead="It started as a question I didn't think had a good answer: how close can you get to TypeScript at runtime?"
				body={
					<>
						Pretty close, it turns out. If you already know TypeScript,
						congratulations- you just learned most of ArkType's syntax. The
						parser is isomorphic: one implementation lives in the type system,
						checking each character as you type, and its runtime twin compiles
						the same definition to JIT-friendly validation code. It's downloaded{" "}
						<Claim id="arktypeDownloads">millions of times a month</Claim>, and
						the TypeScript team runs it in their regression tests, which gives
						me a lot of peace of mind.
					</>
				}
				margin={[
					<Quote
						href="https://x.com/AndaristRake/status/1658758179159769089"
						who="Andarist"
					>
						this is truly the darkest TypeScript magic I've seen
					</Quote>,
					<Quote
						href="https://x.com/mattpocockuk/status/1911109041650385015"
						who="Matt Pocock"
					>
						…a LOT of Arktype evangelists in the comments. Really having a
						moment, eh?
					</Quote>,
					<Quote
						href="https://x.com/BHolmesDev/status/1880045919225409776"
						who="Ben Holmes"
					>
						If Zod is the Toyota pickup of validators, Arktype is the lambo
					</Quote>,
					<Quote
						href="https://bsky.app/profile/mapleleaf.dev/post/3lkbxtgisdk27"
						who="MapleLeaf"
					>
						arktype is such a nonsensically impressive piece of tech that it
						feels like it shouldn't exist lmao
					</Quote>
				]}
			>
				<TypeLine />
			</Row>
			<div className="w-family">
				<Row
					child
					id="arkregex"
					name="ArkRegex"
					role="2025"
					links={[
						{
							href: "https://x.com/arktypeio/status/1983210635266498649",
							label: "launch post"
						},
						{
							href: "https://www.infoq.com/news/2026/01/arkregex-introduced-typescript",
							label: "InfoQ",
							ext: true
						}
					]}
					lead={
						<>
							<code>new RegExp()</code>, with types.
						</>
					}
					body={
						<>
							Typed regex is a pipe dream- or at least, it was. ArkRegex parses
							your pattern in the type system, so capture groups are inferred
							and a malformed pattern is a type error.{" "}
							<a className="link" href="#top">
								(That's it up top.)
							</a>{" "}
							I've learned a lot about regex that I probably didn't want to
							know.
						</>
					}
					margin={[
						<Quote
							href="https://x.com/colinhacks/status/1983219486195884489"
							who="Colin McDonnell"
						>
							this guy must be stopped
						</Quote>,
						<Comment>
							many of the replies reduced to "wtf" (
							<a
								href="https://x.com/aidenybai/status/1983212326464397535"
								{...out}
							>
								Aiden Bai
								<Ext />
							</a>
							,{" "}
							<a
								href="https://bsky.app/profile/tkdodo.eu/post/3m4bmfd3hhc2u"
								{...out}
							>
								TkDodo
								<Ext />
							</a>
							)
						</Comment>
					]}
				/>
				<Row
					child
					id="attest"
					name="Attest"
					role="2023"
					links={[
						{ href: "https://arktype.io/docs/attest/benches", label: "docs" }
					]}
					lead="Type-level benchmarks and assertions."
					body={
						<>
							I had to build it to build ArkType. Attest counts type
							instantiations instead of timing the compiler, so the result is
							deterministic and CI can catch a PR that makes types slower. It's
							how I measured the compiler fix below, and how projects like{" "}
							<Claim id="i18next">i18next</Claim> benchmark their own types.
						</>
					}
					margin={[
						<Quote
							href="https://www.youtube.com/watch?v=eoqpXbe8dyA&t=701s"
							who="Theo"
						>
							…his understanding of TypeScript server performance is unmatched
						</Quote>
					]}
				/>
				<Row
					child
					id="arkschema"
					name="ArkSchema"
					links={[]}
					lead="The set theory underneath."
					body={
						<>
							It knows <code>number &gt; 5</code> is a subtype of{" "}
							<code>number &gt; 0</code>, and that divisible by 2 and by 3
							reduces to divisible by 6, so ArkType can compare, intersect and
							narrow types at runtime. Finding a type's fully reduced form is
							one of my favorite problems in the world. If that didn't scare you
							off, the 13-minute version is{" "}
							<a className="link" href="#talks">
								my Effect Days talk<span aria-hidden> ↓</span>
							</a>
						</>
					}
				/>
			</div>
			<Row
				id="standard-schema"
				index="02"
				name="Standard Schema"
				role="co-creator · 2024–"
				links={[
					{ href: "https://standardschema.dev", label: "standardschema.dev" }
				]}
				lead="One small interface every validator and framework can agree on."
				body={
					<>
						I co-designed it with the creators of Zod and Valibot. Now tRPC,
						TanStack, Hono, React Hook Form and dozens more accept whichever
						validator you use- no adapters, no meta-adapters. Then we wrote
						Standard JSON Schema, which lets the same validators double as tool
						input schemas for AI agents and MCP.
					</>
				}
				margin={[
					<Quote
						href="https://bsky.app/profile/arktype.io/post/3ludgwgjc6c22"
						who="@arktype.io"
					>
						don't worry babe. with Standard Schema, developers won't have to
						choose
					</Quote>
				]}
			>
				<Collapse />
			</Row>
			<Row
				id="pullfrog"
				index="03"
				name="Pullfrog"
				emoji="🐸"
				role="co-founder · 2025–"
				links={[{ href: "https://pullfrog.com", label: "pullfrog.com" }]}
				lead="Coding agents in your GitHub Actions."
				body={
					<>
						It runs whichever agent you already use (Claude Code, Codex,
						OpenCode) with your own keys, on your PRs, issues and failing CI,
						and it just gets better as your agents do. I started it with{" "}
						<a className="link ext" href="https://github.com/colinhacks">
							Colin McDonnell
						</a>
						, who made Zod. I built the agent runtime underneath it, and these
						days{" "}
						<a className="link" href="#agents">
							a lot of agents help me build it<span aria-hidden> ↓</span>
						</a>
					</>
				}
				// my post when we started it, then the customer logos on pullfrog.com,
				// the row's own link
				margin={[
					<Quote
						href="https://bsky.app/profile/ssalbdivad.dev/post/3m7nm3dbfhs2v"
						who="me"
					>
						sounds fake but I'm starting a company with my nemesis Colin P. Zod
					</Quote>,
					<Quote
						href="https://x.com/zeddotdev/status/2054288085165223986"
						who="Zed"
					>
						Good frog
					</Quote>,
					<Comment>
						used by Sanity, Trigger.dev, Zed, Unkey, Remotion and Inkeep
					</Comment>
				]}
			/>
		</div>
	</Section>
)
