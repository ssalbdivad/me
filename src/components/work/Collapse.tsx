import { useEffect, useRef, useState } from "react"
import hubHtml from "~/data/snippets/work-standard.html?raw"
import { isOnscreen, prefersReducedMotion } from "~/lib/motion"
import { pct } from "~/viz/scale"
import { loadAnimate, warmAnimate } from "~/viz/animate"
import { Claim } from "../Quickinfo"

type Lib = { name: string; href: string; boat?: true }

const validators: Lib[] = [
	{ name: "Zod", href: "https://zod.dev" },
	{ name: "Valibot", href: "https://valibot.dev" },
	{ name: "ArkType", href: "https://arktype.io", boat: true },
	{
		name: "Effect Schema",
		href: "https://effect.website/docs/schema/introduction"
	}
]
const consumers: Lib[] = [
	{ name: "tRPC", href: "https://trpc.io" },
	{ name: "TanStack Form", href: "https://tanstack.com/form" },
	{ name: "TanStack Router", href: "https://tanstack.com/router" },
	{ name: "Hono", href: "https://hono.dev" },
	{ name: "React Hook Form", href: "https://react-hook-form.com" },
	{ name: "Elysia", href: "https://elysiajs.com" },
	{ name: "Nuxt UI", href: "https://ui.nuxt.com" },
	{ name: "AI SDK", href: "https://ai-sdk.dev" }
]
const more = "https://standardschema.dev/schema"
const adapters = validators.length * consumers.length
const integrations = validators.length + consumers.length

type Pt = readonly [number, number]
const bez = (a: Pt, c1: Pt, c2: Pt, b: Pt) =>
	`M${a[0]} ${a[1]}C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${b[0]} ${b[1]}`
const mix = (a: Pt, b: Pt, t: number): Pt => [
	a[0] + (b[0] - a[0]) * t,
	a[1] + (b[1] - a[1]) * t
]

/**
 * Two fixed geometries, so the server can draw the final state with no JS:
 * wide (validators left, tools right) and tall (validators on top, tools
 * below, flanking a center spine). Chips are HTML, placed by percentages of
 * the same viewBox.
 */
type Layout = {
	w: number
	h: number
	v: (i: number) => Pt
	c: (j: number) => Pt
	ports: readonly [Pt, Pt]
	direct: (i: number, j: number, t: number) => string
	vEdge: (i: number) => string
	cEdge: (j: number) => string
}

const wide: Layout = (() => {
	const w = 960
	const h = 450
	const v = (i: number): Pt => [206, 100 + 70 * i]
	const c = (j: number): Pt => [754, 60 + 45 * j]
	const ports = [
		[310, 240],
		[650, 240]
	] as const
	return {
		w,
		h,
		v,
		c,
		ports,
		direct: (i, j, t) => {
			const a = v(i)
			const b = c(j)
			const dx = (b[0] - a[0]) * 0.4
			return bez(
				a,
				mix([a[0] + dx, a[1]], ports[0], t),
				mix([b[0] - dx, b[1]], ports[1], t),
				b
			)
		},
		vEdge: i => {
			const a = v(i)
			const dx = (ports[0][0] - a[0]) * 0.5
			return bez(
				a,
				[a[0] + dx, a[1]],
				[ports[0][0] - dx, ports[0][1]],
				ports[0]
			)
		},
		cEdge: j => {
			const b = c(j)
			const dx = (b[0] - ports[1][0]) * 0.5
			return bez(
				ports[1],
				[ports[1][0] + dx, ports[1][1]],
				[b[0] - dx, b[1]],
				b
			)
		}
	}
})()

const tall: Layout = (() => {
	const w = 350
	const spine = 175
	const h = 512
	const side = (k: number) => (k % 2 ? 185 : 165)
	const v = (i: number): Pt => [side(i), 50 + 46 * Math.floor(i / 2)]
	const c = (j: number): Pt => [side(j), 354 + 46 * Math.floor(j / 2)]
	const ports = [
		[spine, 140],
		[spine, 290]
	] as const
	const bulge = (p: Pt) => (p[0] < spine ? 1 : -1) * 96
	return {
		w,
		h,
		v,
		c,
		ports,
		direct: (i, j, t) => {
			const a = v(i)
			const b = c(j)
			const dy = (b[1] - a[1]) * 0.35
			return bez(
				a,
				mix([a[0] + bulge(a), a[1] + dy], ports[0], t),
				mix([b[0] + bulge(b), b[1] - dy], ports[1], t),
				b
			)
		},
		vEdge: i => {
			const a = v(i)
			return bez(a, [spine, a[1]], [spine, (a[1] + ports[0][1]) / 2], ports[0])
		},
		cEdge: j => {
			const b = c(j)
			return bez(ports[1], [spine, (ports[1][1] + b[1]) / 2], [spine, b[1]], b)
		}
	}
})()

const layouts = { wide, tall }
type LayoutName = keyof typeof layouts

