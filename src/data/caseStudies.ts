import { formatLongDay } from "~/lib/format"
import mergeChain from "./merge-chain.json"

/**
 * The perf section's numbers. Every value traces to research-perf.md; the
 * merge chain is not typed here at all- it is imported from the bench output
 * (bench/merge-chain/run.ts), so it can be re-derived.
 */

type Point = {
	keys: number
	calls: number
	instantiations: number
	ts2589: boolean
}
const results = mergeChain.results as Record<
	string,
	Record<"functional" | "chained", Point[]>
>

const series = (version: string, form: "functional" | "chained") => {
	const points = results[version]?.[form]
	if (!points) throw new Error(`merge-chain.json has no ${version} ${form}`)
	return points
}

/** x = .merge() calls (1..15). A point with ts2589 is a bailed count: table only, never plotted. */
export const MERGE = {
	measuredAt: mergeChain.measuredAt,
	attest: mergeChain.attest,
	before: {
		version: "5.8.2",
		chained: series("5.8.2", "chained"),
		functional: series("5.8.2", "functional")
	},
	after: {
		version: "5.9.3",
		chained: series("5.9.3", "chained"),
		functional: series("5.9.3", "functional")
	}
} as const

/** the day the merge bench was re-run: "Oct 13, 2026" */
export const measuredDay = formatLongDay(MERGE.measuredAt.slice(0, 10))

export const TS59_PAYOFFS = [
	{
		id: "trpc",
		label: "A tRPC monorepo I tested",
		before: 13.04,
		after: 6.0,
		unit: "s",
		runs: 1,
		tag: "single run",
		href: "https://github.com/microsoft/TypeScript/pull/61505#issuecomment-2769065243"
	},
	{
		id: "answeroverflow",
		label: "AnswerOverflow dashboard (public repo)",
		unit: "s",
		beforeRuns: [6.44, 6.58, 6.99, 6.33, 7.0],
		afterRuns: [3.25, 3.34, 3.21, 3.24, 3.43], // means 6.668 → 3.294
		tag: "5 runs each, no overlap",
		href: "https://github.com/microsoft/TypeScript/pull/61535#issuecomment-2780961089",
		aside: {
			text: "Measured independently by Jake Bailey (TS team): 7.67s → 3.79s",
			href: "https://github.com/microsoft/typescript-go/pull/1358"
		}
	},
	{
		id: "klarna",
		label: "Klarna app",
		before: 395.48,
		after: 132.09,
		unit: "s",
		tag: "self-reported, in one comment",
		quote: "This was a game-changer PR for us",
		href: "https://github.com/microsoft/TypeScript/pull/61505#issuecomment-3102636519"
	}
] as const

export const TS59_CREDIT = {
	text: "Compiler patch by Mateusz Burzyński (@Andarist)",
	pr: "https://github.com/microsoft/TypeScript/pull/61505",
	blog: "https://devblogs.microsoft.com/typescript/announcing-typescript-5-9/",
	tsgo: "https://github.com/microsoft/typescript-go/pull/1358"
} as const

export const VIEM_TRACE = {
	domainMs: [0, 2000],
	before: {
		name: "getVariancesWorker",
		subject: "SimulateContractReturnType",
		typeParams: 9,
		ms: 1866
	},
	beforeParent: { name: "checkSourceFile", file: "setupNetwork.ts", ms: null }, // total not published
	after: { name: "checkSourceFile", file: "setupNetwork.ts", ms: 1288 },
	sources: [
		"https://github.com/latticexyz/mud/pull/2956",
		"https://github.com/wevm/viem/pull/2557"
	]
} as const

export const PRISMA = {
	file: "commonInputTypes",
	rows: [
		{ label: "checkSourceFile", before: 4064, after: 2218, unit: "µs" },
		{ label: "createSourceFile", before: 796, after: 246, unit: "µs" },
		{ label: "bindSourceFile", before: 607, after: 164, unit: "µs" },
		{ label: "lines of code", before: 339, after: 82, unit: "LOC" }
	],
	sources: [
		"https://github.com/prisma/orm/pull/27046",
		"https://github.com/prisma/orm/releases/tag/6.16.0",
		"https://www.prisma.io/blog/why-prisma-orm-checks-types-faster-than-drizzle"
	]
} as const

export const MONGOOSE = {
	rows: [
		{ label: "simple schema", before: 501, after: 320 },
		{ label: "mixed schema", before: 1626, after: 535 },
		{ label: "nested schema", before: 4214, after: 2097 }
	],
	unit: "instantiations",
	wholeRepoNote: "+0.9% whole-repo instantiations (maintainer, single CI run)",
	sources: [
		"https://github.com/Automattic/mongoose/pull/15588",
		"https://github.com/Automattic/mongoose/blob/master/CHANGELOG.md"
	]
} as const
