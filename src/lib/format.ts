const grouped = new Intl.NumberFormat("en")

export const formatNumber = (n: number) => grouped.format(n)

/** 9055997 => "9_055_997", the way the number reads as a TS literal */
export const formatLiteral = (n: number) =>
	grouped.format(n).replaceAll(",", "_")

const longDayFormat = new Intl.DateTimeFormat("en", {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC"
})

/** "2026-10-12" => "Oct 12, 2026" */
export const formatLongDay = (isoDay: string) =>
	longDayFormat.format(new Date(`${isoDay}T00:00:00Z`))

/** ISO timestamp => "2026-10-13 22:23 UTC" */
export const formatStamp = (iso: string) =>
	`${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`

/** toFixed that truncates instead of rounding: 2.994 => "2.9", never "3.0" */
export const truncFixed = (x: number, d: number) =>
	(Math.trunc(x * 10 ** d) / 10 ** d).toFixed(d)
