import {
	AnimatePresence,
	LazyMotion,
	m,
	MotionConfig,
	domAnimation
} from "motion/react"
import { useEffect, useRef } from "react"
import "./billy.css"

/**
 * Billy, the beanemachine mascot (after Billy Beane), from
 * ssalbdivad/beanemachine's Billy.tsx- with a plain cap: the original wears
 * the real Mets NY mark, which is trademarked.
 */
const BillyHead = () => (
	<svg className="billy-svg" viewBox="2 -8 108 82" aria-hidden>
		<defs>
			<clipPath id="billy-lenses">
				<circle cx="27" cy="45" r="9.2" />
				<circle cx="53" cy="45" r="9.2" />
			</clipPath>
		</defs>
		<rect
			x="10"
			y="20"
			width="60"
			height="51"
			rx="15"
			fill="var(--billy-face)"
			stroke="var(--billy-ink)"
			strokeWidth="3.8"
		/>
		<path
			d="M16 43 H13 l-3 4"
			fill="none"
			stroke="var(--billy-acc)"
			strokeWidth="3.4"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M64 43 H67 l3 4"
			fill="none"
			stroke="var(--billy-acc)"
			strokeWidth="3.4"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<circle
			cx="27"
			cy="45"
			r="11"
			fill="var(--billy-lens)"
			stroke="var(--billy-acc)"
			strokeWidth="3.8"
		/>
		<circle
			cx="53"
			cy="45"
			r="11"
			fill="var(--billy-lens)"
			stroke="var(--billy-acc)"
			strokeWidth="3.8"
		/>
		<path
			d="M38 44 h4"
			fill="none"
			stroke="var(--billy-acc)"
			strokeWidth="3.4"
			strokeLinecap="round"
		/>
		<circle cx="27" cy="46" r="3.8" fill="var(--billy-ink)" />
		<circle cx="53" cy="46" r="3.8" fill="var(--billy-ink)" />
		<path
			d="M22.38 39.28 a6.82 6.82 0 0 1 5.5 -3.08"
			fill="none"
			stroke="var(--billy-glint)"
			strokeWidth="2.4"
			strokeLinecap="round"
		/>
		<path
			d="M48.38 39.28 a6.82 6.82 0 0 1 5.5 -3.08"
			fill="none"
			stroke="var(--billy-glint)"
			strokeWidth="2.4"
			strokeLinecap="round"
		/>
		{/* the glint that sweeps both lenses once he's up */}
		<g clipPath="url(#billy-lenses)">
			<rect
				className="billy-sweep"
				x="-10"
				y="20"
				width="6"
				height="50"
				fill="var(--billy-glint)"
				transform="skewX(-24)"
			/>
		</g>
		<path
			d="M33 61 q7 5 14 0"
			fill="none"
			stroke="var(--billy-ink)"
			strokeWidth="3.4"
			strokeLinecap="round"
		/>
		{/* backwards cap: brim, crown, a seam and the button- no logo */}
		<path
			d="M74 31 A 16 7.5 0 0 1 106 31 Z"
			fill="var(--billy-cap)"
			stroke="var(--billy-ink)"
			strokeWidth="3.4"
			strokeLinejoin="round"
		/>
		<path
			d="M6 31 C 6 -14, 74 -14, 74 31 Z"
			fill="var(--billy-cap)"
			stroke="var(--billy-ink)"
			strokeWidth="3.4"
			strokeLinejoin="round"
		/>
		<path
			d="M40 -1.5 C 34 8, 33 20, 34 31"
			fill="none"
			stroke="var(--billy-seam)"
			strokeWidth="1.6"
			strokeLinecap="round"
		/>
		<circle
			cx="40"
			cy="-3"
			r="3.6"
			fill="var(--billy-button)"
			stroke="var(--billy-ink)"
			strokeWidth="2.2"
		/>
	</svg>
)

const stay = 6000

export const Billy = ({ up, onDone }: { up: boolean; onDone: () => void }) => {
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
	const arm = () => {
		clearTimeout(timer.current)
		timer.current = setTimeout(onDone, stay)
	}
	const hold = () => clearTimeout(timer.current)

	useEffect(() => {
		if (!up) return
		arm()
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onDone()
		}
		addEventListener("keydown", onKey)
		return () => {
			clearTimeout(timer.current)
			removeEventListener("keydown", onKey)
		}
	}, [up])

	return (
		// LazyMotion + m keeps drag and layout projection out of this chunk;
		// the page has no MotionConfig, so Billy respects reduced motion himself
		<MotionConfig reducedMotion="user">
			<LazyMotion features={domAnimation} strict>
				<AnimatePresence>
					{up && (
						<m.aside
							className="billy"
							aria-label="Billy"
							initial={{ y: "115%", opacity: 0 }}
							animate={{ y: "0%", opacity: 1 }}
							exit={{
								y: "115%",
								opacity: 0,
								transition: { duration: 0.34, ease: [0.55, 0, 0.2, 1] }
							}}
							transition={{
								y: { type: "spring", stiffness: 220, damping: 14 },
								opacity: { duration: 0.16 }
							}}
							onPointerEnter={hold}
							onPointerLeave={arm}
							onFocus={hold}
							onBlur={arm}
						>
							<m.p
								className="billy-bubble"
								role="status"
								initial={{ opacity: 0, scale: 0.6, y: 10 }}
								animate={{ opacity: 1, scale: 1, y: 0 }}
								exit={{ opacity: 0, transition: { duration: 0.1 } }}
								transition={{
									delay: 0.32,
									type: "spring",
									stiffness: 380,
									damping: 24
								}}
							>
								How can you not be robotic about baseball?
								<a className="billy-link" href="https://beanemachine.com">
									beanemachine.com ↗
								</a>
							</m.p>
							<button
								type="button"
								className="billy-head"
								onClick={onDone}
								aria-label="Send Billy back down"
							>
								<BillyHead />
							</button>
						</m.aside>
					)}
				</AnimatePresence>
			</LazyMotion>
		</MotionConfig>
	)
}
