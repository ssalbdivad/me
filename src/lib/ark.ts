/**
 * The page's only door to ArkType: a promise client for one shared module
 * worker (ark.worker.ts), created on first use. Nothing here imports arktype,
 * so the ~2s module evaluation never blocks the main thread.
 *
 * If the worker can't start (no module-worker support, a blocked script), the
 * same handler is imported and run on the main thread instead, so callers see
 * identical results either way.
 */
import type { Op, Ops, Parsed, Request, Response } from "./ark.worker"

export type { Parsed }

type Pending = {
	request: Request
	resolve: (value: unknown) => void
	reject: (error: Error) => void
}

let worker: Worker | undefined
let local: Promise<(request: Request) => Response> | undefined
let seq = 0
const pending = new Map<number, Pending>()

const settle = (response: Response) => {
	const p = pending.get(response.id)
	if (!p) return
	pending.delete(response.id)
	if (response.ok) p.resolve(response.value)
	else p.reject(new Error(response.error))
}

const fail = (id: number, error: unknown) => {
	const p = pending.get(id)
	if (!p) return
	pending.delete(id)
	p.reject(error instanceof Error ? error : new Error(String(error)))
}

// A deploy can delete this chunk under an open tab. Forget a failed import so
// a later call retries, and reject instead of leaving callers waiting: each
// caller keeps its prerendered state when a call rejects.
const loadLocal = () =>
	(local ??= import("./ark.worker").then(
		m => m.handle,
		(error: unknown) => {
			local = undefined
			throw error
		}
	))

const runLocally = (request: Request) => {
	loadLocal()
		.then(handle => settle(handle(request)))
		.catch((error: unknown) => fail(request.id, error))
}

const fallBack = () => {
	worker?.terminate()
	worker = undefined
	if (pending.size === 0) {
		// warm(): start the import now, and swallow its failure until a call needs it
		loadLocal().catch(() => {})
		return
	}
	for (const { request } of pending.values()) runLocally(request)
}

const start = () => {
	if (worker || local) return
	if (typeof Worker === "undefined") return fallBack()
	try {
		worker = new Worker(new URL("./ark.worker.ts", import.meta.url), {
			type: "module"
		})
	} catch {
		return fallBack()
	}
	worker.onmessage = (e: MessageEvent<Response>) => settle(e.data)
	worker.onerror = e => {
		e.preventDefault()
		fallBack()
	}
}

const call = <op extends Op>(op: op, ...args: Parameters<Ops[op]>) =>
	new Promise<ReturnType<Ops[op]>>((resolve, reject) => {
		start()
		const request: Request = { id: ++seq, op, args }
		pending.set(request.id, {
			request,
			resolve: resolve as (value: unknown) => void,
			reject
		})
		if (worker) worker.postMessage(request)
		else runLocally(request)
	})

/** Start the worker (and its ArkType evaluation) ahead of the first call. */
export const warm = () => start()

/** `type(src)`: its description and expression, or ArkType's error message. */
export const parse = (src: string) => call("parse", src)

/** Whether `type(a)` extends `type(b)`. */
export const extendsType = (a: string, b: string) => call("extends", a, b)

/** Whether `type(def)` accepts `data`; on failure, ArkType's summary. */
export const allows = (def: string, data: string) => call("allows", def, data)

/** `type(`${a} & ${b}`)`, so an unsatisfiable intersection returns its message. */
export const intersect = (a: string, b: string) => call("intersect", a, b)
