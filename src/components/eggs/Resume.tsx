import { Fragment, type ReactNode } from "react"
import md from "../../../public/resume.md?raw"
import { Eggs } from "../Eggs"
import { Footer } from "../Footer"
import { CopyEmail } from "../CopyEmail"
import css from "./resume.css?url"

/**
 * /resume: public/resume.md for people. The .md stays the source of truth
 * (agents read it raw), and this renders the subset it uses- #/##/###
 * headings, "- " lists, paragraphs, **bold**, `code` and [text](url)- as
 * React elements, so nothing in the file is ever injected as HTML.
 */

const inlinePattern = /(\*\*.+?\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/

const inline = (text: string): ReactNode[] =>
	text
		.split(inlinePattern)
		.filter(Boolean)
		.map((part, i) => {
			if (part.startsWith("**") && part.endsWith("**"))
				return <strong key={i}>{inline(part.slice(2, -2))}</strong>
			if (part.startsWith("`") && part.endsWith("`"))
				return <code key={i}>{part.slice(1, -1)}</code>
			const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part)
			if (link) {
				const [, label, href] = link
				const external = /^https?:/.test(href!)
				return (
					<a
						key={i}
						className="link"
						href={href}
						{...(external && { rel: "noopener" })}
					>
						{inline(label!)}
					</a>
				)
			}
			return part
		})

/** "Author, ArkType ecosystem · 2022–present" => the role, then its dates */
const roleHeading = (text: string, key: number) => {
	const at = text.lastIndexOf(" · ")
	if (at === -1) return <h3 key={key}>{inline(text)}</h3>
	return (
		<h3 key={key}>
			<span>{inline(text.slice(0, at))}</span>
			<span className="rs-when mono">{text.slice(at + 3)}</span>
		</h3>
	)
}

const render = (source: string) => {
	const out: ReactNode[] = []
	const blocks = source.trim().split(/\n\s*\n/)
	blocks.forEach((block, b) => {
		const lines = block.split("\n")
		const first = lines[0]!
		if (first.startsWith("# "))
			out.push(<h1 key={b}>{inline(first.slice(2))}</h1>)
		else if (first.startsWith("## "))
			out.push(<h2 key={b}>{inline(first.slice(3))}</h2>)
		else if (first.startsWith("### ")) out.push(roleHeading(first.slice(4), b))
		else if (lines.every(l => l.startsWith("- ")))
			out.push(
				<ul key={b}>
					{lines.map((l, i) => (
						<li key={i}>{inline(l.slice(2))}</li>
					))}
				</ul>
			)
		else if (b === 1)
			// the contact block: wrap only between items, never inside one
			out.push(
				<p key={b} className="rs-contact">
					{lines.map((l, i) => (
						<span key={i} className="rs-line">
							{l.split(" · ").map((item, j, items) => (
								<Fragment key={j}>
									{j > 0 && " "}
									<span className="rs-item">
										{inline(item)}
										{j < items.length - 1 && " ·"}
									</span>
								</Fragment>
							))}
						</span>
					))}
				</p>
			)
		else
			out.push(
				<p key={b}>
					{lines.map((l, i) => (
						<span key={i} className="rs-line">
							{inline(l)}
						</span>
					))}
				</p>
			)
	})
	return out
}

// rendered once per module: the file is static
const body = render(md)

const printPage = () => print()

export const ResumePage = () => (
	<>
		<link rel="stylesheet" href={css} precedence="eggs" />
		<nav className="nav wrap" aria-label="Primary">
			<a className="brand" href="/">
				David Blass
			</a>
			<div className="navlinks">
				<CopyEmail label="Copy email" small />
			</div>
		</nav>
		<main className="rs wrap" id="main">
			<p className="rs-tools mono">
				<a className="link" href="/">
					← home ⛵
				</a>
				<span className="rs-sep" aria-hidden>
					·
				</span>
				<a className="link" href="/resume.md">
					/resume.md
				</a>{" "}
				<span className="rs-note">(for agents)</span>
				<button
					type="button"
					className="btn btn-ghost btn-sm rs-print js-only"
					onClick={printPage}
				>
					Print / PDF
				</button>
			</p>
			<article className="rs-doc">{body}</article>
		</main>
		<Footer numbers={false} />
		<Eggs />
	</>
)
