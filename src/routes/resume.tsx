import { createFileRoute } from "@tanstack/react-router"
import { ResumePage } from "~/components/eggs/Resume"

// public/resume.md, rendered for people; the raw file stays at /resume.md for agents
export const Route = createFileRoute("/resume")({
	head: () => ({
		meta: [
			{ title: "Résumé · David Blass" },
			{
				name: "description",
				content:
					"David Blass's résumé: ArkType, Standard Schema, Pullfrog, TypeScript performance. Every number links to its source."
			},
			{ property: "og:url", content: "https://ssalbdivad.com/resume" },
			{ property: "og:title", content: "Résumé · David Blass" }
		],
		links: [{ rel: "canonical", href: "https://ssalbdivad.com/resume" }]
	}),
	component: ResumePage
})
