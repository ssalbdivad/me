/**
 * Everything the prerender reads that isn't source: live stats, compiler
 * output for the code snippets, and the site's own type-check cost (the
 * footer's "⛳ this site" line, in attest's output format).
 *
 * Run: node scripts/prebuild.ts
 */
import { execFileSync, spawnSync } from "node:child_process"
import { writeFileSync } from "node:fs"

const run = (script: string) =>
	execFileSync("node", [new URL(script, import.meta.url).pathname], {
		stdio: "inherit"
	})

try {
	run("./stats.ts")
} catch (error) {
	// a scheduled build exists only to refresh the numbers: failing it keeps
	// the live deployment, where deploying the committed snapshot would roll
	// the site back to older numbers
	if (process.env.STATS_STRICT === "true") throw error
	// a flaky API shouldn't fail a push deploy: the committed snapshot stays
	console.warn("stats: fetch failed, keeping the committed snapshot")
}

run("./snippets.ts")

const tsc = new URL("../node_modules/tsgo/bin/tsc", import.meta.url).pathname
const check = spawnSync("node", [tsc, "--noEmit", "--extendedDiagnostics"], {
	cwd: new URL("..", import.meta.url).pathname,
	encoding: "utf8"
})
const metric = (name: string) =>
	new RegExp(`^${name}:\\s+([\\d.]+)`, "m").exec(check.stdout)?.[1]
const instantiations = metric("Instantiations")
const checkTime = metric("Check time")
const out = new URL("../src/data/site-cost.json", import.meta.url)
writeFileSync(
	out,
	`${JSON.stringify(
		check.status === 0 && instantiations && checkTime ?
			{
				instantiations: Number(instantiations),
				checkSeconds: Number(checkTime),
				errors: 0
			}
		:	null
	)}\n`
)
console.log(
	`site cost: ${instantiations} instantiations, ${checkTime}s check (exit ${check.status})`
)
