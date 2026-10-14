/**
 * Renders public/og.png (1200×630): ArkDark navy with arktype.io's top glow,
 * the name, "from editor to runtime to agent" in the cursive with its three
 * nouns in sky/gold/teal, and ArkType's violet error squiggle as a waterline
 * with a ⛵ sailing on it- the type error is the sea his boat sails on.
 *
 * Fonts come from node_modules and public/, so the card uses exactly the
 * site's faces (including Cascadia's ss01 cursive).
 *
 * Run: node scripts/og.ts
 */
import { readFileSync } from "node:fs"
import { chromium } from "playwright"

const root = new URL("../", import.meta.url)
// inlined as data URLs: a page set from a string can't load file:// fonts
const file = (path: string) => {
	const type = path.endsWith(".woff2") ? "font/woff2" : "image/jpeg"
	return `data:${type};base64,${readFileSync(new URL(path, root)).toString("base64")}`
}

const atkinson = file(
	"node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2"
)
const cascadia = file(
	"node_modules/@fontsource-variable/cascadia-code/files/cascadia-code-latin-wght-normal.woff2"
)
const cursive = file("public/fonts/cascadia-code-italic.woff2")
const avatar = file("public/avatar.jpg")

// ArkType's errorSquiggle.svg (ark/docs), as a repeating tile
const squiggle = `data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6 3" width="6" height="3"><g fill="#9558f8"><polygon points="5.5,0 2.5,3 1.1,3 4.1,0"/><polygon points="4,0 6,2 6,0.6 5.4,0"/><polygon points="0,2 1,3 2.4,3 0,0.6"/></g></svg>`
)}`

const html = /* html */ `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face { font-family: Atkinson; src: url(${atkinson}) format("woff2"); font-weight: 200 800; }
@font-face { font-family: Cascadia; src: url(${cascadia}) format("woff2"); font-weight: 200 700; }
@font-face { font-family: "Cascadia Cursive"; src: url(${cursive}) format("woff2"); font-style: italic; font-weight: 400; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1200px; height: 630px; overflow: hidden; }
body {
	position: relative;
	color: #eeeeee;
	font-family: Atkinson, sans-serif;
	-webkit-font-smoothing: antialiased;
	background:
		linear-gradient(rgba(5, 105, 255, 0.15), transparent 62%),
		radial-gradient(760px 420px at 88% -12%, rgba(64, 143, 222, 0.22), transparent 70%),
		radial-gradient(620px 360px at 0% -18%, rgba(245, 207, 143, 0.08), transparent 70%),
		#080d17;
}
main { position: absolute; left: 80px; top: 62px; }
.eyebrow { display: flex; align-items: center; gap: 16px; }
.eyebrow img { width: 60px; height: 60px; border-radius: 50%; box-shadow: 0 0 0 2px #080d17, 0 0 0 3.5px rgba(186, 126, 65, 0.6); }
.handle { font: italic 400 34px/1 "Cascadia Cursive"; font-feature-settings: "ss01"; color: #80cff8; }
.where { font: 400 30px/1 Cascadia; color: #888899; }
.where b { font-weight: 400; color: #ba7e41; }
h1 {
	margin-top: 30px;
	font-size: 136px;
	font-weight: 800;
	letter-spacing: -0.045em;
	line-height: 0.92;
}
.tag {
	margin-top: 22px;
	font: italic 400 40px/1.15 "Cascadia Cursive";
	font-feature-settings: "ss01", "calt";
	letter-spacing: -0.01em;
	color: #b6bacb;
}
.tag .sky { color: #80cff8; }
.tag .gold { color: #f5cf8f; }
.tag .teal { color: #40decc; }
.projects { margin-top: 24px; font: 400 40px/1 Atkinson; color: #888899; letter-spacing: 0.005em; }
.projects b { font-weight: 600; color: #b6bacb; }
.sea {
	position: absolute;
	left: 0; right: 0; top: 546px; bottom: 0;
	background: linear-gradient(rgba(149, 88, 248, 0.10), rgba(149, 88, 248, 0) 80%);
}
.waterline {
	position: absolute;
	left: 0; right: 0; top: -8px; height: 12px;
	background: url("${squiggle}") repeat-x 0 0 / 24px 12px;
	filter: drop-shadow(0 0 10px rgba(149, 88, 248, 0.55));
}
.boat {
	position: absolute;
	left: 900px; top: -100px;
	font-size: 94px; line-height: 1;
	transform: rotate(-4deg);
	filter: drop-shadow(0 10px 16px rgba(0, 0, 0, 0.5));
}
.wake {
	position: absolute;
	left: 850px; top: 14px; width: 200px; height: 26px;
	background: radial-gradient(closest-side, rgba(128, 207, 248, 0.16), transparent);
}
.site { position: absolute; right: 84px; bottom: 26px; font: 400 26px/1 Cascadia; color: #888899; }
</style></head><body>
<main>
	<div class="eyebrow">
		<img src="${avatar}" alt="">
		<span class="handle">@ssalbdivad</span>
		<span class="where"><b>//</b> TypeScript engineer</span>
	</div>
	<h1>David Blass</h1>
	<p class="tag">from <span class="sky">editor</span> to <span class="gold">runtime</span> to <span class="teal">agent</span></p>
	<p class="projects"><b>ArkType</b> · <b>Standard Schema</b> · <b>Pullfrog</b></p>
</main>
<div class="sea"><div class="waterline"></div><div class="wake"></div><span class="boat">⛵</span></div>
<span class="site">ssalbdivad.com</span>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html, { waitUntil: "load" })
await page.evaluate(() => document.fonts.ready)
const out = new URL("public/og.png", root).pathname
await page.screenshot({ path: out })
await browser.close()
console.log(`wrote ${out}`)
