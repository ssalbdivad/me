import { useEffect, useState } from "react"
import stats from "~/data/stats.json"
import { assertRange } from "./ark"
import { session } from "./storage"

/**
 * The prerendered numbers are a snapshot from the last (daily) build. After
 * the page is idle, the headline download counts are re-read from npm for a
 * 30-day window ending yesterday, validated with ArkType (in its worker, and
 * only once a cheap shape check passes), and swapped in only if npm has
 * newer, complete data. Failures are silent: the snapshot stays.
 *
 * Every <Claim> for a live package reads this one store, so the hero tile,
 * the Work row and both popovers always show the same value and window.
 */
export type Live = {
	downloads: Record<LivePackage, number>
	start: string
	end: string
	checkedAt: string
}

export type LivePackage = "arktype" | "@standard-schema/spec"
const packages: LivePackage[] = ["arktype", "@standard-schema/spec"]
const cacheKey = "live-stats:v2"
const hour = 3_600_000

let current: Live | undefined
let started = false
const listeners = new Set<(live: Live) => void>()

const day = (d: Date) => d.toISOString().slice(0, 10)

/** npm's /downloads/range response; ark.worker.ts validates the full shape */
type Range = {
	start: string
	end: string
	downloads: { downloads: number; day: string }[]
}

const refresh = async () => {
	const cached = session.get(cacheKey)
	if (cached) {
		const parsed = JSON.parse(cached) as Live
		if (Date.now() - Date.parse(parsed.checkedAt) < hour) return publish(parsed)
	}
	const now = new Date()
	const end = day(
		new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)
		)
	)
	// nothing newer than the snapshot exists yet
	if (end <= stats.window.end) return
	const start = day(new Date(Date.parse(`${end}T00:00:00Z`) - 29 * 86_400_000))
	const raw: unknown[] = await Promise.all(
		packages.map(async pkg => {
			const response = await fetch(
				`https://api.npmjs.org/downloads/range/${start}:${end}/${pkg}`,
				{
					signal: AbortSignal.timeout(4000)
				}
			)
			return response.json()
		})
	)
	// right after UTC midnight npm lists yesterday as 0 until its rollup
	// lands; a sum then would be 29 days labelled 30, so keep the snapshot.
	// Checked on the raw JSON first, so a miss never wakes ArkType at all.
	const complete = (r: unknown) => {
		const range = r as {
			end?: unknown
			downloads?: { downloads?: unknown }[]
		} | null
		return range?.end === end && !!range.downloads?.at(-1)?.downloads
	}
	if (!raw.every(complete)) return
	const results = await Promise.all(raw.map(json => assertRange<Range>(json)))
	const live: Live = {
		downloads: Object.fromEntries(
			packages.map((pkg, i) => [
				pkg,
				results[i]!.downloads.reduce((sum, d) => sum + d.downloads, 0)
			])
		) as Live["downloads"],
		start,
		end,
		checkedAt: now.toISOString()
	}
	// publish first: a cache that can't be written never costs fresh numbers
	publish(live)
	session.set(cacheKey, JSON.stringify(live))
}

const publish = (live: Live) => {
	current = live
	for (const listener of listeners) listener(live)
}

/**
 * Live headline numbers, or undefined while the snapshot is the latest.
 * Pass `start` from the component that should trigger the refresh (the stat
 * strip); everything else just subscribes.
 */
export const useLive = (start = false) => {
	const [live, setLive] = useState<Live>()
	useEffect(() => {
		listeners.add(setLive)
		// adopt a value that landed before this component mounted
		if (current) setLive(current)
		if (start && !started) {
			started = true
			const idle =
				window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500))
			// after the hero's 2.7s handle demo, never during it
			setTimeout(() => idle(() => void refresh().catch(() => {})), 3000)
		}
		return () => {
			listeners.delete(setLive)
		}
	}, [start])
	return live
}
