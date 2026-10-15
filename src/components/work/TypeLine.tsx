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
	| { kind: "quip"; item: Completion }
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

const ghosting = (phase: Phase) => phase === "ghost" || phase === "waiting"

/**
 * The run a double-click at `at` selects: the word it touches (the one on its
 * right first), else the run of operators or blanks there. Past the end of
 * the line, that's the last one. A word is any letters, digits and marks, as
 * natively (naïve, café), plus _ and $. A CJK run is one word, where each
 * engine's dictionary splits it its own way.
 */
const runAt = (src: string, at: number): [number, number] => {
	const kind = (c: string | undefined) =>
		c === undefined ? undefined
		: /[\p{L}\p{N}\p{M}_$]/u.test(c) ? "word"
		: /\s/.test(c) ? "blank"
		: "op"
	const left = kind(src[at - 1])
	const right = kind(src[at])
	const k = right === "word" || left === "word" ? "word" : (right ?? left)
	let from = at
	let to = at
	while (from > 0 && kind(src[from - 1]) === k) from--
	while (to < src.length && kind(src[to]) === k) to++
	return [from, to]
}

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

/**
 * ArkType's in-string grammar, the way its VS Code extension colors it.
 *
 * Whitespace renders like VS Code's "boundary" mode: every run but a single
 * space between words is drawn as faint dots, so " " can't pass for an
 * empty line. "·" is one cell like " ", so the mirror stays aligned with the
 * input's own (invisible) glyphs and its caret. Tabs keep their width and
 * stay blank: Cascadia's subset has no arrow to draw them with.
 *
 * Any other invisible character is boxed, one per char, like VS Code's
 * unicodeHighlight, so a pasted NBSP can't pass for a space (or nothing).
 * Each keeps its own glyph, so its width is the input's whatever the font:
 * wide spaces (U+3000) stay wide, and zero-width ones (U+200B) stay zero
 * wide, marked by a tick painted on their empty box. Every char keeps its
 * UTF-16 length, so a mirror offset is an input offset (see offsetX).
 *
 * A token never splits a grapheme cluster: a char inside one (a combining
 * accent, a flag's second half, a skin tone) joins the token before it, so é
 * takes its e's color. A joiner inside one (the ZWJs of 👩‍💻) is part of a
 * glyph and goes unmarked; one dangling at a cluster's end (a ZWJ after an
 * ASCII letter) is marked. The markers are paint only, never a pseudo-element:
 * an out-of-flow box between two chars splits the browsers' shaping, which
 * then draws 👩‍💻 as 👩 and 💻, wider than the input's own glyph.
 */
// zero-width chars; other blanks (NBSP, wide spaces, Hangul fillers)
const zeroWidth =
	"[\\u00ad\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u2064\\u2066-\\u2069\\ufeff]"
const oddBlank = "[^\\S \\t]|[\\u115f\\u1160\\u2800\\u3164\\uffa0]"
// zero-width, other blanks, spaces and tabs, numbers, words, operators
const token = new RegExp(
	`(${zeroWidth})|(${oddBlank})|([ \\t]+)|(\\d+(?:\\.\\d+)?)|([A-Za-z_$][\\w$]*)|([^\\s\\w$])`,
	"gu"
)
const invisible = new RegExp(`(${zeroWidth})|(${oddBlank})`, "gu")

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" })

/** Where each grapheme cluster of `src` starts, and its end. */
const clusterBounds = (src: string) => {
	const bounds = new Set([src.length])
	for (const { index } of graphemes.segment(src)) bounds.add(index)
	return bounds
}

/**
 * Whether a char matched at `at` is drawn on its own: it starts a cluster,
 * or it's a zero-width one dangling at a cluster's end. Any other is part of
 * a glyph (a combining accent, the ZWJs of \ud83d\udc69\u200d\ud83d\udcbb).
 */
const standsAlone = (
	bounds: Set<number>,
	at: number,
	text: string,
	zero: boolean
) => bounds.has(at) || (zero && bounds.has(at + text.length))

