import { Section } from "./Section"

const rows = [
	{
		when: "2019–21",
		what: "Redo",
		text: "Founded it. We built a desktop app that turned recorded user interactions into UI tests. ArkType's git history still starts in Redo's repo, June 2019."
	},
	{
		when: "2017–19",
		what: "Amazon",
		text: "SDET II, Alexa Devices. Built PyEcho, Amazon's standard test-automation framework for Alexa devices."
	},
	{
		when: "2011–15",
		what: "Tufts",
		text: "Computer Science, Entrepreneurial Leadership, Philosophy."
	}
]

export const Before = () => (
	<Section id="before" index="06" label="before" title="Before all this">
		<ol className="bf-list" data-reveal="stagger">
			{rows.map(r => (
				<li key={r.what}>
					<span className="bf-when mono tnum">{r.when}</span>
					<b className="bf-what">{r.what}</b>
					<p>{r.text}</p>
				</li>
			))}
		</ol>
	</Section>
)
