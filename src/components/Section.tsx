import type { ReactNode } from "react"

/** Section head: a mono label (`01 // work`), the h2, then an optional deck. */
export const Section = ({
	id,
	index,
	label,
	title,
	deck,
	children,
	className = ""
}: {
	id: string
	index: string
	label: string
	title: ReactNode
	deck?: ReactNode
	children: ReactNode
	className?: string
}) => (
	<section
		id={id}
		className={`block wrap ${className}`}
		aria-labelledby={`${id}-title`}
	>
		<div className="sec-head" data-reveal>
			<span className="sec-label">
				<b>{index}</b> // {label}
			</span>
			<h2 className="h2" id={`${id}-title`}>
				{title}
			</h2>
			{deck && <div className="sec-deck">{deck}</div>}
		</div>
		{children}
	</section>
)