const highlight = (src: string): ReactNode[] => {
	const bounds = clusterBounds(src)
	// `dots`: a space run drawn in boundary style
	const tokens: { className?: string; text: string; dots?: true }[] = []
	for (const m of src.matchAll(token)) {
		const [text, zero, odd, space, digits, word] = m
		const at = m.index
		const last = tokens.at(-1)
		if (last && !standsAlone(bounds, at, text, !!zero)) {
			last.text += text
			continue
		}
		if (zero || odd) {
			tokens.push({ className: zero ? "hl-zw" : "hl-uws", text })
			continue
		}
		if (space) {
			const between =
				text === " " &&
				/\S/.test(src[at - 1] ?? "") &&
				/\S/.test(src[at + 1] ?? "")
			tokens.push(between ? { text } : { className: "hl-ws", text, dots: true })
			continue
		}
		// a word after "." is a subalias (string.email, z.string), never a keyword
		const member = src[at - 1] === "."
		const className =
			digits || (word && !member && keywords.has(word)) ? "hl-kw"
			: word ? "hl-id"
			: "hl-op"
		tokens.push({ className, text })
	}
	return tokens.map(({ className, text, dots }, i) => (
		<span key={i} className={className}>
			{dots ? text.replaceAll(" ", "·") : text}
		</span>
	))
}

/**
 * ArkType's message with the invisible chars marked as the mirror marks
 * them, so "'string​' is unresolvable" can't read as plain 'string'
 * under the line that boxes its ZWSP. Spaces stay plain: a message's own
 * edge spaces are trimmed (" " says "Expected an expression") and its inner
 * ones are prose. The sr-only verdict keeps the raw text.
 */
const marked = (text: string): ReactNode[] => {
	const bounds = clusterBounds(text)
	const out: ReactNode[] = []
	let from = 0
	for (const m of text.matchAll(invisible)) {
		const [char, zero] = m
		if (!standsAlone(bounds, m.index, char, !!zero)) continue
		if (m.index > from) out.push(text.slice(from, m.index))
		out.push(
			<span key={m.index} className={zero ? "hl-zw" : "hl-uws"}>
				{char}
			</span>
		)
		from = m.index + char.length
	}
	if (from < text.length) out.push(text.slice(from))
	return out
}

