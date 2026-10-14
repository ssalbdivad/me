import type { ReactNode } from "react"
import { Section } from "./Section"

type Quote = { text: string; who: ReactNode; href: string; source: string }

// verbatim, each linked to where it was said (research-voice §3, research-media #6)
const quotes: Quote[] = [
	{
		text: "…knowing WHO implemented it, I have 100% trust that this just works as expected…",
		who: "AndrewGreenh, r/typescript, on ArkRegex (quoted by InfoQ)",
		href: "https://www.reddit.com/r/typescript/comments/1oidtxg/introducing_arkregex_a_dropin_replacement_for_new/nlwcnam/",
		source: "Reddit"
	},
	{
		text: "@ssalbdivad.dev you're amazing 🤩. Obviously WTF!? but in a good way 🤪",
		who: "Dominik (TkDodo), TanStack Query",
		href: "https://bsky.app/profile/tkdodo.eu/post/3m4bmfd3hhc2u",
		source: "Bluesky"
	},
	{
		text: "wtf this is insane",
		who: "Aiden Bai, React Scan, on ArkRegex",
		href: "https://x.com/aidenybai/status/1983212326464397535",
		source: "X"
	},
	{
		text: "ArkType's been up to some cool stuff for awhile, but attest takes it to a whole new level.",
		who: "Theo, “(Actually) Benchmarking TypeScript”",
		href: "https://www.youtube.com/watch?v=AEA0K77qhS4",
		source: "YouTube"
	}
]

const Literal = ({ children }: { children: ReactNode }) => (
	<>
		<span className="q-mark" aria-hidden="true">
			"
		</span>
		{children}
		<span className="q-mark" aria-hidden="true">
			"
		</span>
	</>
)

export const Said = () => (
	<Section id="said" index="05" label="said" title="Said in public">
		<ul className="said" data-reveal="stagger">
			{quotes.map(q => (
				<li key={q.href}>
					<figure className="quote">
						<blockquote cite={q.href}>
							<p>
								<Literal>{q.text}</Literal>
							</p>
						</blockquote>
						<figcaption className="mono">
							<span className="dash">—</span> {q.who} ·{" "}
							<a className="ext" href={q.href} target="_blank" rel="noreferrer">
								{q.source}
							</a>
						</figcaption>
					</figure>
				</li>
			))}
			{/* the last word goes to an unbiased source */}
			<li className="said-self">
				<figure className="quote quote-self">
					<blockquote cite="https://x.com/ssalbdivad/status/1940805326879756526">
						<p>
							<Literal>
								unbiased typescript perf expert here👋
								<br />
								this claim from @arktypeio is 100% accurate.
							</Literal>
						</p>
					</blockquote>
					<figcaption className="mono">
						<span className="dash">—</span>{" "}
						<a
							className="ext"
							href="https://x.com/ssalbdivad/status/1940805326879756526"
							target="_blank"
							rel="noreferrer"
						>
							David Blass (unbiased)
						</a>
					</figcaption>
				</figure>
			</li>
		</ul>
	</Section>
)
