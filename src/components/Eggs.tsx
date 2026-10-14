import {
	Component,
	lazy,
	Suspense,
	useEffect,
	useState,
	type ReactNode
} from "react"

/** Easter eggs mounted once per page (Billy, the console note). */

const Billy = lazy(() =>
	import("./eggs/Billy").then(m => ({ default: m.Billy }))
)

/**
 * Billy is an egg: if his chunk can't load (a deploy renamed it under an open
 * tab), he just doesn't show up. Without a boundary the rejection unmounts
 * the whole page.
 */
class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
	override state = { failed: false }
	static getDerivedStateFromError() {
		return { failed: true }
	}
	override render() {
		return this.state.failed ? null : this.props.children
	}
}

const konami = [
	"ArrowUp",
	"ArrowUp",
	"ArrowDown",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"ArrowLeft",
	"ArrowRight",
	"b",
	"a"
]

const typing = (target: EventTarget | null) =>
	target instanceof HTMLElement &&
	(target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

let logged = false

// ArkDark, in the console
const ink = "color:#eeeeee;font:500 13px/1.7 ui-monospace,Menlo,monospace"
const quote = "color:#f5cf8f;font:600 14px/1.7 ui-monospace,Menlo,monospace"
const dim = "color:#888899;font:400 12px/1.7 ui-monospace,Menlo,monospace"
const sky = "color:#80cff8;font:400 12px/1.7 ui-monospace,Menlo,monospace"

const consoleNote = () => {
	if (logged) return
	logged = true
	console.log(
		"%cunbiased typescript perf expert here👋\nthis claim from @arktypeio is 100% accurate.\n%c  — @ssalbdivad, https://x.com/ssalbdivad/status/1940805326879756526\n\n%c⛵ type %cbilly%c anywhere · %c/resume.md%c · %c/llms.txt%c for your agent",
		quote,
		dim,
		ink,
		sky,
		ink,
		sky,
		ink,
		sky,
		ink
	)
}

export const Eggs = () => {
	const [billy, setBilly] = useState<"never" | "up" | "down">("never")

	useEffect(() => {
		consoleNote()
		let keys: string[] = []
		const onKey = (e: KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return
			keys = [...keys, e.key.length === 1 ? e.key.toLowerCase() : e.key].slice(
				-konami.length
			)
			const word = keys.slice(-5).join("")
			if (word === "billy" || keys.join() === konami.join()) {
				keys = []
				setBilly("up")
			}
		}
		addEventListener("keydown", onKey)
		return () => removeEventListener("keydown", onKey)
	}, [])

	if (billy === "never") return null
	return (
		<Quiet>
			<Suspense>
				<Billy up={billy === "up"} onDone={() => setBilly("down")} />
			</Suspense>
		</Quiet>
	)
}
