import { useRef, useState } from "react"
import { Section } from "./Section"

const effectId = "AaUKLH8N6go"

/**
 * Effect Days: a self-hosted poster that swaps in the YouTube player on click
 * (nothing loads from YouTube until then). Without JS it's a plain link.
 */
const EffectDays = () => {
	const [playing, setPlaying] = useState(false)
	const [loaded, setLoaded] = useState(false)
	const frame = useRef<HTMLIFrameElement>(null)
	return (
		<div className="talk-media">
			<a
				className="talk-poster"
				href={`https://www.youtube.com/watch?v=${effectId}`}
				aria-label="Play Discriminated Unions in TypeScript, Effect, and ArkType, 13:13"
				onClick={e => {
					if (e.metaKey || e.ctrlKey || e.shiftKey) return
					e.preventDefault()
					setPlaying(true)
				}}
				tabIndex={loaded ? -1 : undefined}
				aria-hidden={loaded || undefined}
			>
				<img
					src="/talks/effect-days-2024.webp"
					alt=""
					width={1280}
					height={720}
					loading="lazy"
					decoding="async"
				/>
				<span className="talk-play" aria-hidden="true">
					<svg viewBox="0 0 24 24">
						<path d="M8 5.5v13l10.5-6.5z" />
					</svg>
				</span>
				<span className="talk-len mono">13:13</span>
			</a>
			{playing && (
				<iframe
					ref={frame}
					className="talk-frame"
					data-loaded={loaded}
					src={`https://www.youtube-nocookie.com/embed/${effectId}?autoplay=1`}
					title="Discriminated Unions in TypeScript, Effect, and ArkType · David Blass · Effect Days 2024"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
					referrerPolicy="strict-origin-when-cross-origin"
					allowFullScreen
					onLoad={() => {
						setLoaded(true)
						// keyboard users land in the player, not on the poster it replaced
						frame.current?.focus()
					}}
				/>
			)}
		</div>
	)
}

// GitNation's Vimeo player is domain-whitelisted, so this one links out
const TsCongress = () => (
	<div className="talk-media">
		<a
			className="talk-poster"
			href="https://gitnation.com/contents/arktype-bringing-typescript-to-runtime"
			target="_blank"
			rel="noreferrer"
			aria-label="Watch on GitNation, 21:10: ArkType: Bringing TypeScript to Runtime"
		>
			<img
				src="/talks/ts-congress-2023.webp"
				alt=""
				width={1280}
				height={720}
				loading="lazy"
				decoding="async"
			/>
			<span className="talk-out" aria-hidden="true">
				<span className="ext">Watch on GitNation</span>
			</span>{" "}
			<span className="talk-len mono">21:10</span>
		</a>
	</div>
)

/** an external link whose ↗ can't wrap onto a line by itself */
const Ext = ({ children }: { children: string }) => {
	const cut = children.lastIndexOf(" ")
	return (
		// one wrapper span, so a flex parent can't trim the space before the last word
		<span>
			{children.slice(0, cut + 1)}
			<span className="ext nowrap">{children.slice(cut + 1)}</span>
		</span>
	)
}

const mic = [
	{
		show: "devtools.fm #132",
		length: "56:40",
		chapter: "“Optimizing TypeScript Performance” @ 08:35",
		href: "https://www.youtube.com/watch?v=JxAaWsAAQxM&t=515s"
	},
	{
		show: "TypeScript.fm 35B",
		length: "1:09:53",
		chapter: "“Generating JIT-optimized Code” @ 21:05",
		href: "https://www.youtube.com/watch?v=z4Jv7QPh8qE&t=1265s"
	},
	{
		show: "The Angular+ Show S10E4",
		length: "1:11:08",
		chapter: "AI in dev tools, Standard Schema",
		href: "https://www.spreaker.com/episode/s10-e4-validation-via-arktype-david-blass--67877792"
	}
]

// after the ArkType lists; the unattributed row is David's
const standardSchema = [
	{
		show: "TypeScript.fm 35B",
		length: "1:09:53",
		chapter: "“Compatibility with Standard Schema Spec” @ 51:55",
		href: "https://www.youtube.com/watch?v=z4Jv7QPh8qE&t=3115s"
	},
	{
		show: "Syntax #873",
		length: "13:30",
		chapter:
			"Wes Bos & Scott Tolinski: “The Universal JavaScript Data Interface”",
		href: "https://www.youtube.com/watch?v=P_etHPMftyY"
	}
]

type Episode = (typeof mic)[number]

const Episodes = ({ items }: { items: Episode[] }) => (
	<ul className="mic-list">
		{items.map(m => (
			<li key={m.show}>
				<a href={m.href} target="_blank" rel="noreferrer">
					<span className="mic-show">{m.show}</span>
					<span className="mic-len tnum">{m.length}</span>
					<span className="mic-ch">
						<Ext>{m.chapter}</Ext>
					</span>
				</a>
			</li>
		))}
	</ul>
)

const about = [
	{
		text: "Theo: “(Actually) Benchmarking TypeScript”",
		href: "https://www.youtube.com/watch?v=AEA0K77qhS4"
	},
	{
		text: "Matt Pocock: “Everyone’s talking about ArkType”",
		href: "https://www.youtube.com/watch?v=-_0wMxtRVqA"
	}
]

export const Talks = () => (
	<Section id="talks" index="04" label="talks" title="Talks">
		<div className="talks" data-reveal="stagger">
			<article className="talk">
				<EffectDays />
				<h3 className="talk-title">
					Discriminated Unions in TypeScript, Effect, and ArkType
				</h3>
				<p className="talk-meta mono">Effect Days 2024 · Vienna</p>
				<p className="talk-cap">
					<a
						className="link-quiet"
						href="https://x.com/ssalbdivad/status/1802752982401904775"
					>
						"You probably have some idea of how assignability works in
						TypeScript… But can you explain it cohesively? This is your chance
						to learn how in 10 minutes⚡"
					</a>
				</p>
			</article>
			<article className="talk">
				<TsCongress />
				<h3 className="talk-title">ArkType: Bringing TypeScript to Runtime</h3>
				<p className="talk-meta mono">TypeScript Congress 2023</p>
				<p className="talk-cap">
					How the type-level parser works, top-down to shift-reduce, and what
					abusing the type system buys you at runtime.
				</p>
			</article>
		</div>

		<div className="mic">
			<h3 className="mic-label mono">
				<span aria-hidden="true">// </span>on mic
			</h3>
			<Episodes items={mic} />
			<h3 className="mic-label mono about-label">
				<span aria-hidden="true">// </span>about it
			</h3>
			<ul className="about">
				{about.map(a => (
					<li key={a.href}>
						<a href={a.href} target="_blank" rel="noreferrer">
							<Ext>{a.text}</Ext>
						</a>
					</li>
				))}
			</ul>
			<h3 className="mic-label mono about-label">
				<span aria-hidden="true">// </span>standard schema
			</h3>
			<Episodes items={standardSchema} />
		</div>
	</Section>
)
