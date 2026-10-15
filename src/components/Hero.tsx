import { useEffect, useRef, useState } from "react"
import handleQueries from "~/data/snippets/handle.queries.json"
import regexHtml from "~/data/snippets/regex.html?raw"
import * as ark from "~/lib/ark"
import { dependencies } from "../../package.json"
import { prefersReducedMotion } from "~/lib/motion"
import { session } from "~/lib/storage"
import { CopyEmail } from "./CopyEmail"
import { Quickinfo } from "./Quickinfo"
import { GitHubIcon, LinkedInIcon } from "./icons"

export const Hero = () => (
	<header className="hero wrap grid12" id="top">
		<div className="hero-text">
			<div className="eyebrow rise" style={{ "--i": 1 } as React.CSSProperties}>
				<img
					className="avatar"
					src="/avatar.jpg"
					alt=""
					width={40}
					height={40}
				/>
				<Handle />
				<span className="where">
					<span className="slash">//</span> TypeScript engineer · Boston, MA
				</span>
			</div>
			<h1 className="display rise-fade">David Blass</h1>
			<p className="lede rise" style={{ "--i": 2 } as React.CSSProperties}>
				I make TypeScript's <span className="decl types">types</span> do things
				they probably shouldn't- then make them fast. Lately:{" "}
				<span className="decl agents">agents</span> × DX.
			</p>
			<dl className="roles rise" style={{ "--i": 3 } as React.CSSProperties}>
				<dt>author</dt>
				<dd>
					<a href="#work">ArkType</a>{" "}
					<span className="gloss">(TypeScript's 1:1 validator)</span>{" "}
					<span>· ArkRegex · Attest</span>
				</dd>
				<dt>co-creator</dt>
				<dd>
					<a href="#standard-schema">Standard Schema</a>{" "}
					<span className="gloss">· one interface for every TS validator</span>
				</dd>
				<dt>co-founder</dt>
				<dd>
					<a href="#pullfrog">Pullfrog</a>{" "}
					<span>· AI agents in GitHub Actions</span>
				</dd>
				<dt>consultant</dt>
				<dd>
					<a href="#perf">TypeScript performance</a> <span>· 2023–25</span>{" "}
					<span className="gloss wide">
						· for tRPC, Prisma, AWS &amp; more
					</span>
				</dd>
			</dl>
			<div className="ctas rise" style={{ "--i": 4 } as React.CSSProperties}>
				<CopyEmail />
				<a
					className="btn btn-ghost"
					href="https://github.com/ssalbdivad"
					aria-label="GitHub"
				>
					<GitHubIcon />
					<span className="bt">GitHub</span>
				</a>
				<a
					className="btn btn-ghost"
					href="https://www.linkedin.com/in/ssalbdivad"
					aria-label="LinkedIn"
				>
					<LinkedInIcon />
					<span className="bt">LinkedIn</span>
				</a>
			</div>
		</div>
		<CodeCard />
	</header>
)

// the version the intersection error actually comes from (pinned exactly)
const arktypeVersion = dependencies.arktype

const letters = [..."ssalbdivad"]

// each pair leaves zipStagger after the one inside it and flies for zipFly
// (which must match hero.css's `--zip 0.24s`); the outer pair, four
// staggers out, lands at zipMs
const zipStagger = 120
const zipFly = 240
const zipMs = 4 * zipStagger + zipFly

const zipStyle = (i: number) =>
	({
		"--dx": 9 - 2 * i,
		"--lane": i < 5 ? -1 : 1,
		// centre-out: 0ms for the middle pair, 480ms for the ends
		"--d": `${(Math.abs(4.5 - i) - 0.5) * zipStagger}ms`
	}) as React.CSSProperties

/**
 * @ssalbdivad is davidblass backwards. Hovering it zips the letters into
 * place from the centre out: letter i slides (9 - 2i)ch to its mirror slot,
 * the left half lifting over and the right half dropping under. Each pair
 * leaves 120ms after the one inside it and flies for 240ms, so at most two
 * pairs are in the air and no two flying letters ever overlap (simulated and
 * frame-checked before shipping). Pure CSS: a
 * registered --zip progress drives the slide and the lift together. The
 * hover is real twoslash.
 */
const Handle = () => {
	const [reversed, setReversed] = useState(false)
	const touched = useRef(false)
	const [intersection, setIntersection] = useState<string>()
	const result = useRef<HTMLSpanElement>(null)
	// the button unmounts on activation; hand focus to what replaced it
	useEffect(() => {
		if (intersection) result.current?.focus()
	}, [intersection])

	const wrap = useRef<HTMLSpanElement>(null)
	const [busy, setBusy] = useState(false)

	/**
	 * Once per session, show recruiters what the handle is: 1.7s after the
	 * page started loading, well after the entrance is still (never sooner
	 * than 250ms after hydration), and only while the whole handle is on
	 * screen below the nav in a visible tab. A demo that can't
	 * play isn't spent. '@davidblass' then holds, fully zipped, for 1.6s: the
	 * hold is chained off the flip and counted from when the last pair lands,
	 * so a long main-thread task can delay the demo but never shorten it.
	 */
	useEffect(() => {
		const el = wrap.current
		if (!el || prefersReducedMotion() || session.get("handle-demo")) return
		let start: ReturnType<typeof setTimeout> | undefined
		let end: ReturnType<typeof setTimeout> | undefined
		let inView = false
		const cancel = () => {
			clearTimeout(start)
			start = undefined
		}
		const schedule = () => {
			if (start || !inView || document.hidden) return
			start = setTimeout(flip, Math.max(250, 1700 - performance.now()))
		}
		const flip = () => {
			start = undefined
			if (touched.current || !inView || document.hidden) return
			session.set("handle-demo", "1")
			stop()
			setReversed(true)
			end = setTimeout(() => setReversed(false), zipMs + 1600)
		}
		const nav = document.querySelector<HTMLElement>(".nav")?.offsetHeight ?? 0
		const io = new IntersectionObserver(
			([entry]) => {
				inView = !!entry?.isIntersecting
				if (inView) schedule()
				else cancel()
			},
			{ threshold: 1, rootMargin: `-${nav}px 0px 0px 0px` }
		)
		const onVisibility = () => (document.hidden ? cancel() : schedule())
		const stop = () => {
			io.disconnect()
			document.removeEventListener("visibilitychange", onVisibility)
		}
		io.observe(el)
		document.addEventListener("visibilitychange", onVisibility)
		return () => {
			cancel()
			clearTimeout(end)
			stop()
		}
	}, [])

	const intersect = async () => {
		// not `disabled` while busy: that would drop keyboard focus to <body>
		if (busy) return
		setBusy(true)
		try {
			// type("'ssalbdivad' & 'davidblass'"), run by ArkType in its worker
			const result = await ark.intersect("'ssalbdivad'", "'davidblass'")
			setIntersection(result.ok ? "(no error?)" : result.message)
		} catch {
			// ArkType couldn't load (offline, a stale deploy): leave the button
		} finally {
			setBusy(false)
		}
	}

	return (
		<span
			className="handle-wrap"
			ref={wrap}
			onPointerEnter={() => {
				touched.current = true
				setReversed(false)
				// start ArkType's worker now, so "intersect them" answers quickly
				ark.warm()
			}}
			onFocus={() => ark.warm()}
		>
			<Quickinfo
				label="@ssalbdivad, davidblass backwards"
				trigger={
					<span className="handle" data-reversed={reversed || undefined}>
						<span className="at">@</span>
						<span className="word" aria-hidden>
							{letters.map((char, i) => (
								<span key={i} className="ch" style={zipStyle(i)}>
									{char}
								</span>
							))}
						</span>
						<span className="sr-only">ssalbdivad</span>
						<span className="flip" aria-hidden>
							davidblass
						</span>
					</span>
				}
			>
				<span className="qi-body code handle-qi">
					<span dangerouslySetInnerHTML={{ __html: handleQueries[0] ?? "" }} />
				</span>
				<span className="qi-doc handle-doc">
					<span className="pre mono">
						<span className="k">type</span> <span className="n">reverse</span>
						<span className="k">{"<"}</span>s <span className="k">extends</span>{" "}
						<span className="c">string</span>
						<span className="k">{"> ="}</span>
						{"\n  s "}
						<span className="k">extends</span>{" "}
						<span className="v">{"`${infer head}${infer tail}`"}</span>
						{"\n    "}
						<span className="k">?</span>{" "}
						<span className="v">{"`${reverse<tail>}${head}`"}</span>
						{"\n    "}
						<span className="k">:</span> <span className="v">""</span>
						{"\n\n"}
						<span className="k">type</span> <span className="n">me</span>{" "}
						<span className="k">=</span> <span className="n">reverse</span>
						<span className="k">{"<"}</span>
						<span className="v">"ssalbdivad"</span>
						<span className="k">{">"}</span>
					</span>
					{intersection ?
						<span
							className="intersection"
							ref={result}
							tabIndex={-1}
							role="status"
						>
							<span className="squiggle">{intersection}</span>
							<span className="aside">same guy. disjoint types.</span>
						</span>
					:	<button
							type="button"
							className="intersect link mono js-only"
							onClick={intersect}
							aria-busy={busy || undefined}
						>
							{busy ?
								"intersecting…"
							:	<>
									intersect them <span aria-hidden>→</span>
								</>
							}
						</button>
					}
				</span>
				<span className="qi-foot">
					{intersection ?
						<>
							<span>type: at build · error: live</span>
							<span>
								<i>TS 6.0.3</i> · arktype {arktypeVersion}
							</span>
						</>
					:	<>
							<span>computed by the compiler at build</span>
							<span>
								<i>TS 6.0.3</i>
							</span>
						</>
					}
				</span>
			</Quickinfo>
		</span>
	)
}

const CodeCard = () => (
	<figure className="codecard rise" style={{ "--i": 3 } as React.CSSProperties}>
		<figcaption>
			<span>
				<b>arkregex</b> <span className="what">· regex with types</span>
			</span>
			<span className="hint">
				<span className="hint-hover">hover any name</span>
				<span className="hint-tap">tap any name</span>
			</span>
		</figcaption>
		<div className="code" dangerouslySetInnerHTML={{ __html: regexHtml }} />
		<p className="codecard-foot mono">
			<span>inferred from the pattern: real compiler output</span>
			<span>
				<i>TS 6.0.3</i> · arkregex 0.0.13
			</span>
		</p>
	</figure>
)
