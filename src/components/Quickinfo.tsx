import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import {
	claims,
	downloadsClaim,
	type ClaimData,
	type ClaimId
} from "~/data/claims"
import { formatCompact, formatStamp } from "~/lib/format"
import { useLive } from "~/lib/live"

const hoverDelay = 120
const supportsAnchors = () =>
	typeof CSS !== "undefined" && CSS.supports("anchor-name: --a")
// phones, upright or sideways, dock the popover to the bottom of the
// viewport: the same query as styles.css's docking block
const docked = () =>
	matchMedia("(max-width: 760px), (pointer: coarse) and (max-height: 500px)")
		.matches

/**
 * A hoverable token with a tsserver-style quickinfo popover.
 *
 * The popover is a <span> and its content must be phrasing elements only
 * (styled as blocks), so a token can sit inside a <p>.
 *
 * - No JS: the Popover API opens it on click/tap.
 * - With JS: hover intent opens it for fine pointers, and it is positioned
 *   with CSS anchor positioning (or measured, where that's unsupported or
 *   `measure` is set).
 */
export const Quickinfo = ({
	trigger,
	children,
	className = "",
	label,
	describedBy,
	measure = false
}: {
	trigger: ReactNode
	children: ReactNode
	className?: string
	/** accessible name for the trigger, when its text alone is ambiguous */
	label?: string
	/** id of the visible text that says what the trigger is (a tile's label) */
	describedBy?: string
	/**
	 * Place it by measuring the trigger when it opens, even where anchors are
	 * supported: Firefox loses a transformed, animated anchor (the footer
	 * boat) and puts the popover at the viewport's left edge.
	 */
	measure?: boolean
}) => {
	const reactId = useId()
	const id = `qi${reactId.replace(/[^a-zA-Z0-9]/g, "")}`
	const anchor = `--${id}`
	const button = useRef<HTMLButtonElement>(null)
	const popover = useRef<HTMLSpanElement>(null)
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
	const pointer = useRef<string>(undefined)
	const [open, setOpen] = useState(false)

	useEffect(() => {
		const el = popover.current
		if (!el) return
		const onToggle = (e: Event) => {
			const isOpen = (e as ToggleEvent).newState === "open"
			setOpen(isOpen)
			if (isOpen && (measure || !supportsAnchors()) && !docked()) place()
		}
		el.addEventListener("toggle", onToggle)
		return () => el.removeEventListener("toggle", onToggle)
	}, [])

	const place = () => {
		const b = button.current?.getBoundingClientRect()
		const p = popover.current
		if (!b || !p) return
		const width = p.offsetWidth
		const left = Math.max(12, Math.min(b.left, window.innerWidth - width - 12))
		const below = b.bottom + 10 + p.offsetHeight < window.innerHeight
		p.style.position = "fixed"
		p.style.left = `${left}px`
		p.style.top =
			below ? `${b.bottom + 10}px` : `${b.top - p.offsetHeight - 10}px`
	}

	const show = () => {
		clearTimeout(timer.current)
		timer.current = setTimeout(() => {
			if (!popover.current?.matches(":popover-open"))
				popover.current?.showPopover()
		}, hoverDelay)
	}
	const hide = () => {
		clearTimeout(timer.current)
		timer.current = setTimeout(() => {
			const p = popover.current
			if (
				p?.matches(":popover-open") &&
				!p.matches(":hover") &&
				!button.current?.matches(":hover")
			)
				p.hidePopover()
		}, hoverDelay)
	}
	const onPointer = (e: React.PointerEvent, enter: boolean) => {
		if (e.pointerType !== "mouse") return
		if (enter) show()
		else hide()
	}

	return (
		<>
			<button
				ref={button}
				type="button"
				className={`tok ${className}`}
				popoverTarget={id}
				popoverTargetAction="show"
				aria-expanded={open}
				aria-label={label}
				aria-describedby={describedBy}
				style={{ anchorName: anchor } as React.CSSProperties}
				onPointerEnter={e => onPointer(e, true)}
				onPointerLeave={e => onPointer(e, false)}
				onPointerDown={e => (pointer.current = e.pointerType)}
				onClick={e => {
					// a second tap closes it. A mouse keeps "show": hover already
					// opened it, so its click must not toggle it shut
					const tapped =
						pointer.current === "touch" || pointer.current === "pen"
					pointer.current = undefined
					if (tapped && popover.current?.matches(":popover-open")) {
						e.preventDefault()
						popover.current.hidePopover()
					}
				}}
			>
				{trigger}
			</button>
			<span
				ref={popover}
				id={id}
				popover="auto"
				className={measure ? "qi qi-measured" : "qi"}
				style={{ positionAnchor: anchor } as React.CSSProperties}
				onPointerEnter={e => onPointer(e, true)}
				onPointerLeave={e => onPointer(e, false)}
			>
				{children}
			</span>
		</>
	)
}

