import {
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
	type ReactNode
} from "react"
import * as ark from "~/lib/ark"
import { isOnscreen, prefersReducedMotion } from "~/lib/motion"

/**
 * One line of ArkType, running the real parser on every keystroke.
 *
 * SSR/no-JS render the final state below. Every message shown here is what
 * ArkType 2.2.8 itself produces (checked in node); the live widget never
 * hard-codes one, it only prerenders the last. ArkType runs in a worker
 * (~/lib/ark), so its ~2s evaluation never blocks the page.
 */

const FINAL = "string.email | 'david@arktype.io'"
const FINAL_STATUS: Status = { kind: "ok", text: "an email address" }
const FINAL_NOTE: Note = { kind: "extends", holds: true, reduced: true }

const chips = [
	"string > 3 | null",
	"5 < number < 3",
	"(string | number)[]",
	"z.string()"
]

type Status = { kind: "ok" | "err"; text: string } | { kind: "none" }
type Note =
	| { kind: "extends"; holds: boolean; reduced: boolean }
	| { kind: "quip"; item: Completion; typed: number }
	| null

type Phase = "static" | "waiting" | "ghost" | "live"

const toStatus = (parsed: ark.Parsed): Status =>
	parsed.ok ?
		{
			kind: "ok",
			text:
				(
					parsed.expression !== parsed.description &&
					parsed.expression.length < 40
				) ?
					`${parsed.description} · ${parsed.expression}`
				:	parsed.description
		}
	:	{ kind: "err", text: parsed.message }

/** The final state's second line, computed by the real runtime. */
const extendsNote = async (): Promise<Note> => {
	const [holds, union, email] = await Promise.all([
		ark.extendsType("'david@arktype.io'", "string.email"),
		ark.parse(FINAL),
		ark.parse("string.email")
	])
	return {
		kind: "extends",
		holds,
		reduced: union.ok && email.ok && union.expression === email.expression
	}
}

/** Zod method puns, each one David's own post. */
type Completion = { name: string; quip: string; href: string }
const completions: Completion[] = [
	{
		name: "missingOutOn",
		quip: `"It might be time to see what you're z.missingOutOn()."`,
		href: "https://bsky.app/profile/ssalbdivad.dev/post/3ljlbf77hsk2r"
	},
	{
		name: "back",
		quip: `"once you go type("string") you never go z.back()"`,
		href: "https://x.com/arktypeio/status/1996993043614814329"
	},
	{
		name: "shark",
		quip: `"RIP z.shark() / long live sharktype"`,
		href: "https://x.com/arktypeio/status/1993015076706828624"
	},
	{
		name: "cofounder",
		quip: `"sounds fake but I'm starting a company with my nemesis Colin P. Zod"`,
		href: "https://bsky.app/profile/ssalbdivad.dev/post/3m7nm3dbfhs2v"
	}
]

/** `fromChip`: opened by tapping z.string(), not by typing `z.` */
type Menu = {
	start: number
	end: number
	filter: string
	active: number
	fromChip?: true
}
const matching = (filter: string) =>
	completions.filter(c => c.name.toLowerCase().startsWith(filter.toLowerCase()))

