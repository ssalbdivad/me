/**
 * Web Storage that can't throw. With cookies blocked (Firefox's "block all",
 * some privacy modes), merely reading `window.localStorage` throws a
 * SecurityError, so the getter itself runs inside the try. A failed read is
 * null and a failed write is a no-op: every caller treats storage as a
 * nicety (a theme preference, a once-per-session flag, a cache).
 */
const safe = (area: () => Storage) => ({
	get: (key: string) => {
		try {
			return area().getItem(key)
		} catch {
			return null
		}
	},
	set: (key: string, value: string) => {
		try {
			area().setItem(key, value)
		} catch {}
	}
})

export const session = safe(() => sessionStorage)
export const local = safe(() => localStorage)