export const TypeLine = () => {
	const [value, setValue] = useState(FINAL)
	const [status, setStatus] = useState<Status>(FINAL_STATUS)
	const [note, setNote] = useState<Note>(FINAL_NOTE)
	const [phase, setPhase] = useState<Phase>("static")
	const [menu, setMenu] = useState<Menu | null>(null)
	const [squiggle, setSquiggle] = useState(0)
	const [scroll, setScroll] = useState(0)
	// a parse is in flight: the verdict on screen is about older text
	const [pending, setPending] = useState(false)
	// what the live region says, once typing pauses
	const [spoken, setSpoken] = useState("")
	// bumped to remount the input, dropping its native undo history
	const [epoch, setEpoch] = useState(0)
	const root = useRef<HTMLDivElement>(null)
	const input = useRef<HTMLInputElement>(null)
	const ghost = useRef({ cancelled: false })
	const latest = useRef(0)
	const edited = useRef(false)
	const pointer = useRef("")
	// where the last press went down, before any touch adjustment moved it
	const down = useRef({ x: 0, y: 0 })
	const listId = useId()
	const msgId = useId()
	const list = useRef<HTMLSpanElement>(null)

	const statusLine = useRef<HTMLDivElement>(null)
	const hl = useRef<HTMLSpanElement>(null)
	const scrollBox = useRef<HTMLSpanElement>(null)

	// keep the completion list inside the viewport. On touch it opens below
	// the status line, so the message it answers stays readable. Opened from
	// the z.string() chip, it must not cover the other chips (the next tap or
	// click would pick a completion): with a mouse it opens upward, and on
	// touch, or when upward would tuck it under the nav, below the chip row,
	// over the aside.
	useLayoutEffect(() => {
		const el = list.current
		if (!el || !menu) return
		// under its z., measured on the mirror: wide chars (字, emoji) aren't
		// 1ch, and the list's own ch is its 14px font's
		el.style.setProperty("--at-x", `${offsetX(menu.start)}px`)
		el.style.translate = ""
		el.style.top = ""
		el.style.bottom = ""
		const field = el.parentElement?.getBoundingClientRect()
		const below = statusLine.current?.getBoundingClientRect()
		const coarse = matchMedia("(pointer: coarse)").matches
		if (field && menu?.fromChip) {
			const chips = root.current
				?.querySelector(".tl-chips")
				?.getBoundingClientRect()
			if (!coarse && field.top - el.offsetHeight - 6 >= 80) {
				el.style.top = "auto"
				el.style.bottom = "calc(100% + 6px)"
			} else if (chips) el.style.top = `${chips.bottom - field.top + 6}px`
		} else if (field && below && coarse)
			el.style.top = `${below.bottom - field.top + 4}px`
		const overflow =
			el.getBoundingClientRect().right -
			(document.documentElement.clientWidth - 12)
		if (overflow > 0) el.style.translate = `${-overflow}px 0`
	}, [menu?.start, menu?.filter, menu?.fromChip, scroll, value])

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

	/**
	 * The mirror follows the input's scroll directly, not through a render: the
	 * scroll event fires in the frame's own rendering step, so the glyphs move
	 * with the caret on the same paint. React state (for the menu's position)
	 * would trail it by a frame or more. Also marks which edges hide text.
	 */
	const syncScroll = () => {
		const el = input.current
		const box = scrollBox.current
		if (!el || !box) return
		const x = el.scrollLeft
		box.style.translate = x ? `${-x}px 0` : ""
		const start = x > 0.5
		const end = x < el.scrollWidth - el.clientWidth - 0.5
		const clip =
			start && end ? "both"
			: start ? "start"
			: end ? "end"
			: ""
		if (clip) box.parentElement?.setAttribute("data-clip", clip)
		else box.parentElement?.removeAttribute("data-clip")
		setScroll(x)
	}

	/**
	 * Where the boundary before `at` sits on the unscrolled line, read off the
	 * mirror, whose text has the input's offsets char for char (see highlight).
	 */
	const offsetX = (at: number) => {
		const text = hl.current
		if (!text) return 0
		const walk = document.createTreeWalker(text, NodeFilter.SHOW_TEXT)
		let rest = at
		for (let node = walk.nextNode(); node; node = walk.nextNode()) {
			const length = (node as Text).length
			if (rest <= length) {
				const range = document.createRange()
				range.setStart(node, rest)
				return (
					range.getBoundingClientRect().left - text.getBoundingClientRect().left
				)
			}
			rest -= length
		}
		return text.offsetWidth
	}

	/**
	 * Scroll the caret at `at` into view, as typing would. Chromium skips its
	 * own reveal for a selection set from script, so a press on the row (focused
	 * with preventScroll) or an inserted completion would leave the caret
	 * offscreen on a value wider than the field until the next keystroke.
	 */
	const reveal = (at: number) => {
		const el = input.current
		if (!el) return
		const x = offsetX(at)
		// the caret is drawn just right of its boundary
		if (x < el.scrollLeft) el.scrollLeft = x
		else if (x + 2 > el.scrollLeft + el.clientWidth)
			el.scrollLeft = x + 2 - el.clientWidth
		syncScroll()
	}

	// the field's width follows the viewport too (max-width: 100%)
	useEffect(() => {
		const field = input.current?.parentElement
		if (!field) return
		const resized = new ResizeObserver(syncScroll)
		resized.observe(field)
		return () => resized.disconnect()
	}, [])

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
		setPending(true)
		let parsed: ark.Parsed
		let final: Note | undefined
		try {
			;[parsed, final] = await Promise.all([
				ark.parse(src),
				src === FINAL ? extendsNote() : undefined
			])
		} catch {
			if (id === latest.current) {
				setPending(false)
				setStatus({ kind: "none" })
			}
			return
		}
		if (id !== latest.current) return
		setPending(false)
		show(toStatus(parsed))
		setNote(prev => final ?? (prev?.kind === "quip" ? prev : null))
	}

	// screen readers hear the verdict once typing pauses, not one per keystroke
	// over their own key echo; the ghost and the prerendered line say nothing
	useEffect(() => {
		if (!edited.current || pending || status.kind === "none") return
		const t = setTimeout(
			() =>
				setSpoken(status.kind === "ok" ? `Valid: ${status.text}` : status.text),
			700
		)
		return () => clearTimeout(t)
	}, [status, pending])

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
		syncScroll()
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
		if (!ghosting(phase)) return
		ghost.current.cancelled = true
		ghost.current = { cancelled: false }
		land()
	}

	const openMenuAt = (src: string, caret: number) => {
		const m = zDot.exec(src.slice(0, caret))
		if (!m) return setMenu(null)
		const filter = m[1] ?? ""
		if (!matching(filter).length) return setMenu(null)
		const start = caret - filter.length
		// re-reading the same word (a select event after the edit) keeps the
		// highlighted option
		setMenu(prev =>
			prev && !prev.fromChip && prev.start === start && prev.filter === filter ?
				prev
			:	{ start, end: caret, filter, active: 0 }
		)
	}

	const edit = (src: string, caret: number) => {
		stopGhost()
		edited.current = true
		setValue(src)
		setNote(null)
		setSpoken("")
		void parse(src)
		openMenuAt(src, caret)
	}

	/**
	 * Replace [start, end) the way typing would, so it is one native undo step.
	 * Assigning the value from React would drop the browser's undo history, and
	 * Chromium would later replay stale entries onto the new text. insertText
	 * fires a real input event, so onChange runs edit() as for a keystroke. It
	 * needs focus; a chip tapped on touch must not raise the keyboard, so there
	 * the value is set directly and the input remounted with a fresh history.
	 */
	const replace = (
		start: number,
		end: number,
		text: string,
		focus: boolean
	) => {
		const el = input.current
		if (!el) return
		const focused = document.activeElement === el
		const caret = start + text.length
		// by the next frame the mirror shows the new text to measure the caret on
		const settle = () =>
			requestAnimationFrame(() => {
				const el = input.current
				if (!el || document.activeElement !== el) return
				el.setSelectionRange(caret, caret)
				reveal(caret)
			})
		if (focused || focus) {
			el.focus({ preventScroll: true })
			el.setSelectionRange(start, end)
			if (document.execCommand("insertText", false, text)) return settle()
		}
		const src = `${el.value.slice(0, start)}${text}${el.value.slice(end)}`
		if (focused) settle()
		else setEpoch(n => n + 1)
		edit(src, caret)
	}

	const pick = (item: Completion) => {
		if (!menu) return
		const src = input.current?.value ?? value
		// swallow the rest of the word and an empty call after it (z.ba|ck()),
		// never a paren that opens the text that follows (z.|(string))
		const rest = /^\w*(?:\(\))?/.exec(src.slice(menu.end))?.[0].length ?? 0
		replace(menu.start, menu.end + rest, `${item.name}()`, false)
		setMenu(null)
		setNote({ kind: "quip", item })
	}

	/**
	 * `focus`: false for a tap on touch, which shouldn't raise the keyboard.
	 * Otherwise the replacement goes through the input (see replace()), and
	 * focus returns to the chip unless z.string() opened a menu to pick from.
	 */
	const runChip = (chip: string, focus: boolean, button: HTMLElement) => {
		stopGhost()
		replace(0, input.current?.value.length ?? value.length, chip, focus)
		if (chip.startsWith("z.")) {
			// tapping z.string() offers the alternatives
			setMenu({
				start: 2,
				end: chip.length,
				filter: "",
				active: 0,
				fromChip: true
			})
		} else {
			setMenu(null)
			if (focus) button.focus({ preventScroll: true })
		}
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
		} else if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
			const item = items[menu.active]
			if (!item) return
			e.preventDefault()
			pick(item)
		} else if (e.key === "Escape") {
			e.preventDefault()
			setMenu(null)
		} else if (e.key === "Tab") setMenu(null)
	}

	// the list follows the caret, as in VS Code: an arrow, Home or a click that
	// leaves the z. word closes it, so Enter can't complete somewhere else
	const onSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
		if (!menu) return
		const el = e.currentTarget
		const at = el.selectionStart ?? 0
		if (el.selectionEnd !== at) setMenu(null)
		else if (!menu.fromChip) openMenuAt(el.value, at)
		else if (at < menu.start || at > menu.end) setMenu(null)
	}

	/**
	 * Where a press at (x, y) on the row puts the caret, as a code editor
	 * would: within the field, the nearest boundary (the browser's own answer,
	 * so wide glyphs and emoji resolve as a click on the input would); left of
	 * it, the start; right of it, the end. On a phone the row is stacked, and
	 * the line above or below the value decides instead.
	 */
	const caretAt = (x: number, y: number) => {
		const el = input.current!
		const box = el.getBoundingClientRect()
		const end = el.value.length
		const open = root.current
			?.querySelector(".tl-open")
			?.getBoundingClientRect()
		const stacked = !!open && open.bottom <= box.top + 1
		if (stacked && y < box.top) return 0
		if (stacked && y > box.bottom) return end
		if (x <= box.left) return 0
		if (x >= box.right) return end
		const hit = document.caretPositionFromPoint?.(x, box.top + box.height / 2)
		if (hit?.offsetNode === el) return hit.offset
		const ch = (hl.current?.offsetWidth ?? 0) / end || 9
		return Math.min(end, Math.round((x - box.left + el.scrollLeft) / ch))
	}

	/**
	 * The whole type("…") row is the editor. A press on the input itself stays
	 * native (drag-select, double-click); anywhere else on the row focuses it
	 * and places the caret, and a drag from there extends the selection. During
	 * the ghost, a press lands the line with the caret at its end, never at
	 * the old x against the longer text.
	 */
	const press = (x: number, y: number, extend: boolean) => {
		const el = input.current
		if (!el) return
		el.focus({ preventScroll: true })
		if (ghosting(phase)) {
			stopGhost()
			caretToEnd()
			return
		}
		const at = caretAt(x, y)
		const anchor =
			!extend ? at
			: el.selectionDirection === "backward" ? (el.selectionEnd ?? at)
			: (el.selectionStart ?? at)
		const select = (to: number) => {
			el.setSelectionRange(
				Math.min(anchor, to),
				Math.max(anchor, to),
				to < anchor ? "backward" : "forward"
			)
			reveal(to)
		}
		select(at)
		return select
	}

	const onRowMouseDown = (e: React.MouseEvent) => {
		const target = e.target as Element
		if (
			pointer.current !== "mouse" ||
			e.button !== 0 ||
			target.closest(".tl-menu") ||
			(target === input.current && !ghosting(phase))
		)
			return
		e.preventDefault()
		const select = press(e.clientX, e.clientY, e.shiftKey)
		if (!select) return
		// a double-click selects the word at the caret, a triple-click the
		// line, as on the input itself
		const el = input.current!
		if (e.detail >= 2 && !e.shiftKey) {
			const [from, to] =
				e.detail >= 3 ?
					[0, el.value.length]
				:	runAt(el.value, el.selectionStart ?? 0)
			el.setSelectionRange(from, to)
			return
		}
		const move = (ev: MouseEvent) => {
			if (!(ev.buttons & 1)) return up()
			select(caretAt(ev.clientX, ev.clientY))
		}
		const up = () => {
			removeEventListener("mousemove", move)
			removeEventListener("mouseup", up)
		}
		addEventListener("mousemove", move)
		addEventListener("mouseup", up)
	}

	/**
	 * After the events that landed the ghost, put the caret at the end of the
	 * finished line, in view. Not over a chip's text, which replaced it.
	 */
	const caretToEnd = () =>
		requestAnimationFrame(() => {
			const el = input.current
			if (!el || document.activeElement !== el || el.value !== FINAL) return
			el.setSelectionRange(FINAL.length, FINAL.length)
			reveal(FINAL.length)
		})

	/**
	 * Focus mid-ghost (a tap on the input, or Tab) lands the line, but a tap
	 * then puts the native caret where it fell in the shorter text, splitting
	 * a word. Once the tap's events are done, the caret goes to the end, as a
	 * press on the row puts it.
	 */
	const onFocus = () => {
		if (!ghosting(phase)) return
		stopGhost()
		caretToEnd()
	}

	/**
	 * On touch the row answers a tap (a click), never the press, so a scroll
	 * that starts on it passes through. A tap on the input keeps its native
	 * caret, unless the finger was off it: Chromium's touch adjustment snaps a
	 * tap on a quote, or on the type( or ) line of the stacked row, onto the
	 * input, and its caret onto the visible edge of a long value or the middle
	 * of the word under it. The press's own point, not the click's adjusted
	 * one, decides; where the row isn't stacked, caretAt() resolves a tap just
	 * above or below the input by its x alone.
	 */
	const onRowClick = (e: React.MouseEvent) => {
		const target = e.target as Element
		if (pointer.current === "mouse" || target.closest(".tl-menu")) return
		if (target !== input.current) return press(e.clientX, e.clientY, false)
		const box = target.getBoundingClientRect()
		const { x, y } = down.current
		if (x <= box.left || x >= box.right || y < box.top || y > box.bottom)
			press(x, y, false)
	}

	const items = menu ? matching(menu.filter) : []
	const editable = phase !== "static"
	// the prerender sizes the field in ch per UTF-16 unit, exact for ASCII in
	// a monospace font. Empty is 2px, just the caret: type("") reads as empty,
	// and clicks don't need the room, since the whole row takes them.
	const width = `calc(${value.length}ch + 2px)`

	// Anything else (full-width CJK, emoji) is sized from the highlighted
	// mirror, so it isn't clipped. ASCII keeps the ch width, pixel for pixel.
	// An edit can move the input's scroll before its scroll event arrives
	// (Backspace near the end), so the mirror re-syncs here too.
	useLayoutEffect(() => {
		const field = input.current?.parentElement
		const text = hl.current
		if (!field || !text) return
		field.style.width =
			/^[\x20-\x7e]*$/.test(value) ? width : `${text.offsetWidth + 2}px`
		syncScroll()
	}, [value])

	return (
		// a touch on the card is usually a scroll passing through, so only a
		// mouse press, a tap on the code row or focusing the input interrupts
		// the ghost (the row lands it itself, to place the caret after)
		<div
			className="tl"
			ref={root}
			data-phase={phase}
			data-menu={
				menu && items.length ?
					menu.fromChip ?
						"chip"
					:	"typed"
				:	undefined
			}
			onPointerDown={e => {
				pointer.current = e.pointerType
				down.current = { x: e.clientX, y: e.clientY }
				if (
					e.pointerType === "mouse" &&
					!(e.target as Element).closest(".tl-code")
				)
					stopGhost()
			}}
		>
			<div className="tl-card">
				<p className="tl-cap mono">
					<span>
						<b>arktype</b> ·{" "}
						<span className="long">the real parser, running </span>live
					</span>
					<span className="tl-hint">type anything</span>
				</p>
				<div
					className="tl-code mono"
					onMouseDown={editable ? onRowMouseDown : undefined}
					onClick={editable ? onRowClick : undefined}
				>
					<span className="tl-open" aria-hidden>
						<span className="decl tl-fn">type</span>
						<span className="tl-paren">(</span>
					</span>
					<span className="tl-arg">
						<span className="tl-q" aria-hidden>
							"
						</span>
						<span
							className="tl-field"
							style={{ width }}
							data-empty={value === "" || undefined}
							data-err={status.kind === "err" || undefined}
						>
							<span className="tl-mirror" aria-hidden>
								<span className="tl-scroll" ref={scrollBox}>
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
								key={epoch}
								ref={input}
								className="tl-input"
								value={value}
								readOnly={!editable}
								aria-label="An ArkType definition, parsed as you type"
								aria-describedby={msgId}
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
								onSelect={onSelect}
								onScroll={syncScroll}
								onFocus={onFocus}
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
						id={msgId}
						data-kind={status.kind}
						data-pending={pending || undefined}
					>
						{status.kind === "ok" && <span className="tl-check">✓ </span>}
						{status.kind !== "none" && marked(status.text)}
					</p>
					<p className="sr-only" role="status">
						{spoken}
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
								e.detail === 0 || !matchMedia("(pointer: coarse)").matches,
								e.currentTarget
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
				<span className="tl-mail">// that's my email, by the way</span>
			</p>
		)
	return (
		<p className="tl-note tl-quip">
			<a href={note.item.href} target="_blank" rel="noreferrer">
				// {note.item.quip}
				<span className="tl-ext"> ↗</span>
			</a>
		</p>
	)
}
