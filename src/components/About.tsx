import lovesQueries from "~/data/snippets/loves.queries.json"
import { Quickinfo } from "./Quickinfo"
import { Section } from "./Section"

// Eggs.tsx listens for this
const summonBilly = () => window.dispatchEvent(new Event("billy:summon"))

/** where the union comes from, word for word */
const bio = "https://gitnation.com/person/david_blass"

// "the Mets" stays plain: the paragraph under it has Billy's button
const loves = [
	{ value: "parsers", href: "#arktype" },
	{ value: "types", href: "#arkschema" },
	{ value: "the Mets" },
	{ value: "bow ties" },
	{ value: "my wife's vegan cooking" }
]

/**
 * The 2023 GitNation speaker bio, as a union. It goes on one line where all
 * of it fits; anywhere narrower it wraps the way prettier would, one member
 * a line (talks.css). The tokens are hand-set in the handle doc's colors;
 * the hover on `loves` is real twoslash.
 */
const Loves = () => (
	<p className="loves" data-reveal>
		<code className="loves-code">
			<span className="k">type</span>{" "}
			<Quickinfo trigger={<span className="n">loves</span>}>
				<span className="qi-body code loves-qi">
					<span dangerouslySetInnerHTML={{ __html: lovesQueries[0] ?? "" }} />
				</span>
				<span className="qi-doc">
					"Predictably, David loves parsers and types, but also bow ties and his
					wife's vegan cooking." —{" "}
					<a href={bio} className="ext">
						my speaker bio, 2023
					</a>
				</span>
				<span className="qi-foot">
					<span>computed by the compiler at build</span>
					<span>
						<i>TS 6.0.3</i>
					</span>
				</span>
			</Quickinfo>{" "}
			<span className="k eq">=</span>
			{loves.map(({ value, href }) => (
				<span key={value} className="m">
					{" "}
					<span className="k bar" aria-hidden>
						|
					</span>{" "}
					{href ?
						<a className="v" href={href}>
							"{value}"
						</a>
					:	<span className="v">"{value}"</span>}
				</span>
			))}
		</code>
	</p>
)

export const About = () => (
	<Section id="about" index="05" label="about" title="Outside the type system">
		<Loves />
		<div className="ab-copy" data-reveal>
			<p>
				I live in Boston, and I'm a Mets fan anyway. On the side I built{" "}
				<a className="link ext nowrap" href="https://beanemachine.com">
					beanemachine
				</a>
				, which tells me who to start tonight in fantasy baseball. It's named
				for Billy Beane, and so is its robot mascot, Billy. Its motto: "How can
				you not be robotic about baseball?"{" "}
				{/* hidden without JS: the egg it summons needs it */}
				<button
					type="button"
					className="ab-summon mono js-only"
					onClick={summonBilly}
				>
					<span aria-hidden="true">[</span>
					<span className="ab-summon-t">summon Billy</span>
					<span aria-hidden="true">]</span>
				</button>
			</p>
			<p>
				I'm also an amateur bird watcher. Lately I've been building{" "}
				<a
					className="link ext nowrap"
					href="https://github.com/ssalbdivad/look4"
				>
					look4
				</a>
				, which goes through my backyard camera's footage looking for birds I
				haven't seen yet.
			</p>
			<p>
				When quarantine gave me the chance to spend a day arranging a jazz
				adaptation of my favorite Hamilton song,{" "}
				<a
					className="link ext"
					href="https://www.youtube.com/watch?v=6KKGojDM1Xo"
				>
					I did not throw away my shot
				</a>
				.
			</p>
		</div>
	</Section>
)
