/**
 * ArkType, off the main thread. Evaluating the arktype module costs ~2s of
 * CPU on a throttled phone, so the page never imports it directly: every
 * caller goes through `~/lib/ark`, which posts here.
 *
 * `handle` is exported for ark.ts's fallback, which runs it on the main
 * thread only if the worker itself fails to load.
 */
import { type } from "arktype"

export type Parsed =
	| { ok: true; description: string; expression: string }
	| { ok: false; message: string }

// a definition only known at runtime; the static parser can't check it
const define = type as unknown as (def: string) => {
	(data: unknown): unknown
	description: string
	expression: string
	extends: (other: string) => boolean
}

const parse = (src: string): Parsed => {
	try {
		const t = define(src)
		return { ok: true, description: t.description, expression: t.expression }
	} catch (e) {
		return { ok: false, message: e instanceof Error ? e.message : String(e) }
	}
}

const ops = {
	parse: (src: string) => parse(src),
	/** whether type(a) is a subtype of type(b) */
	extends: (a: string, b: string) => define(a).extends(b),
	/** whether type(def) accepts data, with ArkType's summary when it doesn't (def must parse) */
	allows: (def: string, data: string) => {
		const out = define(def)(data)
		return out instanceof type.errors ?
				{ ok: false as const, summary: out.summary }
			:	{ ok: true as const }
	},
	/** the real result of type(`${a} & ${b}`), error message included */
	intersect: (a: string, b: string) => parse(`${a} & ${b}`)
}

export type Ops = typeof ops
export type Op = keyof Ops
export type Request = { id: number; op: Op; args: unknown[] }
export type Response =
	| { id: number; ok: true; value: unknown }
	| { id: number; ok: false; error: string }

export const handle = ({ id, op, args }: Request): Response => {
	try {
		const fn = ops[op] as (...args: unknown[]) => unknown
		return { id, ok: true, value: fn(...args) }
	} catch (e) {
		return { id, ok: false, error: e instanceof Error ? e.message : String(e) }
	}
}

// only when running as the worker, not when ark.ts falls back to importing it
if (typeof window === "undefined")
	self.onmessage = (e: MessageEvent<Request>) =>
		self.postMessage(handle(e.data))
