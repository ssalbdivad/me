import { useEffect, useState } from "react"
import { email } from "~/data/site"

const links = [
	{ id: "work", label: "Work" },
	{ id: "perf", label: "Perf" },
	{ id: "agents", label: "Agents" },
	{ id: "talks", label: "Talks" }
] as const

export const Nav = () => {
	const [active, setActive] = useState<string>()

	useEffect(() => {
		const sections = links
			.map(l => document.getElementById(l.id))
			.filter((el): el is HTMLElement => !!el)
		const visible = new Map<string, number>()
		const observer = new IntersectionObserver(
			entries => {
				for (const entry of entries)
					visible.set(
						entry.target.id,
						entry.isIntersecting ? entry.intersectionRatio : 0
					)
				const top = [...visible]
					.filter(([, r]) => r > 0)
					.sort((a, b) => b[1] - a[1])[0]
				setActive(top?.[0])
			},
			{ rootMargin: "-30% 0px -50% 0px", threshold: [0, 0.25, 0.5, 1] }
		)
		for (const section of sections) observer.observe(section)
		return () => observer.disconnect()
	}, [])

	return (
		<nav className="nav wrap" aria-label="Primary">
			<a className="brand" href="#top">
				David Blass
			</a>
			<div className="navlinks">
				{links.map(l => (
					<a
						key={l.id}
						href={`#${l.id}`}
						aria-current={active === l.id || undefined}
					>
						{l.label}
					</a>
				))}
				<a className="btn btn-gold btn-sm" href={`mailto:${email}`}>
					Email me
				</a>
			</div>
		</nav>
	)
}
