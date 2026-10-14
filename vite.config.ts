import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		tailwindcss(),
		tanstackStart({
			prerender: {
				enabled: true,
				crawlLinks: true,
				failOnError: true,
				// TanStack/router#7837: the crawler corrupts query strings, and
				// fragment links are the same page anyway. Links to files in
				// public/ (/llms.txt, /resume.md) are already files, not pages.
				filter: ({ path }) => !/[?#]/.test(path) && !/\.\w+$/.test(path)
			},
			pages: [
				{ path: "/" },
				// public/resume.md for people (the .md itself stays for agents)
				{ path: "/resume" },
				// static hosts serve /404.html for any unknown path; the root
				// route's notFoundComponent hydrates it at whatever URL that was
				{ path: "/404", prerender: { enabled: true, outputPath: "/404.html" } }
			]
		}),
		// must come after tanstackStart
		react({ compiler: true })
	]
})