/** Where a chip sits in each layout, as CSS custom properties. */
const place = (side: "v" | "c", k: number) => {
	const [wx, wy] = side === "v" ? wide.v(k) : wide.c(k)
	const [tx, ty] = side === "v" ? tall.v(k) : tall.c(k)
	const rightAligned = (x: number, l: Layout) => x < l.w / 2
	const gap = 6
	const vars: Record<string, string> = {
		...(rightAligned(wx, wide) ?
			{ "--wr": pct((wide.w - wx + gap) / wide.w) }
		:	{ "--wl": pct((wx + gap) / wide.w) }),
		"--wt": pct(wy / wide.h),
		...(rightAligned(tx, tall) ?
			{ "--tr": pct((tall.w - tx) / tall.w) }
		:	{ "--tl": pct(tx / tall.w) }),
		"--tt": pct(ty / tall.h)
	}
	return vars as React.CSSProperties
}

type Phase = "final" | "idle" | "draw" | "collapse"
type Hover = { side: "v" | "c"; k: number } | null

const smooth = (from: number, to: number, t: number) => {
	const x = Math.min(1, Math.max(0, (t - from) / (to - from)))
	return x * x * (3 - 2 * x)
}

const ecosystem = {
	name: "standardSchemaEcosystem",
	type: '{ validators: "30+"; tools: "60+" }',
	doc: "Libraries listed on standardschema.dev as implementing or accepting the spec.",
	see: [{ href: more, label: "standardschema.dev/schema" }],
	asOf: "2026-10-13",
	note: "Rounded down from a count of 33 and 64 on the live list."
}

