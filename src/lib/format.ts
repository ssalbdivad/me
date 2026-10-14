// Truncate rather than round, so a displayed number never overstates:
// 9,055,997 reads 9.05M, not 9.1M.
const compact = new Intl.NumberFormat("en", {
	notation: "compact",
	maximumSignificantDigits: 3,
	roundingMode: "trunc"
})

const grouped = new Intl.NumberFormat("en")

export const formatCompact = (n: number) => compact.format(n)

export const formatNumber = (n: number) => grouped.format(n)

/** 9055997 => "9_055_997", the way the number reads as a TS literal */
export const formatLiteral = (n: number) =>
	grouped.format(n).replaceAll(",", "_")

const dayFormat = new Intl.DateTimeFormat("en", {
	month: "short",
	day: "numeric",
	timeZone: "UTC"
})

const longDayFormat = new Intl.DateTimeFormat("en", {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC"
})

/** "2026-10-12" => "Oct 12" */
export const formatDay = (isoDay: string) =>
	dayFormat.format(new Date(`${isoDay}T00:00:00Z`))

/** "2026-10-12" => "Oct 12, 2026" */
export const formatLongDay = (isoDay: string) =>
	longDayFormat.format(new Date(`${isoDay}T00:00:00Z`))

/** ISO timestamp => "2026-10-13 22:23 UTC" */
export const formatStamp = (iso: string) =>
	`${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`

/** toFixed that truncates instead of rounding: 2.994 => "2.9", never "3.0" */
export const truncFixed = (x: number, d: number) =>
	(Math.trunc(x * 10 ** d) / 10 ** d).toFixed(d)

const monthFormat = new Intl.DateTimeFormat("en", {
	month: "short",
	year: "numeric",
	timeZone: "UTC"
})

/** "2025-05" => "May 2025" */
export const formatMonth = (isoMonth: string) =>
	monthFormat.format(new Date(`${isoMonth}-01T00:00:00Z`))

/** a growth ratio that never rounds up: 7.42 => "7.4×", 71.14 => "71×" */
export const formatRatio = (r: number) =>
	`${r < 10 ? truncFixed(r, 1) : Math.floor(r)}×`
