/**
 * Snapshots the live numbers the site shows into src/data/stats.json, so the
 * prerendered HTML always carries real values. Nothing refreshes them on the
 * client: the page says "millions", and the popover holds this snapshot.
 *
 * Only what the site reads is fetched: arktype's 30-day npm downloads (the
 * Work section's claim), the window they cover, and the GitHub follower count
 * (the 404 page's bit). Under STATS_STRICT an unused number going stale would
 * fail the deploy for nothing, so nothing else is fetched.
 *
 * Every response is validated with ArkType before it is trusted. Requests
 * time out after 15s, and the groups fail independently: npm (window and
 * downloads, all or nothing, since they must describe the same window) and
 * followers. A group that fails keeps
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
const User = type({ followers: "number.integer >= 0" })

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

const npm = async () => {
	const { start, end } = await resolveWindow()
	return {
		window: { start: day(start), end: day(end) },
		npm: { arktype: { downloads: await lastMonth("arktype", start, end) } }
	}
}

type Stats = Awaited<ReturnType<typeof npm>> & {
	fetchedAt: string
	followers: number
}

const previous: Partial<Stats> =
	existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {}

const [npmResult, followersResult] = await Promise.allSettled([
	npm(),
	getJson("https://api.github.com/users/ssalbdivad", assert(User)).then(
		user => user.followers
	)
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
	previous.window && previous.npm?.arktype ?
		{ window: previous.window, npm: { arktype: previous.npm.arktype } }
	:	undefined
)
const followers = settle("followers", followersResult, previous.followers)

const stats: Stats = {
	// "as of" never claims a fresher snapshot than its stalest group
	fetchedAt:
		stale.length && previous.fetchedAt ? previous.fetchedAt : now.toISOString(),
	...npmStats,
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
		followers: stats.followers
	})
)