export const Collapse = () => {
	const root = useRef<HTMLElement>(null)
	const direct = useRef<Record<LayoutName, (SVGPathElement | null)[]>>({
		wide: [],
		tall: []
	})
	const groups = useRef<Record<string, SVGGElement | HTMLElement | null>>({})
	const [phase, setPhase] = useState<Phase>("final")
	const [hover, setHover] = useState<Hover>(null)
	const [collapsed, setCollapsed] = useState(true)

	useEffect(() => {
		const el = root.current
		if (!el || prefersReducedMotion() || isOnscreen(el)) return
		setPhase("idle")
		setCollapsed(false)
		warmAnimate()
		let disposed = false
		let stop: (() => void) | undefined
		let timer: ReturnType<typeof setTimeout> | undefined
		// half the figure, or half the screen: on a landscape phone the figure is
		// taller than the viewport and never reaches a 50% ratio
		const enough = (e: IntersectionObserverEntry) =>
			e.intersectionRatio >= 0.5 ||
			e.intersectionRect.height >= innerHeight * 0.5
		const io = new IntersectionObserver(
			entries => {
				if (!entries.some(enough)) return
				io.disconnect()
				setPhase("draw")
				const drawn = 600 + (adapters - 1) * 12
				timer = setTimeout(async () => {
					// Motion's animate() is lazy (~/viz/animate); it is long loaded by now.
					const animate = await loadAnimate()
					if (disposed) return
					setPhase("collapse")
					const g = groups.current
					const controls = animate(0, 1, {
						duration: 1.2,
						ease: [0.22, 1, 0.36, 1],
						onUpdate: t => {
							if (t > 0.6) setCollapsed(true)
							for (const name of ["wide", "tall"] as const) {
								const paths = direct.current[name]
								let k = 0
								for (let i = 0; i < validators.length; i++)
									for (let j = 0; j < consumers.length; j++)
										paths[k++]?.setAttribute("d", layouts[name].direct(i, j, t))
							}
							const out = String(1 - smooth(0.55, 1, t))
							const into = String(smooth(0.45, 0.95, t))
							for (const key of ["directWide", "directTall"])
								g[key]?.style.setProperty("opacity", out)
							for (const key of ["hubWide", "hubTall"])
								g[key]?.style.setProperty("opacity", into)
							const card = smooth(0.35, 0.85, t)
							g.card?.style.setProperty("opacity", String(card))
							g.card?.style.setProperty("scale", String(0.96 + 0.04 * card))
						},
						onComplete: () => {
							for (const node of Object.values(g)) {
								node?.style.removeProperty("opacity")
								node?.style.removeProperty("scale")
							}
							setPhase("final")
						}
					})
					stop = () => controls.stop()
				}, drawn + 500)
			},
			{ threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5] }
		)
		io.observe(el)
		return () => {
			disposed = true
			io.disconnect()
			clearTimeout(timer)
			stop?.()
		}
	}, [])

	const settled = phase === "final"
	const lit = (side: "v" | "c", k: number) =>
		!!hover && (hover.side === side ? hover.k === k : true) ? true : undefined
	const hoverProps = (side: "v" | "c", k: number) => ({
		onPointerEnter: () => settled && setHover({ side, k }),
		onPointerLeave: () => setHover(null),
		onFocus: () => settled && setHover({ side, k }),
		onBlur: () => setHover(null)
	})
	const chipLit = (side: "v" | "c", k: number) =>
		hover ?
			(hover.side === side ? hover.k === k : true) || undefined
		:	undefined

	const svg = (name: LayoutName) => {
		const l = layouts[name]
		const cap = name[0]!.toUpperCase() + name.slice(1)
		return (
			<svg
				className={`ss-svg ss-${name}`}
				viewBox={`0 0 ${l.w} ${l.h}`}
				aria-hidden
			>
				<g
					className="ss-direct"
					ref={g => void (groups.current[`direct${cap}`] = g)}
				>
					{validators.flatMap((_, i) =>
						consumers.map((_, j) => {
							const k = i * consumers.length + j
							return (
								<path
									key={k}
									ref={p => void (direct.current[name][k] = p)}
									d={l.direct(i, j, 0)}
									pathLength={1}
									style={{ "--k": k } as React.CSSProperties}
								/>
							)
						})
					)}
				</g>
				<g
					className="ss-hubedges"
					ref={g => void (groups.current[`hub${cap}`] = g)}
				>
					{validators.map((_, i) => (
						<path key={`v${i}`} d={l.vEdge(i)} data-lit={lit("v", i)} />
					))}
					{consumers.map((_, j) => (
						<path key={`c${j}`} d={l.cEdge(j)} data-lit={lit("c", j)} />
					))}
					{l.ports.map(([x, y]) => (
						<circle
							key={`${x}-${y}`}
							className="ss-port"
							cx={x}
							cy={y}
							r={3.5}
						/>
					))}
				</g>
			</svg>
		)
	}

	const caption =
		hover ?
			hover.side === "v" ?
				<>
					<b className="t">{validators[hover.k]!.name}</b> works with all{" "}
					{consumers.length} →
				</>
			:	<>
					<b className="t">{consumers[hover.k]!.name}</b> accepts all{" "}
					{validators.length} ←
				</>
		: !collapsed ?
			<>
				<b className="v">{adapters} adapters</b>, one for every validator ×
				every tool
			</>
		:	<>
				<b className="t">{integrations} integrations</b> instead of {adapters}{" "}
				adapters · <Claim claim={ecosystem}>30+ validators · 60+ tools</Claim>
			</>

	return (
		<figure
			className="ss"
			ref={root}
			data-phase={phase}
			data-hover={hover ? hover.side : undefined}
			aria-describedby="ss-desc"
		>
			<p className="sr-only" id="ss-desc">
				Diagram. Without a shared interface, {validators.length} validators and{" "}
				{consumers.length} tools need {adapters} adapters, one per pair. With
				Standard Schema each implements or accepts one interface, so{" "}
				{integrations} integrations connect every validator to every tool.
			</p>
			<div className="ss-stage">
				{svg("wide")}
				{svg("tall")}
				<span className="ss-label ss-label-v mono">validators</span>
				<span className="ss-label ss-label-c mono">frameworks &amp; tools</span>
				{validators.map((lib, i) => (
					<a
						key={lib.name}
						className="ss-chip"
						data-side="v"
						data-lit={chipLit("v", i)}
						href={lib.href}
						target="_blank"
						rel="noreferrer"
						style={place("v", i)}
						{...hoverProps("v", i)}
					>
						{lib.name}
						{lib.boat && <span className="ss-boat">⛵</span>}
					</a>
				))}
				{consumers.map((lib, j) => (
					<a
						key={lib.name}
						className="ss-chip"
						data-side="c"
						data-lit={chipLit("c", j)}
						href={lib.href}
						target="_blank"
						rel="noreferrer"
						style={place("c", j)}
						{...hoverProps("c", j)}
					>
						{lib.name}
					</a>
				))}
				<a
					className="ss-chip ss-more ss-more-v"
					href={more}
					target="_blank"
					rel="noreferrer"
				>
					+ more
				</a>
				<a
					className="ss-chip ss-more ss-more-c"
					href={more}
					target="_blank"
					rel="noreferrer"
				>
					+ more
				</a>
				<div
					className="ss-hub"
					ref={g => void (groups.current.card = g)}
					inert={!settled}
				>
					<p className="ss-hub-cap mono">
						<b>StandardSchemaV1</b> · one interface
					</p>
					<div className="code" dangerouslySetInnerHTML={{ __html: hubHtml }} />
				</div>
			</div>
			<figcaption className="ss-cap mono">
				<span
					key={hover ? `${hover.side}${hover.k}` : String(collapsed)}
					className="ss-cap-in"
				>
					{caption}
				</span>
			</figcaption>
			<details className="ss-table twin">
				<summary>the diagram as a table</summary>
				<table>
					<caption className="sr-only">
						Integrations with and without Standard Schema
					</caption>
					<thead>
						<tr>
							<th scope="col" />
							<th scope="col">without a standard</th>
							<th scope="col">with Standard Schema</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<th scope="row">validators</th>
							<td colSpan={2}>{validators.map(v => v.name).join(", ")}</td>
						</tr>
						<tr>
							<th scope="row">tools</th>
							<td colSpan={2}>{consumers.map(c => c.name).join(", ")}</td>
						</tr>
						<tr>
							<th scope="row">integrations</th>
							<td>
								{validators.length} × {consumers.length} = {adapters}
							</td>
							<td>
								{validators.length} + {consumers.length} = {integrations}
							</td>
						</tr>
					</tbody>
				</table>
			</details>
		</figure>
	)
}
