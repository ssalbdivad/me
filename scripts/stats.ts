/**
 * Snapshots the live numbers the site shows into src/data/stats.json, so the
 * prerendered HTML always carries real values (the client refreshes the
 * headline ones after hydration).
 *
 * Every response is validated with ArkType before it is trusted. Requests
 * time out after 15s, and the groups fail independently: npm (window,
 * downloads and sparklines, all or nothing, since they must describe the
 * same window), each repo's stars, and followers. A group that fails keeps
 * its value from the previous stats.json and is logged as stale; the script
 * fails only when a group has no previous value to fall back to. With
 * STATS_STRICT=true (the scheduled deploy) any stale group fails it instead:
 * redeploying the committed numbers would roll the live site back.
 *
 * Run: node scripts/stats.ts
 */
import { type } from "arktype"
import { existsSync, readFileSync, writeFileSync } from "node:fs"

const out = new URL("../src/data/stats.json", import.meta.url)

const day = (d: Date) => d.toISOString().slice(0, 10)
const dayMs = 86_400_000
const now = new Date()

const Point = type({
	downloads: "number.integer >= 0",
	start: "string",
	end: "string"
})
const Range = type({
	downloads: type({ downloads: "number.integer >= 0", day: "string" }).array()
})
const Repo = type({ stargazers_count: "number.integer >= 0" })
const User = type({ followers: "number.integer >= 0" })
const UnghRepo = type({ repo: { stars: "number.integer >= 0" } })

const getJson = async <t>(url: string, validate: (data: unknown) => t) => {
	const headers: Record<string, string> = {
		"user-agent": "ssalbdivad.com stats"
	}
	if (url.startsWith("https://api.github.com") && process.env.GITHUB_TOKEN)
		headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
	const response = await fetch(url, {
		headers,
		signal: AbortSignal.timeout(15_000)
	})
	if (!response.ok) throw new Error(`${url} -> ${response.status}`)
	return validate(await response.json())
}

const assert =
	<t>(t: { assert: (data: unknown) => t }) =>
	(data: unknown) =>
		t.assert(data)

/**
 * npm data lags about a day, and the last-month alias can be served stale
 * from the CDN, so ask for an explicit 30-day window ending yesterday (UTC).
 * Right after UTC midnight npm lists yesterday with 0 downloads until its
 * daily rollup lands; summing that would quietly report 29 days as 30. So
 * while arktype's last day reads 0, step the whole window back a day. The
 * window actually used is what stats.json records.
 */
const resolveWindow = async () => {
	let end = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)
	)
	for (let attempt = 0; attempt < 3; attempt++) {
		const start = new Date(end.getTime() - 29 * dayMs)
		const data = await getJson(
			`https://api.npmjs.org/downloads/range/${day(start)}:${day(end)}/arktype`,
			assert(Range)
		)
		const last = data.downloads.at(-1)
		if (last && last.day === day(end) && last.downloads > 0)
			return { start, end }
		end = new Date(end.getTime() - dayMs)
	}
	throw new Error("npm has no complete 30-day window in the last 3 days")
}

const lastMonth = async (pkg: string, start: Date, end: Date) => {
	const data = await getJson(
		`https://api.npmjs.org/downloads/point/${day(start)}:${day(end)}/${pkg}`,
		assert(Point)
	)
	return data.downloads
}

// full calendar months only, so the sparkline doesn't dip at either end
const monthly = async (pkg: string, end: Date) => {
	const from = new Date(
		Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 17, 1)
	)
	const data = await getJson(
		`https://api.npmjs.org/downloads/range/${day(from)}:${day(end)}/${pkg}`,
		assert(Range)
	)
	const totals = new Map<string, number>()
	for (const { day, downloads } of data.downloads) {
		const month = day.slice(0, 7)
		totals.set(month, (totals.get(month) ?? 0) + downloads)
	}
	const currentMonth = day(end).slice(0, 7)
	const firstDay = data.downloads[0]?.day ?? ""
	return [...totals]
		.filter(
			([month]) =>
				month !== currentMonth &&
				!(firstDay.slice(0, 7) === month && !firstDay.endsWith("-01"))
		)
		.map(([month, downloads]) => ({ month, downloads }))
}

