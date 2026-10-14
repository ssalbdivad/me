/**
 * Renders src/snippets/*.ts to highlighted HTML with real TypeScript hovers
 * (twoslash), using ArkDark/ArkLight and ArkType's own grammar- the same theme
 * and in-string definition highlighting David's editor uses.
 *
 * Output: src/data/snippets/<name>.html, imported with `?raw`, plus
 * <name>.queries.json: the highlighted result of each `^?` query, for
 * components that show a query's answer outside the code block.
 *
 * A snippet may start with a directive line that is stripped before checking:
 *   //! hover: groups version
 * Only hovers on those identifiers are kept (queries and errors always are).
 * Without it, only hovers on declarations (`const`, `type`, `function`) are.
 *
 * The theme and grammar are copied from arktypeio/arktype (MIT) at df3bf9693:
 * ark/themes/{arkdark,arklight}.json, ark/extension/tsWithArkType.tmLanguage.json
 *
 * Run: node scripts/snippets.ts [name...]
 */
import { rendererRich, transformerTwoslash } from "@shikijs/twoslash"
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename } from "node:path"
import { createHighlighter, type ThemeRegistration } from "shiki"

const read = (path: string) =>
	JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"))

const loadTheme = (path: string, brace: string): ThemeRegistration => {
	const theme: ThemeRegistration = read(path)
	// VS Code colors braces with editorBracketHighlight, which Shiki doesn't read
	theme.tokenColors?.push({
		scope: ["meta.brace"],
		settings: { foreground: brace }
	})
	theme.colors = { ...theme.colors, "editor.background": "#00000000" }
	return theme
}

const arkDark = loadTheme("./shiki/arkdark.json", "#f5cf8f")
const arkLight = loadTheme("./shiki/arklight.json", "#844c13")
const arkTypeScript = {
	...read("./shiki/tsWithArkType.tmLanguage.json"),
	name: "ts"
}

const snippetDir = new URL("../src/snippets/", import.meta.url)
const outDir = new URL("../src/data/snippets/", import.meta.url)
mkdirSync(outDir, { recursive: true })

const highlighter = await createHighlighter({
	themes: [arkDark, arkLight],
	langs: [arkTypeScript]
})

const directive = /^\/\/! hover: (.*)\n/

const render = (name: string, source: string) => {
	const keep = directive.exec(source)?.[1]?.split(/\s+/).filter(Boolean)
	const code = source.replace(directive, "").trimEnd()
	const twoslash = transformerTwoslash({
		explicitTrigger: false,
		renderer: rendererRich({ jsdoc: false }),
		twoslashOptions: {
			compilerOptions: {
				noErrorTruncation: true,
				ignoreDeprecations: "6.0",
				moduleResolution: 100 /* Bundler */,
				module: 99 /* ESNext */,
				target: 11 /* ES2024 */,
				strict: true,
				exactOptionalPropertyTypes: true
			},
			filterNode: node => {
				if (node.type !== "hover") return true
				if (keep) return keep.includes(node.target)
				return /^(const|type|function) /.test(node.text)
			}
		}
	})
	const html = highlighter.codeToHtml(code, {
		lang: "ts",
		themes: { dark: "ArkDark", light: "ArkLight" },
		defaultColor: false,
		transformers: [twoslash]
	})
	let out = html
		// hovers are reachable by keyboard and by tap
		.replaceAll(
			'<span class="twoslash-hover',
			'<span tabindex="0" class="twoslash-hover'
		)
		// no <pre> is interactive itself, including the hidden ones inside each
		// popup (those were invisible tab stops); the hovers are
		.replaceAll(/(<pre\b[^>]*?) tabindex="0">/g, "$1>")
	for (const [from, to] of lightContrast)
		out = out.replaceAll(`--shiki-light:${from}`, `--shiki-light:${to}`)
	return out
}

/**
 * ArkLight's lighter accents are under 4.5:1 on the parchment surfaces, so
 * the light half of each token is darkened along its own hue (≥4.9:1 on
 * #f9f5d7). The dark half is ArkDark verbatim.
 */
const lightContrast = [
	["#CA842E", "#9a5a17"],
	["#04B5A3", "#03776b"],
	["#0078D4", "#0063b1"]
] as const

const only = process.argv.slice(2)
const files = readdirSync(snippetDir)
	.filter(f => f.endsWith(".ts"))
	.filter(f => !only.length || only.includes(basename(f, ".ts")))
	.sort()

for (const file of files) {
	const name = basename(file, ".ts")
	const started = performance.now()
	const html = render(name, readFileSync(new URL(file, snippetDir), "utf8"))
	writeFileSync(new URL(`${name}.html`, outDir), `${html}\n`)
	const queries = [
		...html.matchAll(
			/twoslash-query-persisted"><span class="twoslash-popup-container[^"]*">(?:<div class="twoslash-popup-arrow"><\/div>)?<code class="twoslash-popup-code">([\s\S]*?)<\/code>/g
		)
	].map(match => match[1])
	writeFileSync(
		new URL(`${name}.queries.json`, outDir),
		`${JSON.stringify(queries, null, "\t")}\n`
	)
	console.log(`${name}: ${Math.round(performance.now() - started)}ms`)
}
