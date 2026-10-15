import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts
} from "@tanstack/react-router"
import type { ReactNode } from "react"
import { NotFoundRoot } from "~/components/eggs/NotFound"
import { useShellEffects } from "~/lib/reveal"
import atkinson from "@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2?url"
import css from "../styles.css?url"

const title = "David Blass · ArkType, Standard Schema, Pullfrog"
// ≤160 chars, so search results don't cut it mid-name
const description =
	"I make TypeScript's types do things they probably shouldn't- then make them fast. ArkType author, Standard Schema co-creator, Pullfrog co-founder."
const origin = "https://ssalbdivad.com"
const imageAlt = "David Blass: ArkType, Standard Schema, Pullfrog"

// before first paint: mark JS present (html.js gates the JS-only controls
// and the paused boat), then ArkDark unless the visitor picked ArkLight. The
// theme-color meta precedes this script in <head>, so it can be updated too.
//
// First, though: GitHub Pages also serves /index.html and /resume/index.html
// (200, same file), and the router would match neither and hydrate the 404
// over the page. Drop the file name before the router reads the URL, keeping
// the query and hash. (/resume/, as Pages redirects /resume, matches as is.)
const themeScript = `if(/\\/index\\.html$/.test(location.pathname))history.replaceState(history.state,"",location.pathname.slice(0,-10)+location.search+location.hash);document.documentElement.classList.add("js");try{var t=localStorage.getItem("theme");if(t==="light"){document.documentElement.dataset.theme="light";var m=document.querySelector('meta[name=theme-color]');m&&m.setAttribute("content","#f9f5d7")}}catch(e){}`

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover"
			},
			{ title },
			{ name: "description", content: description },
			{ name: "author", content: "David Blass" },
			{ name: "theme-color", content: "#080d17" },
			{ property: "og:type", content: "website" },
			{ property: "og:url", content: origin },
			{ property: "og:title", content: title },
			{ property: "og:description", content: description },
			{ property: "og:image", content: `${origin}/og.png` },
			{ property: "og:image:width", content: "1200" },
			{ property: "og:image:height", content: "630" },
			{ property: "og:image:alt", content: imageAlt },
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:image:alt", content: imageAlt },
			{ name: "twitter:creator", content: "@ssalbdivad" }
		],
		links: [
			{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
			{
				rel: "preload",
				href: atkinson,
				as: "font",
				type: "font/woff2",
				crossOrigin: "anonymous"
			},
			{ rel: "stylesheet", href: css }
		],
		scripts: [{ children: themeScript }]
	}),
	component: () => (
		<Document>
			<Outlet />
		</Document>
	),
	// the same tree (and useId sequence) as the prerendered /404 route, so
	// 404.html hydrates cleanly at whatever unknown URL served it
	notFoundComponent: NotFoundRoot
})

const Document = ({ children }: { children: ReactNode }) => {
	useShellEffects()
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	)
}
