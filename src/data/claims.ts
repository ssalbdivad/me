import {
	formatCompact,
	formatLiteral,
	formatLongDay,
	formatMonth,
	formatRatio,
	formatStamp,
	truncFixed
} from "~/lib/format"
import type { LivePackage } from "~/lib/live"
import { PRISMA, VIEM_TRACE } from "./caseStudies"
import stats from "./stats.json"

/**
 * Every number on the page that matters is a claim, and every claim carries
 * its source. <Claim id="..."> renders the number as a hoverable token whose
 * quickinfo reads like tsserver output, so a claim without a source is
 * literally a type error here.
 */
export type ClaimData = {
	/** the identifier shown in the quickinfo: `const <name>: <type>` */
	name: string
	/** the "type" of the claim, shown as a literal */
	type: string
	/** one line of plain English about what the number is */
	doc: string
	see: readonly { href: string; label: string }[]
	/** when the number was read (ISO day or timestamp) */
	asOf?: string
	/** refreshed in the browser after load */
	live?: boolean
	/** where a live number is read from, shown in the popover footer */
	source?: "npm" | "GitHub"
	/** the npm package whose downloads the browser re-reads (see ~/lib/live) */
	pkg?: LivePackage
	/** the honest caveat, if there is one */
	note?: string
	/** growth over the sparkline's months, computed from stats.json */
	growth?: string
}

const { fetchedAt } = stats
const repo = (slug: string) => ({
	href: `https://github.com/${slug}`,
	label: `github.com/${slug}`
})

type DownloadWindow = {
	downloads: number
	start: string
	end: string
	asOf: string
}

/**
 * A downloads claim for one window. The build calls it with the stats.json
 * snapshot; <Claim> calls it again with a live window, so the literal, the
 * dates and the @see URL always describe the number on screen.
 */
export const downloadsClaim = (
	name: string,
	pkg: string,
	{ downloads, start, end, asOf }: DownloadWindow,
	note?: string
): ClaimData => ({
	name,
	type: formatLiteral(downloads),
	doc: `npm downloads of \`${pkg}\`, ${formatLongDay(start)} – ${formatLongDay(end)}`,
	see: [
		{
			href: `https://api.npmjs.org/downloads/point/${start}:${end}/${pkg}`,
			label: `api.npmjs.org/downloads/point/${start}:${end}/${pkg}`
		}
	],
	asOf,
	live: true,
	source: "npm",
	...(note && { note })
})

const downloads = (name: string, pkg: keyof typeof stats.npm, note?: string) =>
	downloadsClaim(
		name,
		pkg,
		{ downloads: stats.npm[pkg].downloads, ...stats.window, asOf: fetchedAt },
		note
	)

const stars = (name: string, slug: keyof typeof stats.stars): ClaimData => ({
	name,
	type: formatLiteral(stats.stars[slug]),
	doc: `GitHub stars on \`${slug}\``,
	see: [repo(slug)],
	asOf: fetchedAt,
	live: true,
	source: "GitHub"
})

// research-stats §2: the implementers (zod, valibot, effect, …) don't depend
// on the package; its dependents are the frameworks that accept it
const specNote =
	"Downloads of the spec package itself. Mostly transitive, as a runtime dependency of packages like Vercel's AI SDK (@ai-sdk/provider-utils) and Redux Toolkit."

/**
 * The hero sparklines' story in one line: the last full month against the
 * first, from the same stats.json series the sparkline draws. Truncated,
 * never rounded up.
 */
const growth = (pkg: "arktype" | "@standard-schema/spec") => {
	const months = stats.npm[pkg].monthly
	const first = months[0]!
	const last = months.at(-1)!
	return `${formatRatio(last.downloads / first.downloads)} since ${formatMonth(first.month)}: ${formatCompact(first.downloads)} downloads that month, ${formatCompact(last.downloads)} in ${formatMonth(last.month)}.`
}

