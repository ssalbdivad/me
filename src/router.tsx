import { createRouter } from "@tanstack/react-router"
import { email } from "~/data/site"
import { routeTree } from "./routeTree.gen"

/**
 * If an island ever throws during render, the visitor gets the name and a
 * way to reach him, never the router's debug screen.
 */
const ErrorPage = () => (
	<main className="error-page wrap">
		<h1 className="h2">David Blass</h1>
		<p className="sec-deck">
			Something on this page broke. Reload to try again, or write to{" "}
			<a className="link" href={`mailto:${email}`}>
				{email}
			</a>
			.
		</p>
	</main>
)

export const getRouter = () => {
	// With a #hash in the URL, the router's first render (hydration) would
	// scroll to the fragment's element again, even with restoration off. The
	// browser has already done that on load, or restored the reader's own
	// place on reload/back, so turn it off for the entry we hydrate into. The
	// router reads it from history.state, so it must be set before it starts.
	if (typeof window !== "undefined" && location.hash) {
		const state = history.state ?? {}
		const key =
			state.__TSR_key ?? state.key ?? Math.random().toString(36).slice(2, 10)
		history.replaceState(
			{
				__TSR_index: 0,
				key,
				__TSR_key: key,
				...state,
				__hashScrollIntoViewOptions: false
			},
			""
		)
	}
	const router = createRouter({
		routeTree,
		// one prerendered page: the browser's own restoration (reload, back) is
		// all it needs, and the router's would own history.scrollRestoration
		scrollRestoration: false,
		defaultPreload: "intent",
		defaultErrorComponent: ErrorPage
	})
	// Even with restoration off, the router resets the window to the top when
	// it first renders, which happens at hydration: anyone who scrolled while
	// the JS loaded got yanked back up. Skip that reset for the initial render
	// only; the router sets the flag again for every navigation after it.
	router._scroll.n = false
	return router
}
