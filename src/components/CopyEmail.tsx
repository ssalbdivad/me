import { useEffect, useRef, useState } from "react"
import { email } from "~/data/site"

type State = "idle" | "copied" | "failed"

/** what to do with the selected address, for whoever is holding the device */
const manualCopy = () =>
	matchMedia("(pointer: coarse)").matches ? "touch and hold it to copy"
	: /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "press ⌘C"
	: "press Ctrl+C"

/**
 * The one way the site hands out the address: copied, never a link that
 * opens a mail client. A gold button copies it and reads "copied ✓" for
 * 1.6s; both labels share one grid cell, so the swap can't resize the button.
 * Where the clipboard is refused (an insecure origin, a denied permission),
 * a bubble under the button holds the address, selected, for a manual copy.
 * Without JS there's no button at all: the address is plain, selectable text
 * in its place.
 */
export const CopyEmail = ({
	label,
	small = false
}: {
	/** the button's words; by default it's the address and a copy icon */
	label?: string
	small?: boolean
}) => {
	const [state, setState] = useState<State>("idle")
	const [hint, setHint] = useState("")
	const [message, setMessage] = useState("")
	const button = useRef<HTMLButtonElement>(null)
	const field = useRef<HTMLInputElement>(null)
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
	useEffect(() => () => clearTimeout(timer.current), [])
	useEffect(() => {
		if (state !== "failed") return
		field.current?.focus()
		field.current?.select()
	}, [state])

	const confirm = () => {
		setState("copied")
		setMessage(`Copied ${email}`)
		// each copy restarts the 1.6s, so a second one isn't cut short
		clearTimeout(timer.current)
		timer.current = setTimeout(() => {
			setState("idle")
			setMessage("")
		}, 1600)
	}

	const copy = async () => {
		try {
			// navigator.clipboard is undefined on an insecure origin; the
			// catch takes that and a rejected write alike
			await navigator.clipboard.writeText(email)
			confirm()
		} catch {
			clearTimeout(timer.current)
			const how = manualCopy()
			setHint(how)
			setState("failed")
			setMessage(
				`Couldn't copy automatically. The address is selected: ${how}.`
			)
		}
	}

	const close = () => {
		setState(s => (s === "failed" ? "idle" : s))
		setMessage("")
	}

	return (
		<span className="ce">
			<button
				type="button"
				ref={button}
				className={`btn btn-gold${small ? " btn-sm" : ""} ce-btn js-only`}
				data-state={state}
				onClick={copy}
			>
				{/* the address face sets "copied" in its Cascadia too */}
				<span className={label ? "ce-face" : "ce-face ce-addr"}>
					{label ?
						<span className="ce-idle">{label}</span>
					:	<span className="ce-idle">
							<span className="sr-only">Copy </span>
							<span className="ce-at">{email}</span>
							<CopyIcon />
						</span>
					}
					<span className="ce-done" aria-hidden>
						copied <CheckIcon />
					</span>
				</span>
			</button>
			<span className="ce-text mono">{email}</span>
			{state === "failed" && (
				<span
					className="ce-pop"
					// a click inside the bubble keeps focus on the field, so it stays open
					onMouseDown={e => {
						if (e.target !== field.current) e.preventDefault()
					}}
				>
					<input
						ref={field}
						className="mono"
						readOnly
						value={email}
						size={email.length}
						aria-label="Email address"
						onBlur={close}
						onKeyDown={e => {
							if (e.key !== "Escape") return
							button.current?.focus()
						}}
						onCopy={e => {
							// the whole address, whatever's left of the selection
							e.preventDefault()
							e.clipboardData.setData("text/plain", email)
							button.current?.focus()
							confirm()
						}}
					/>
					<span className="ce-hint">
						Couldn't copy automatically. It's selected: {hint}.
					</span>
				</span>
			)}
			<span role="status" className="sr-only">
				{message}
			</span>
		</span>
	)
}

const CopyIcon = () => (
	<svg viewBox="0 0 16 16" fill="none" aria-hidden>
		<rect
			x="5.25"
			y="5.25"
			width="8.75"
			height="8.75"
			rx="2"
			stroke="currentColor"
			strokeWidth="1.6"
		/>
		<path
			d="M10.75 2.75A1.5 1.5 0 0 0 9.25 1.75H3.5A1.75 1.75 0 0 0 1.75 3.5v5.75a1.5 1.5 0 0 0 1 1.41"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
		/>
	</svg>
)

const CheckIcon = () => (
	<svg viewBox="0 0 16 16" fill="none" aria-hidden>
		<path
			d="M3 8.5l3.25 3.25L13 4.75"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
)