export const claims = {
	arktypeDownloads: {
		...downloads("arktypeDownloads", "arktype"),
		pkg: "arktype",
		growth: growth("arktype")
	},
	specDownloads: {
		...downloads("specDownloads", "@standard-schema/spec", specNote),
		pkg: "@standard-schema/spec",
		growth: growth("@standard-schema/spec")
	},
	attestDownloads: downloads("attestDownloads", "@ark/attest"),
	pullfrogDownloads: downloads("pullfrogDownloads", "pullfrog"),
	arktypeStars: stars("arktypeStars", "arktypeio/arktype"),
	ssStars: stars("standardSchemaStars", "standard-schema/standard-schema"),
	pullfrogStars: stars("pullfrogStars", "pullfrog/pullfrog"),
	arkregexLaunchViews: {
		name: "arkregexLaunch",
		type: "{ views: 733_569; likes: 3_119; reposts: 392 }",
		doc: "The ArkRegex launch post on X, Oct 28, 2025.",
		see: [
			{
				href: "https://x.com/arktypeio/status/1983210635266498649",
				label: "x.com/arktypeio/status/1983210635266498649"
			}
		],
		asOf: "2026-10-13",
		note: "Read from the public fxtwitter mirror. The launch post alone; quotes and reposts not counted."
	},
	ts59AnswerOverflow: {
		name: "answerOverflow",
		type: '{ before: "6.66s"; after: "3.29s"; runs: 5 }',
		doc: "I found, minimized and benchmarked this slowdown and drove the fix; Mateusz Burzyński (@Andarist) wrote the compiler patch. AnswerOverflow's dashboard, type-checked on TS 5.8 vs. the #61505 build. Mean of 5 runs each; the ranges don't overlap.",
		see: [
			{
				href: "https://github.com/microsoft/TypeScript/pull/61535#issuecomment-2780961089",
				label: "microsoft/TypeScript#61535 (comment)"
			},
			{
				href: "https://github.com/microsoft/typescript-go/pull/1358",
				label: "typescript-go#1358 (Jake Bailey's run)"
			}
		],
		note: "Jake Bailey (TS team) measured the same repo independently: 7.67s → 3.79s."
	},
	ts59Trpc: {
		name: "trpcMonorepo",
		type: '{ before: "13.04s"; after: "6.00s"; runs: 1 }',
		doc: "A tRPC monorepo I tested, TS 5.8 vs. the #61505 build.",
		see: [
			{
				href: "https://github.com/microsoft/TypeScript/pull/61505#issuecomment-2769065243",
				label: "microsoft/TypeScript#61505 (comment)"
			}
		],
		note: "A single run."
	},
	ts59Klarna: {
		name: "klarna",
		type: '{ before: "395.48s"; after: "132.09s" }',
		doc: 'Klarna\'s app, reported by one of their engineers: "This was a game-changer PR for us."',
		see: [
			{
				href: "https://github.com/microsoft/TypeScript/pull/61505#issuecomment-3102636519",
				label: "microsoft/TypeScript#61505 (comment)"
			},
			{
				href: "https://github.com/microsoft/TypeScript/pull/61505#issuecomment-3102652766",
				label: "microsoft/TypeScript#61505 (Klarna, follow-up)"
			}
		],
		note: "Third-party and self-reported, in one comment."
	},
	viemVariance: {
		name: "getVariancesWorker",
		type: "{ ms: 1_866; typeParams: 9 }",
		doc: `Time TypeScript spent computing the variance of viem's SimulateContractReturnType, in a trace of MUD's build: ${truncFixed(VIEM_TRACE.before.ms / 1000, 2)}s, truncated.`,
		see: [
			{
				href: "https://github.com/latticexyz/mud/pull/2956",
				label: "latticexyz/mud#2956"
			},
			{
				href: "https://github.com/wevm/viem/pull/2557",
				label: "wevm/viem#2557"
			}
		]
	},
	viemAfter: {
		name: "setupNetwork",
		type: '{ ms: 1_288; file: "setupNetwork.ts" }',
		doc: `MUD's whole setupNetwork.ts check, traced again after hand-adding variance annotations: ${truncFixed(VIEM_TRACE.after.ms / 1000, 2)}s, truncated.`,
		see: [
			{
				href: "https://github.com/latticexyz/mud/pull/2956",
				label: "latticexyz/mud#2956"
			},
			{
				href: "https://github.com/wevm/viem/pull/2557",
				label: "wevm/viem#2557"
			}
		]
	},
	prismaCheck: {
		name: "commonInputTypes",
		type: '{ checkSourceFile: "4064µs → 2218µs"; lines: "339 → 82" }',
		doc: "One file of Prisma's generated client, before and after the restructuring.",
		see: [
			{
				href: PRISMA.sources[2],
				label: "prisma.io/blog (type-check performance)"
			},
			{
				href: "https://github.com/prisma/orm/pull/27046",
				label: "prisma/orm#27046"
			},
			{
				href: "https://github.com/prisma/orm/releases/tag/6.16.0",
				label: "Prisma 6.16.0 release notes"
			}
		],
		note: "One file, not the whole client."
	},
	mongooseInst: {
		name: "inferRawDocType",
		type: '{ simple: "501 → 320"; mixed: "1626 → 535"; nested: "4214 → 2097" }',
		doc: "Instantiations on Mongoose's attest benches for InferRawDocType.",
		see: [
			{
				href: "https://github.com/Automattic/mongoose/pull/15588",
				label: "Automattic/mongoose#15588"
			}
		],
		note: "The maintainer's whole-repo count was flat (+0.9%)."
	},
	i18next: {
		name: "i18nextType",
		type: "{ before: 218_121; after: 278 }",
		doc: "Instantiations for one i18next type, in a contributor's initial attest benchmark of the refactor that shipped as i18next's selector API.",
		see: [
			{
				href: "https://github.com/i18next/i18next/issues/2317#issuecomment-2952586649",
				label: "i18next/i18next#2317 (comment)"
			},
			{
				href: "https://github.com/i18next/i18next/pull/2322",
				label: "i18next/i18next#2322"
			}
		]
	}
} as const satisfies Record<string, ClaimData>

export type ClaimId = keyof typeof claims

export const statsAsOf = formatStamp(fetchedAt)
