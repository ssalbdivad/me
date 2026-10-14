import type { ReactNode } from "react"
import stats from "~/data/stats.json"
import { formatCompact, formatNumber } from "~/lib/format"
import { Claim } from "./Quickinfo"
import { Section } from "./Section"
import { Arc } from "./work/Arc"
import { Collapse } from "./work/Collapse"
import { TypeLine } from "./work/TypeLine"

// static figures, each sourced in claims.ts (arkregexLaunchViews, i18next)
const arkregexLaunch = { views: 733_569, likes: 3_119 }
const i18nextInstantiations = { before: 218_121, after: 278 }

type Link = { href: string; label: string; ext?: true }

const slug = (name: string) => name.toLowerCase().replace(/\W+/g, "-")

const Row = ({
	id,
	index,
	name,
	emoji,
	role,
	links,
	pitch,
	metrics,
	child,
	children
}: {
	id?: string
	index?: string
	name: string
	emoji?: string
	role?: string
	links: Link[]
	pitch: ReactNode
	metrics?: ReactNode
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
			<p className="w-pitch">{pitch}</p>
			{metrics && <div className="w-metrics">{metrics}</div>}
		</div>
		{children && <div className="w-extra">{children}</div>}
	</article>
)

const Metric = ({ value, label }: { value: ReactNode; label: string }) => (
	<p className="w-metric">
		<span className="w-mv">{value}</span>
		<span className="w-ml mono">{label}</span>
	</p>
)

export const Work = () => (
	<Section id="work" index="01" label="work" title="Things people install">
		<div className="w-list">
			<Row
				id="arktype"
				index="01"
				name="ArkType"
				emoji="⛵"
				role="author · 2022–"
				links={[{ href: "https://arktype.io", label: "arktype.io" }]}
				pitch={
					<>
						<strong>
							TypeScript's 1:1 validator, optimized from editor to runtime.
						</strong>{" "}
						You write types as TypeScript syntax, in strings. A parser written
						in the type system reads them as you type; at runtime they compile
						to JIT-friendly validation code. Agents can learn it too:{" "}
						<code className="w-cmd">npx skills add arktypeio/arktype</code>
					</>
				}
				metrics={
					<>
						<Metric
							value={
								<Claim id="arktypeDownloads">
									{formatCompact(stats.npm.arktype.downloads)}
								</Claim>
							}
							label="downloads / mo"
						/>
						<Metric
							value={
								<Claim id="arktypeStars">
									{formatCompact(stats.stars["arktypeio/arktype"])}
								</Claim>
							}
							label="GitHub stars"
						/>
					</>
				}
			>
				<TypeLine />
				<p className="w-aside mono">
					<a
						href="https://x.com/arktypeio/status/1900623527520116816"
						target="_blank"
						rel="noreferrer"
					>
						// "It's true- our static parser is the most flagrant abuse of the
						type system in a mainstream library." — @arktypeio
						<span className="w-aside-ext" aria-hidden>
							{" "}
							↗
						</span>
					</a>
				</p>
			</Row>
			<div className="w-family">
				<Row
					child
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
					pitch={
						<>
							<strong>
								A drop-in replacement for <code>new RegExp()</code> with types.
							</strong>{" "}
							The first library to validate and infer regex from TypeScript's
							type system: capture groups come back typed, and a malformed
							pattern is a type error.{" "}
							<a className="link" href="#top">
								(That's it up top.)
							</a>
						</>
					}
					metrics={
						<>
							<Metric
								value={
									<Claim id="arkregexLaunchViews">
										{formatCompact(arkregexLaunch.views)}
									</Claim>
								}
								label="launch-post views"
							/>
							<Metric
								value={formatNumber(arkregexLaunch.likes)}
								label="likes"
							/>
						</>
					}
				/>
				<Row
					child
					name="Attest"
					role="2023"
					links={[
						{ href: "https://arktype.io/docs/attest/benches", label: "docs" },
						{
							href: "https://www.youtube.com/watch?v=AEA0K77qhS4",
							label: "Theo's video",
							ext: true
						}
					]}
					pitch={
						<>
							<strong>
								Type-level benchmarks and assertions for TypeScript.
							</strong>{" "}
							Instantiation counts are deterministic: the same number on every
							machine, every run, so CI can fail the PR that makes your types
							20% slower. It's the tool behind every case study below- and other
							people's: i18next used it to take one type{" "}
							<Claim id="i18next">
								from {formatNumber(i18nextInstantiations.before)} instantiations
								to {formatNumber(i18nextInstantiations.after)}
							</Claim>
							.
						</>
					}
					metrics={
						<Metric
							value={
								<Claim id="attestDownloads">
									{formatCompact(stats.npm["@ark/attest"].downloads)}
								</Claim>
							}
							label="downloads / mo"
						/>
					}
				/>
				<Row
					child
					name="ArkSchema"
					links={[]}
					pitch={
						<>
							<strong>The set-theoretic type system underneath.</strong>{" "}
							Intersections, subtyping and union discrimination at runtime- it
							can compare arbitrary pairs of types for assignability. The
							13-minute version is{" "}
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
				pitch={
					<>
						<strong>
							One interface, so any TypeScript validator plugs into any
							framework.
						</strong>{" "}
						Colin McDonnell (Zod) came up with the idea; Fabian Hiller (Valibot)
						and I designed it with him. Then we co-authored Standard JSON
						Schema, so any validator can define tool inputs for AI agents and
						MCP.
					</>
				}
				metrics={
					<>
						<Metric
							value={
								<Claim id="specDownloads">
									{formatCompact(stats.npm["@standard-schema/spec"].downloads)}
								</Claim>
							}
							label="spec downloads / mo"
						/>
						<Metric
							value={
								<Claim id="ssStars">
									{formatCompact(
										stats.stars["standard-schema/standard-schema"]
									)}
								</Claim>
							}
							label="GitHub stars"
						/>
					</>
				}
			>
				<Collapse />
			</Row>
			<Arc />
			<Row
				id="pullfrog"
				index="03"
				name="Pullfrog"
				emoji="🐸"
				role="co-founder · 2025–"
				links={[{ href: "https://pullfrog.com", label: "pullfrog.com" }]}
				pitch={
					<>
						<strong>AI coding agents that run in your GitHub Actions.</strong>{" "}
						Pullfrog wraps vanilla Claude Code, Codex and OpenCode to review
						PRs, triage issues, fix CI, resolve merge conflicts and test UIs in
						a headless browser. Your infrastructure, your keys, your costs. I
						co-founded it with Colin McDonnell (Zod) and built the
						model-agnostic agent runtime: BYOK, MCP tools, GitHub App/OIDC auth,
						sandboxed CI.
						<span className="w-used">
							Used by Sanity, Trigger.dev, Zed, Unkey, Remotion and Inkeep.
						</span>
					</>
				}
				metrics={
					<>
						<Metric
							value={
								<Claim id="pullfrogStars">
									{formatCompact(stats.stars["pullfrog/pullfrog"])}
								</Claim>
							}
							label="GitHub stars"
						/>
						<Metric
							value={
								<Claim id="pullfrogDownloads">
									{formatCompact(stats.npm.pullfrog.downloads)}
								</Claim>
							}
							label="npm downloads / mo"
						/>
					</>
				}
			/>
		</div>
	</Section>
)
