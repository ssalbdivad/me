import { createFileRoute } from "@tanstack/react-router"
import { About } from "~/components/About"
import { Agents } from "~/components/Agents"
import { Eggs } from "~/components/Eggs"
import { Contact, Footer } from "~/components/Footer"
import { Hero } from "~/components/Hero"
import { Nav } from "~/components/Nav"
import { Perf } from "~/components/Perf"
import { Talks } from "~/components/Talks"
import { Work } from "~/components/Work"
import { useReveals } from "~/lib/reveal"

// canonical per route: the root's head is shared by /resume and the 404.
// The cursive italic preloads here only: the hero lede sets "types" and
// "agents" in it, and /resume never uses it.
export const Route = createFileRoute("/")({
	head: () => ({
		links: [
			{ rel: "canonical", href: "https://ssalbdivad.com/" },
			{
				rel: "preload",
				href: "/fonts/cascadia-code-italic.woff2",
				as: "font",
				type: "font/woff2",
				crossOrigin: "anonymous"
			}
		]
	}),
	component: Home
})

function Home() {
	useReveals()
	return (
		<>
			<a className="skip sr-only" href="#main">
				Skip to content
			</a>
			<Nav />
			<main id="main">
				<Hero />
				<Work />
				<Perf />
				<Agents />
				<Talks />
				<About />
				<Contact />
			</main>
			<Footer />
			<Eggs />
		</>
	)
}