const zDot = /(?:^|[^\w$.'"])z\.(\w*)$/

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const keywords = new Set([
	"string",
	"number",
	"bigint",
	"boolean",
	"symbol",
	"null",
	"undefined",
	"true",
	"false",
	"object"
])

/** ArkType's in-string grammar, the way its VS Code extension colors it. */
const highlight = (src: string): ReactNode[] =>
	[...src.matchAll(/(\s+)|(\d+(?:\.\d+)?)|([A-Za-z_$][\w$]*)|([^\s\w$])/g)].map(
		(m, i) => {
			const [text, space, digits, word] = m
			// a word after "." is a subalias (string.email, z.string), never a keyword
			const member = src[(m.index ?? 0) - 1] === "."
			const cls =
				space ? undefined
				: digits || (word && !member && keywords.has(word)) ? "hl-kw"
				: word ? "hl-id"
				: "hl-op"
			return (
				<span key={i} className={cls}>
					{text}
				</span>
			)
		}
	)

export const TypeLine = () => {
	const [value, setValue] = useState(FINAL)
	const [status, setStatus] = useState<Status>(FINAL_STATUS)
	const [note, setNote] = useState<Note>(FINAL_NOTE)
	const [phase, setPhase] = useState<Phase>("static")
	const [menu, setMenu] = useState<Menu | null>(null)
	const [squiggle, setSquiggle] = useState(0)
	const [scroll, setScroll] = useState(0)
	const root = useRef<HTMLDivElement>(null)
	const input = useRef<HTMLInputElement>(null)
	const ghost = useRef({ cancelled: false })
	const latest = useRef(0)
	const quipTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
	const listId = useId()
	const list = useRef<HTMLSpanElement>(null)

	const statusLine = useRef<HTMLDivElement>(null)
	const hl = useRef<HTMLSpanElement>(null)

	// keep the completion list inside the viewport. On touch it opens below
	// the status line, so the message it answers stays readable. Opened from
	// the z.string() chip with a mouse, it must not cover the other chips (the
	// next click would pick a completion): it opens upward, or, when that would
	// tuck it under the nav, below the chip row, over the aside.
	useLayoutEffect(() => {
		const el = list.current
		if (!el) return
		el.style.translate = ""
		el.style.top = ""
		el.style.bottom = ""
		const field = el.parentElement?.getBoundingClientRect()
		const below = statusLine.current?.getBoundingClientRect()
		if (field && below && matchMedia("(pointer: coarse)").matches)
			el.style.top = `${below.bottom - field.top + 4}px`
		else if (field && menu?.fromChip) {
			const chips = root.current
				?.querySelector(".tl-chips")
				?.getBoundingClientRect()
			if (field.top - el.offsetHeight - 6 >= 80) {
				el.style.top = "auto"
				el.style.bottom = "calc(100% + 6px)"
			} else if (chips) el.style.top = `${chips.bottom - field.top + 6}px`
		}
		const overflow =
			el.getBoundingClientRect().right -
			(document.documentElement.clientWidth - 12)
		if (overflow > 0) el.style.translate = `${-overflow}px 0`
	}, [menu?.start, menu?.filter, menu?.fromChip, scroll])

	// a tap anywhere outside the field dismisses the list (touch has no blur
	// when the input was never focused); options live inside the field
	const menuOpen = !!menu
	useEffect(() => {
		if (!menuOpen) return
		const close = (e: PointerEvent) => {
			if (!(e.target as Element | null)?.closest?.(".tl-field")) setMenu(null)
		}
		document.addEventListener("pointerdown", close, true)
		return () => document.removeEventListener("pointerdown", close, true)
	}, [menuOpen])

	const show = (next: Status) =>
		setStatus(prev => {
			if (next.kind === "err" && prev.kind !== "err") setSquiggle(n => n + 1)
			return next
		})

	/**
	 * Run the real parser; a reply to anything but the newest edit is dropped.
	 * If ArkType can't load at all (a deploy renamed its chunk), the line stays
	 * editable and just stops answering, rather than keeping a verdict about
	 * some earlier text.
	 */
	const parse = async (src: string) => {
		const id = ++latest.current
		let parsed: ark.Parsed
		let final: Note | undefined
		try {
			;[parsed, final] = await Promise.all([
				ark.parse(src),
				src === FINAL ? extendsNote() : undefined
			])
		} catch {
			if (id === latest.current) setStatus({ kind: "none" })
			return
		}
		if (id !== latest.current) return
		show(toStatus(parsed))
		setNote(prev => final ?? (prev?.kind === "quip" ? prev : null))
	}

	useEffect(() => {
		const el = root.current
		if (!el) return
		// warm the worker as the line approaches, but only once the visitor has
		// shown intent (a scroll, tap, key or focus); idle readers pay nothing
		let near: IntersectionObserver | undefined
		const intents = ["scroll", "pointerdown", "keydown", "focusin"] as const
		const onIntent = () => {
			for (const name of intents) removeEventListener(name, onIntent, true)
			near = new IntersectionObserver(
				entries => {
					if (!entries.some(e => e.isIntersecting)) return
					near?.disconnect()
					ark.warm()
				},
				{ rootMargin: "600px 0px" }
			)
			near.observe(el)
		}
		for (const name of intents)
			addEventListener(name, onIntent, { capture: true, passive: true })
		const stopNear = () => {
			for (const name of intents) removeEventListener(name, onIntent, true)
			near?.disconnect()
		}

		if (prefersReducedMotion() || isOnscreen(el)) {
			setPhase("live")
			return stopNear
		}

		// offscreen at hydration: rewind to an empty line, then type it out once
		const token = { cancelled: false }
		ghost.current = token
		setPhase("waiting")
		setValue("")
		setStatus({ kind: "none" })
		setNote(null)
		const half = new IntersectionObserver(
			entries => {
				// half the line, or half a short landscape screen
				const enough = (e: IntersectionObserverEntry) =>
					e.intersectionRatio >= 0.5 ||
					e.intersectionRect.height >= innerHeight * 0.5
				if (!entries.some(enough)) return
				half.disconnect()
				void play(token)
			},
			{ threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5] }
		)
		half.observe(el)
		return () => {
			token.cancelled = true
			stopNear()
			half.disconnect()
		}
	}, [])

	const play = async (token: { cancelled: boolean }) => {
		// parse every prefix up front, so the typing rhythm never waits on the worker
		const prefixes = Array.from(FINAL, (_, i) => FINAL.slice(0, i + 1))
		let states: Status[]
		let final: Note
		try {
			;[states, final] = await Promise.all([
				Promise.all(prefixes.map(src => ark.parse(src).then(toStatus))),
				extendsNote()
			])
		} catch {
			// ArkType couldn't load: show the finished line, as the prerender does
			if (!token.cancelled) land()
			return
		}
		if (token.cancelled) return
		setPhase("ghost")
		let wasValid = false
		for (const [i, src] of prefixes.entries()) {
			if (token.cancelled) return
			const next = states[i]!
			setValue(src)
			show(next)
			const el = input.current
			if (el) el.scrollLeft = el.scrollWidth
			await sleep(45)
			const valid = next.kind === "ok"
			if (valid && !wasValid) await sleep(350)
			wasValid = valid
		}
		if (token.cancelled) return
		// typing kept the caret end in view; at rest a narrow phone shows the start
		if (input.current) input.current.scrollLeft = 0
		setScroll(0)
		setNote(final)
		setPhase("live")
	}

	/**
	 * Interrupting the ghost lands on the finished line at once, from the
	 * prerendered constants, so nothing async can race a later edit.
	 */
	const land = () => {
		setValue(FINAL)
		setStatus(FINAL_STATUS)
		setNote(FINAL_NOTE)
		setPhase("live")
	}
	const stopGhost = () => {
		if (phase !== "ghost" && phase !== "waiting") return
		ghost.current.cancelled = true
		ghost.current = { cancelled: false }
		land()
	}

	const openMenuAt = (src: string, caret: number) => {
		const m = zDot.exec(src.slice(0, caret))
		if (!m) return setMenu(null)
		const filter = m[1] ?? ""
		if (!matching(filter).length) return setMenu(null)
		setMenu({ start: caret - filter.length, end: caret, filter, active: 0 })
	}

	const edit = (src: string, caret: number) => {
		stopGhost()
		clearTimeout(quipTimer.current)
		setValue(src)
		setNote(null)
		void parse(src)
		openMenuAt(src, caret)
	}

	const pick = (item: Completion) => {
		if (!menu) return
		const src = `${value.slice(0, menu.start)}${item.name}()${value.slice(menu.end).replace(/^\w*\(?\)?/, "")}`
		setMenu(null)
		setValue(src)
		void parse(src)
		const caret = menu.start + item.name.length + 2
		requestAnimationFrame(() => input.current?.setSelectionRange(caret, caret))
		clearTimeout(quipTimer.current)
		if (item.name !== "cofounder" || prefersReducedMotion()) {
			setNote({ kind: "quip", item, typed: item.quip.length })
			if (item.name === "cofounder") quipTimer.current = setTimeout(toArc, 700)
			return
		}
		// the punchline types itself, then lands on the arc
		let typed = 0
		const tick = () => {
			typed += 2
			setNote({ kind: "quip", item, typed: Math.min(typed, item.quip.length) })
			quipTimer.current =
				typed < item.quip.length ? setTimeout(tick, 28) : setTimeout(toArc, 900)
		}
		tick()
	}

	const toArc = () => {
		const arc = document.getElementById("arc")
		if (!arc) return
		arc.scrollIntoView({
			behavior: prefersReducedMotion() ? "auto" : "smooth",
			block: "center"
		})
		window.dispatchEvent(new CustomEvent("arc:replay"))
	}

	const runChip = (chip: string, focus: boolean) => {
		stopGhost()
		clearTimeout(quipTimer.current)
		setValue(chip)
		setNote(null)
		void parse(chip)
		if (chip.startsWith("z.")) {
			// tapping z.string() offers the alternatives
			setMenu({
				start: 2,
				end: chip.length,
				filter: "",
				active: 0,
				fromChip: true
			})
			if (focus)
				requestAnimationFrame(() =>
					input.current?.focus({ preventScroll: true })
				)
		} else setMenu(null)
	}

	const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		stopGhost()
		if (!menu) return
		const items = matching(menu.filter)
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault()
			const step = e.key === "ArrowDown" ? 1 : -1
			setMenu({
				...menu,
				active: (menu.active + step + items.length) % items.length
			})
		} else if (e.key === "Enter" || e.key === "Tab") {
			const item = items[menu.active]
			if (!item) return
			e.preventDefault()
			pick(item)
		} else if (e.key === "Escape") {
			e.preventDefault()
			setMenu(null)
		}
	}

	const items = menu ? matching(menu.filter) : []
	const editable = phase !== "static"
	// the prerender sizes the field in ch per UTF-16 unit, exact for ASCII in
	// a monospace font
	const width = `calc(${Math.max(value.length, 1)}ch + 2px)`

	// Anything else (full-width CJK, emoji) is sized from the highlighted
	// mirror, so it isn't clipped. ASCII keeps the ch width, pixel for pixel.
	useLayoutEffect(() => {
		const field = input.current?.parentElement
		const text = hl.current
		if (!field || !text) return
		field.style.width =
			/^[\x20-\x7e]*$/.test(value) ? width : (
				`${Math.max(text.offsetWidth, 8) + 2}px`
			)
	}, [value])

	return (
		// a touch on the card is usually a scroll passing through, so only a
		// mouse press or focusing the input interrupts the ghost
		<div
			className="tl"
			ref={root}
			data-phase={phase}
			onPointerDown={e => e.pointerType === "mouse" && stopGhost()}
		>
			<div className="tl-card">
				<p className="tl-cap mono">
					<span>
						<b>arktype</b> ·{" "}
						<span className="long">the real parser, running </span>live
					</span>
					<span className="tl-hint">type anything</span>
				</p>
				<div className="tl-code mono">
					<span className="tl-open" aria-hidden>
						<span className="decl tl-fn">type</span>
						<span className="tl-paren">(</span>
					</span>
					<span className="tl-arg">
						<span className="tl-q" aria-hidden>
							"
						</span>
						<span className="tl-field" style={{ width }}>
							<span className="tl-mirror" aria-hidden>
								<span
									className="tl-scroll"
									style={{ translate: `${-scroll}px 0` }}
								>
									<span
										key={squiggle}
										className="tl-squig"
										data-on={status.kind === "err" || undefined}
									>
										{value}
									</span>
									<span className="tl-hl" ref={hl}>
										{highlight(value)}
									</span>
								</span>
							</span>
							<input
								ref={input}
								className="tl-input"
								value={value}
								readOnly={!editable}
								aria-label="An ArkType definition, parsed as you type"
								role="combobox"
								aria-autocomplete="list"
								aria-expanded={!!menu && items.length > 0}
								aria-controls={listId}
								aria-activedescendant={
									menu && items.length ? `${listId}-${menu.active}` : undefined
								}
								autoCapitalize="off"
								autoCorrect="off"
								autoComplete="off"
								spellCheck={false}
								inputMode="text"
								enterKeyHint="done"
								onChange={e =>
									edit(
										e.target.value,
										e.target.selectionStart ?? e.target.value.length
									)
								}
								onKeyDown={onKeyDown}
								onScroll={e => setScroll(e.currentTarget.scrollLeft)}
								onFocus={stopGhost}
								onBlur={() => setMenu(null)}
							/>
							{menu && items.length > 0 && (
								<span
									ref={list}
									className="tl-menu"
									id={listId}
									role="listbox"
									aria-label="Completions"
									style={
										{
											"--at": menu.start,
											"--scroll": `${scroll}px`
										} as React.CSSProperties
									}
								>
									{items.map((item, i) => (
										<span
											key={item.name}
											id={`${listId}-${i}`}
											role="option"
											aria-selected={i === menu.active}
											className="tl-opt"
											onPointerDown={e => e.preventDefault()}
											onPointerEnter={() => setMenu({ ...menu, active: i })}
											onClick={() => pick(item)}
										>
											<span className="tl-ico" aria-hidden />
											<span className="tl-name">
												<b>{item.name.slice(0, menu.filter.length)}</b>
												{item.name.slice(menu.filter.length)}()
											</span>
											<span className="tl-kind">method</span>
										</span>
									))}
								</span>
							)}
						</span>
						<span className="tl-q" aria-hidden>
							"
						</span>
					</span>
					<span className="tl-close tl-paren" aria-hidden>
						)
					</span>
				</div>
				<div className="tl-status mono" ref={statusLine}>
					<p
						className="tl-msg"
						data-kind={status.kind}
						role="status"
						aria-live={phase === "live" ? "polite" : "off"}
					>
						{status.kind === "ok" && <span className="tl-check">✓ </span>}
						{status.kind !== "none" && status.text}
					</p>
					<NoteLine note={note} />
				</div>
			</div>
			<div className="tl-chips" aria-label="Try one" role="group">
				{chips.map((chip, i) => (
					<button
						key={chip}
						type="button"
						className="tl-chip mono"
						style={{ "--i": i } as React.CSSProperties}
						disabled={!editable}
						onClick={e =>
							runChip(
								chip,
								e.detail === 0 || !matchMedia("(pointer: coarse)").matches
							)
						}
					>
						{chip}
					</button>
				))}
			</div>
		</div>
	)
}

const NoteLine = ({ note }: { note: Note }) => {
	if (!note) return <p className="tl-note" />
	if (note.kind === "extends")
		return (
			<p className="tl-note tl-extends">
				<span className="hl-str">'david@arktype.io'</span>{" "}
				<span className="hl-op">extends</span>{" "}
				<span className="hl-kw">string</span>
				<span className="hl-op">.</span>
				<span className="hl-id">email</span> <span className="hl-op">→</span>{" "}
				<span className="hl-kw">{String(note.holds)}</span>
				{note.reduced && <span className="tl-dim"> · union reduced</span>}
			</p>
		)
	const done = note.typed >= note.item.quip.length
	return (
		<p className="tl-note tl-quip">
			<a href={note.item.href} target="_blank" rel="noreferrer">
				// {note.item.quip.slice(0, note.typed)}
				{done ?
					<span className="tl-ext"> ↗</span>
				:	<span className="tl-caret" aria-hidden />}
			</a>
		</p>
	)
}