const npm = async () => {
	const { start, end } = await resolveWindow()
	const [arktype, spec, attest, pullfrog, arktypeMonthly, specMonthly] =
		await Promise.all([
			lastMonth("arktype", start, end),
			lastMonth("@standard-schema/spec", start, end),
			lastMonth("@ark/attest", start, end),
			lastMonth("pullfrog", start, end),
			monthly("arktype", end),
			monthly("@standard-schema/spec", end)
		])
	return {
		window: { start: day(start), end: day(end) },
		npm: {
			arktype: { downloads: arktype, monthly: arktypeMonthly },
			"@standard-schema/spec": { downloads: spec, monthly: specMonthly },
			"@ark/attest": { downloads: attest },
			pullfrog: { downloads: pullfrog }
		}
	}
}

const stars = async (repo: string) => {
	try {
		const data = await getJson(
			`https://api.github.com/repos/${repo}`,
			assert(Repo)
		)
		return data.stargazers_count
	} catch {
		const data = await getJson(
			`https://ungh.cc/repos/${repo}`,
			assert(UnghRepo)
		)
		return data.repo.stars
	}
}

const repos = [
	"arktypeio/arktype",
	"standard-schema/standard-schema",
	"pullfrog/pullfrog"
] as const

type Stats = Awaited<ReturnType<typeof npm>> & {
	fetchedAt: string
	stars: Record<(typeof repos)[number], number>
	followers: number
}

const previous: Partial<Stats> =
	existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {}

const [npmResult, followersResult, ...starResults] = await Promise.allSettled([
	npm(),
	getJson("https://api.github.com/users/ssalbdivad", assert(User)).then(
		user => user.followers
	),
	...repos.map(stars)
])

const stale: string[] = []
/** a fresh value, or the previous snapshot's (logged as stale), or a hard failure */
const settle = <t>(
	group: string,
	result: PromiseSettledResult<t>,
	fallback: t | undefined
): t => {
	if (result.status === "fulfilled") return result.value
	if (fallback === undefined)
		throw new Error(`${group}: ${result.reason} (and no previous value)`)
	stale.push(group)
	console.warn(
		`stats: ${group} is stale, keeping the previous value (${result.reason})`
	)
	return fallback
}

const npmStats = settle(
	"npm",
	npmResult,
	previous.window && previous.npm ?
		{ window: previous.window, npm: previous.npm }
	:	undefined
)
const starCounts = Object.fromEntries(
	repos.map((repo, i) => [
		repo,
		settle(`stars ${repo}`, starResults[i]!, previous.stars?.[repo])
	])
) as Stats["stars"]
const followers = settle("followers", followersResult, previous.followers)

const stats: Stats = {
	// "as of" never claims a fresher snapshot than its stalest group
	fetchedAt:
		stale.length && previous.fetchedAt ? previous.fetchedAt : now.toISOString(),
	...npmStats,
	stars: starCounts,
	followers
}

if (stale.length && process.env.STATS_STRICT === "true") {
	console.error(`stats: stale ${stale.join(", ")}; not deploying older numbers`)
	process.exit(1)
}

writeFileSync(out, `${JSON.stringify(stats, null, "\t")}\n`)
console.log(
	`wrote ${out.pathname}${stale.length ? ` (stale: ${stale.join(", ")})` : ""}`
)
console.log(
	JSON.stringify({
		window: stats.window,
		arktype: stats.npm.arktype.downloads,
		spec: stats.npm["@standard-schema/spec"].downloads,
		stars: stats.stars,
		followers: stats.followers
	})
)