/** Colors a TS type string the way ArkDark would. */
export const TypeText = ({ text }: { text: string }) => {
	const parts = text.split(
		/("[^"]*"|\b\d[\d_.]*\b|[{}[\]();:|,<>=→]|\b(?:true|false|null|undefined|string|number)\b)/
	)
	return (
		<>
			{parts.map((part, i) => {
				if (!part) return null
				if (part.startsWith('"'))
					return (
						<span key={i} className="v">
							{part}
						</span>
					)
				if (/^\d/.test(part))
					return (
						<span key={i} className="c">
							{part}
						</span>
					)
				if (/^[{}[\]();:|,<>=→]$/.test(part))
					return (
						<span key={i} className="k">
							{part}
						</span>
					)
				if (/^(true|false|null|undefined|string|number)$/.test(part))
					return (
						<span key={i} className="c">
							{part}
						</span>
					)
				return <span key={i}>{part}</span>
			})}
		</>
	)
}

/** Inline `code` in a claim's doc line. */
const Doc = ({ text }: { text: string }) => (
	<>
		{text.split(/(`[^`]+`)/).map((part, i) =>
			part.startsWith("`") ?
				<code key={i} className="mono text-[0.92em] text-ink">
					{part.slice(1, -1)}
				</code>
			:	part
		)}
	</>
)

export const ClaimBody = ({
	claim,
	live
}: {
	claim: ClaimData
	live?: string | undefined
}) => (
	<>
		<span className="qi-body">
			<span className="k">const</span> <span className="n">{claim.name}</span>
			<span className="k">:</span> <TypeText text={claim.type} />
		</span>
		<span className="qi-doc">
			<span className="qi-line">
				<Doc text={claim.doc} />
			</span>
			{claim.growth && (
				<span className="qi-line qi-growth">{claim.growth}</span>
			)}
			{claim.note && <span className="qi-line qi-note">{claim.note}</span>}
			{claim.see.map(see => (
				<span key={see.href} className="qi-line tag">
					<i>@see</i>{" "}
					<a href={see.href} target="_blank" rel="noreferrer">
						{see.label}
					</a>
				</span>
			))}
		</span>
		<span className="qi-foot">
			{live ?
				<span className="live">{live}</span>
			: claim.asOf ?
				<span>
					{claim.live ? "snapshot" : "as of"} ·{" "}
					{claim.asOf.length > 10 ? formatStamp(claim.asOf) : claim.asOf}
				</span>
			:	<span>public record</span>}
			<span>
				<i>{claim.source ?? "sourced"}</i>
			</span>
		</span>
	</>
)

/**
 * A number (or phrase) that carries its source. Pass `id` for a registered
 * claim, or `claim` for a one-off.
 */
export const Claim = ({
	id,
	claim,
	children,
	className,
	describedBy
}: {
	id?: ClaimId
	claim?: ClaimData
	children: ReactNode
	className?: string
	/** id of the visible label that says what the number is */
	describedBy?: string
}) => {
	const snapshot: ClaimData | undefined = claim ?? (id && claims[id])
	if (!snapshot) throw new Error(`Unknown claim ${id}`)
	const live = useLive()
	const fresh = snapshot.pkg && live ? live.downloads[snapshot.pkg] : undefined
	// once npm has a newer complete window, every instance of a live claim
	// (hero tile, Work row) shows it, and its popover describes that window
	const data =
		fresh === undefined || !live ?
			snapshot
		:	{
				...downloadsClaim(
					snapshot.name,
					snapshot.pkg!,
					{
						downloads: fresh,
						start: live.start,
						end: live.end,
						asOf: live.checkedAt
					},
					snapshot.note
				),
				pkg: snapshot.pkg!,
				...(snapshot.growth && { growth: snapshot.growth })
			}
	return (
		<Quickinfo
			trigger={fresh === undefined ? children : formatCompact(fresh)}
			{...(className && { className })}
			{...(describedBy && { describedBy })}
		>
			<ClaimBody
				claim={data}
				live={
					live && fresh !== undefined ?
						`live · read ${formatStamp(live.checkedAt)}`
					:	undefined
				}
			/>
		</Quickinfo>
	)
}
