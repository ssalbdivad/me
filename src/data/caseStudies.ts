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

export const TS59_CREDIT = {
	text: "Compiler patch by Mateusz Burzyński (@Andarist)",
	pr: "https://github.com/microsoft/TypeScript/pull/61505",
	blog: "https://devblogs.microsoft.com/typescript/announcing-typescript-5-9/",
	tsgo: "https://github.com/microsoft/typescript-go/pull/1358"
} as const
