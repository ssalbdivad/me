import lovesQueries from "~/data/snippets/loves.queries.json"
import { Quickinfo } from "./Quickinfo"
import { Section } from "./Section"

// Eggs.tsx listens for this
const summonBilly = () => window.dispatchEvent(new Event("billy:summon"))

/** where the union started, before the work moved upstairs */
const bio = "https://gitnation.com/person/david_blass"

// parsers and types live in the sections above; this one is everything else
const loves: { value: string; href?: string; clip?: string }[] = [
	{ value: "the Mets" },
	// Faker's front roll onto the Worlds 2015 finals stage
	{ value: "T1", clip: "/clips/faker-roll.mp4" },
	{ value: "birds" },
	{ value: "my dog, cat and tortoise" },
	{ value: "bow ties" },
	{ value: "my wife's vegan cooking" }
]

/**
 * The 2023 GitNation speaker bio, as a union, minus the parts that are
 * inside the type system. It goes on one line where all
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
					Adapted from "Predictably, David loves parsers and types, but also bow
					ties and his wife's vegan cooking." —{" "}
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
			{loves.map(({ value, href, clip }) => (
				<span key={value} className="m">
					{" "}
					<span className="k bar" aria-hidden>
						|
					</span>{" "}
					{href ?
						<a className="v" href={href}>
							"{value}"
						</a>
					: clip ?
						<Quickinfo trigger={<span className="v">"{value}"</span>}>
							<video
								className="loves-clip"
								src={clip}
								autoPlay
								muted
								loop
								playsInline
								preload="none"
								aria-label={`${value}: Faker front-rolls onto the Worlds 2015 finals stage`}
							/>
						</Quickinfo>
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
				Diehard Mets fan living in Boston, married to the greatest human on
				earth. On the side I built{" "}
				<a className="link ext nowrap" href="https://beanemachine.com">
					beanemachine
				</a>
				, which tells me who to start tonight in fantasy baseball.{" "}
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
				I'm also an amateur bird watcher, which lately means building{" "}
				<a
					className="link ext nowrap"
					href="https://github.com/ssalbdivad/look4"
				>
					look4
				</a>{" "}
				to do the watching for me: it goes through my backyard camera's footage
				looking for birds I haven't seen yet.
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
