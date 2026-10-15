import { Suspense, useEffect, useRef, useState } from "react"
import slashHtml from "~/data/snippets/eggs-404.html?raw"
import stats from "~/data/stats.json"
import * as ark from "~/lib/ark"
import { formatLongDay } from "~/lib/format"
import { Eggs } from "../Eggs"
import { Footer } from "../Footer"
import { CopyEmail } from "../CopyEmail"
import css from "./notfound.css?url"

/**
 * The 404 runs the visitor's URL through the real ArkType parser. A leading
 * `/` starts a regex literal, so every bad URL is a genuine parse error.
 *
 * Prerendered once as /404.html, and the static host serves that file at
 * whatever URL was missed- so render never reads the location (hydration
 * must match the prerender). An inline script swaps the real path in before
 * paint, and the effect re-parses it with arktype.
 */

// the prerendered example, for no-JS visitors; the message below is the
// verbatim output of type("/hire-me") on arktype 2.2.8
const example = "/hire-me"
const exampleError = "/hire-me requires a closing forward slash"

const lastSegment = (pathname: string) => {
	let segment = pathname.split("/").filter(Boolean).at(-1) ?? ""
	try {
		segment = decodeURIComponent(segment)
	} catch {}
	return `/${segment}`
}

// recruiters guess these; src is set client-side only (it starts as the
// example), so the pointer never renders during hydration
const resumeGuess = /^\/(r[eé]sum[eé]|cv)(\.pdf)?$/i

const decodePath = (pathname: string) => {
	try {
		return decodeURIComponent(pathname)
	} catch {
		return pathname
	}
}

/** `type("/hire-me")` shows its argument as a JS string literal */
const literal = (s: string) => JSON.stringify(s)

// before paint: put the real path in the line and hold the (example) status
// until arktype has parsed the real thing
const prepaint = `(function(){var p=location.pathname.split("/").filter(Boolean),s=p[p.length-1];if(!s)return;try{s=decodeURIComponent(s)}catch(e){}var l=document.getElementById("nf-src"),f=document.getElementById("nf");if(!l||!f||"/"+s==="${example}")return;l.textContent=JSON.stringify("/"+s);f.setAttribute("data-pending","")})()`

type Parsed = ark.Parsed

type Fixed = Parsed & {
	instance?: { ok: true } | { ok: false; summary: string }
}

// the bit is dated to the day stats.ts first recorded exactly 404 followers;
// only the "it's {n} now" line reads the build's stats
const bitDay = formatLongDay("2026-10-13")
const followers = stats.followers
const statsDay = formatLongDay(stats.fetchedAt.slice(0, 10))

