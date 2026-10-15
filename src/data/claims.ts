import { formatLiteral, formatLongDay, formatStamp } from "~/lib/format"
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
	/** where a read number comes from, shown in the popover footer */
	source?: "npm"
	/** the honest caveat, if there is one */
	note?: string
}

const { fetchedAt } = stats

/**
 * npm downloads over the stats.json window, from the daily build. The
 * literal, the dates and the @see URL all describe that one window.
 */
const downloads = (name: string, pkg: keyof typeof stats.npm): ClaimData => {
	const { start, end } = stats.window
	return {
		name,
		type: formatLiteral(stats.npm[pkg].downloads),
		doc: `npm downloads of \`${pkg}\`, ${formatLongDay(start)} – ${formatLongDay(end)}`,
		see: [
			{
				href: `https://api.npmjs.org/downloads/point/${start}:${end}/${pkg}`,
				label: `api.npmjs.org/downloads/point/${start}:${end}/${pkg}`
			}
		],
		asOf: fetchedAt,
		source: "npm"
	}
}

// getVariancesWorker's time in the trace of MUD's build (mud#2956)
const viemVarianceMs = 1866

export const claims = {
	arktypeDownloads: downloads("arktypeDownloads", "arktype"),
	ts59AnswerOverflow: {
		name: "answerOverflow",
		type: '{ before: "6.66s"; after: "3.29s"; runs: 5 }',
		doc: "AnswerOverflow's dashboard, type-checked on TS 5.8 vs. the #61505 build. Mean of 5 runs each; the ranges don't overlap.",
		see: [
			{
				href: "https://github.com/microsoft/TypeScript/pull/61535#issuecomment-2780961089",
				label: "Andarist's runs (comment on #61535)"
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
		doc: "One of the tRPC monorepos I tested, TS 5.8 vs. the #61505 build.",
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
		doc: "Klarna's app.",
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
		type: `{ ms: ${formatLiteral(viemVarianceMs)}; typeParams: 9 }`,
		doc: `Time TypeScript spent computing the variance of viem's SimulateContractReturnType, in a trace of MUD's build.`,
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