export const NotFoundPage = () => {
	const [src, setSrc] = useState(example)
	const [path, setPath] = useState(example)
	const [first, setFirst] = useState<Parsed>({
		ok: false,
		message: exampleError
	})
	const [fixed, setFixed] = useState<Fixed>()
	const [ready, setReady] = useState(false)
	const verdictRef = useRef<HTMLParagraphElement>(null)

	// "add the slash" unmounts the button that had focus: hand it to the verdict
	useEffect(() => {
		if (fixed) verdictRef.current?.focus()
	}, [fixed])

	useEffect(() => {
		document.title = "404 · David Blass"
		const segment = lastSegment(location.pathname)
		// must agree with the prepaint script, which only skips an empty path
		const real = segment === "/" ? example : segment
		setSrc(real)
		setPath(real === example ? example : decodePath(location.pathname))
		let live = true
		// in ArkType's worker: evaluating arktype here would freeze the page.
		// If even its fallback fails, the status stays held and the button off.
		void ark.parse(real).then(
			parsed => {
				if (!live) return
				setFirst(parsed)
				setReady(true)
				document.getElementById("nf")?.removeAttribute("data-pending")
			},
			() => {}
		)
		return () => {
			live = false
		}
	}, [])

	const addSlash = async () => {
		try {
			const result: Fixed = await ark.parse(`${src}/`)
			if (result.ok) result.instance = await ark.allows(`${src}/`, path)
			setFixed(result)
		} catch {
			// the worker and its fallback both failed; the home link still works
		}
	}

	const verdict =
		!fixed ? undefined
		: !fixed.ok ? "Adding the slash made it worse. There is still no page here."
		: fixed.instance?.ok ?
			"Your URL is now a valid type. Your URL is also an instance of it. There is still no page here."
		:	"Your URL is now a valid type. Your URL is not an instance of it. There is still no page here."

	return (
		<>
			<link rel="stylesheet" href={css} precedence="eggs" />
			<nav className="nav wrap" aria-label="Primary">
				<a className="brand" href="/">
					David Blass
				</a>
				<div className="navlinks">
					<CopyEmail label="Copy email" small />
				</div>
			</nav>
			<main className="nf wrap">
				<div className="nf-inner">
					<span
						className="sec-label rise"
						style={{ "--i": 0 } as React.CSSProperties}
					>
						<b>404</b> // not found
					</span>
					<h1 className="nf-title rise-fade">There’s no page here.</h1>
					<p
						className="nf-deck rise"
						style={{ "--i": 1 } as React.CSSProperties}
					>
						Worse: your URL isn’t even a valid type. ArkType reads a leading{" "}
						<code className="mono">/</code> as the start of a regex literal.
					</p>

					<figure
						className="nf-card rise"
						id="nf"
						style={{ "--i": 2 } as React.CSSProperties}
						data-fixed={fixed ? "" : undefined}
						suppressHydrationWarning
					>
						<figcaption>
							<span>
								<b>arktype</b> · <span className="nf-js">your URL, parsed</span>
								<span className="nf-nojs">an example URL, parsed</span>
							</span>
							<span>
								{fixed?.ok ?
									"real parser · real result"
								:	"real parser · real error"}
							</span>
						</figcaption>
						<div className="nf-code mono">
							<div className="nf-line">
								<span className="nf-fn">type</span>
								<span className="nf-p">(</span>
								<span
									className={`nf-src${(fixed ?? first).ok ? "" : " nf-err"}`}
									key={fixed ? "fixed" : "first"}
									id="nf-src"
									suppressHydrationWarning
								>
									{fixed ?
										<>
											{literal(src).slice(0, -1)}
											<span className="nf-new">/</span>"
										</>
									:	literal(src)}
								</span>
								<span className="nf-p">)</span>
							</div>
							{fixed ?
								<p
									className={`nf-status ${fixed.ok ? "ok" : "err"}`}
									key="fixed"
								>
									{fixed.ok ? `✓ ${fixed.description}` : fixed.message}
								</p>
							:	<p
									className={`nf-status ${first.ok ? "ok" : "err"}`}
									key={`${ready}`}
								>
									{first.ok ? `✓ ${first.description}` : first.message}
								</p>
							}

							{fixed?.ok && (
								<div className="nf-fixed">
									<div className="nf-line nf-check">
										<span className="nf-fn">type</span>
										<span className="nf-p">(</span>
										<span className="nf-str">{literal(`${src}/`)}</span>
										<span className="nf-p">).</span>
										<span className="nf-fn">allows</span>
										<span className="nf-p">(</span>
										<span className="nf-str">{literal(path)}</span>
										<span className="nf-p">)</span>
									</div>
									{fixed.instance?.ok ?
										<p className="nf-status ok">true</p>
									:	<p className="nf-status err">
											false · {fixed.instance?.summary}
										</p>
									}
								</div>
							)}

							<noscript>
								<div className="nf-fixed nf-static">
									<span className="nf-eg">// add the slash:</span>
									<div
										className="code"
										dangerouslySetInnerHTML={{ __html: slashHtml }}
									/>
								</div>
							</noscript>
						</div>
					</figure>
					<script dangerouslySetInnerHTML={{ __html: prepaint }} />

					<p className="nf-verdict" ref={verdictRef} tabIndex={-1}>
						{verdict}
					</p>
					<div
						className="nf-actions rise"
						style={{ "--i": 3 } as React.CSSProperties}
					>
						{!fixed && (
							<button
								type="button"
								className="btn btn-gold nf-add"
								onClick={addSlash}
								disabled={!ready}
							>
								add the slash
							</button>
						)}
						<a className={`btn ${fixed ? "btn-gold" : "btn-ghost"}`} href="/">
							← home ⛵
						</a>
					</div>
					{resumeGuess.test(src.normalize("NFC")) && (
						<p className="nf-resume mono">
							// looking for the résumé? it's at{" "}
							<a className="link" href="/resume">
								/resume
							</a>
						</p>
					)}
					<noscript>
						<style>{".nf-add{display:none}"}</style>
					</noscript>

					{/* one block per comment, so a wrapped line hangs under the text after its // */}
					<p className="nf-fact mono">
						<span className="nf-comment">
							// fun fact: on {bitDay},{" "}
							<a className="link" href="https://github.com/ssalbdivad">
								@ssalbdivad
							</a>{" "}
							had exactly <b>404</b> GitHub followers.
						</span>
						<span className="nf-comment">
							//{" "}
							{followers === 404 ?
								"please don't follow him. it would ruin this page."
							:	`it's ${followers} now (${statsDay}). the bit is ruined. thanks.`
							}
						</span>
					</p>
				</div>
			</main>
			<Footer numbers={false} />
			<Eggs />
		</>
	)
}

/**
 * The root route's notFoundComponent: the tree the prerendered /404 route had,
 * so 404.html hydrates at whatever URL the host served it. Root's <Outlet>
 * wraps child matches in <Suspense>, and the child match renders
 * [page, <ScrollRestoration>]- a two-child fork that useId counts, so the
 * page sits at index 0 of a two-slot array here too (otherwise every useId
 * below, like the footer's popovers, mismatches).
 *
 * Don't simplify [page, null] to <NotFoundPage />: the pair mirrors the /404
 * match's [page, ScrollRestoration] children so useId lines up. Checked by
 * serving the /404 HTML at /hire-me (scratch/eggs/served404.ts).
 */
export const NotFoundRoot = () => (
	<Suspense>{[<NotFoundPage key="page" />, null]}</Suspense>
)
