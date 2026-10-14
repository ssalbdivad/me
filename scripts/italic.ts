/**
 * Builds public/fonts/cascadia-code-italic.woff2: the cursive italic used on
 * declared names. fontsource's Cascadia italic strips ss01 (the cursive
 * set), so this starts from Microsoft's official build instead:
 *
 *   https://github.com/microsoft/cascadia-code/releases/tag/v2407.24
 *   CascadiaCode-2407.24.zip → woff2/CascadiaCodeItalic.woff2 (or ttf/)
 *
 * and makes it small:
 * 1. subset to Basic Latin (the only text set in it), keeping ss01 and calt
 *    (what .decl turns on), kern/mark/mkmk, and rvrn so step 2 can resolve
 *    the weight-dependent glyph swaps
 * 2. instance the variable font at wght 400, the only weight the site uses
 * 3. assert the result still has ss01 and no variation axes
 *
 * About 22K instead of 53K for the variable subset, rendering identically.
 * Needs fonttools with brotli (`pip install fonttools brotli`, or point
 * PYTHONPATH at a directory that has them).
 *
 * Run: node scripts/italic.ts <path to CascadiaCodeItalic.woff2 or .ttf>
 */
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// sha256 of the two v2407.24 release files, so the output is reproducible
const official: Record<string, string> = {
	"7b38c6e24c4f114ecdbc73c9114bf59cd7e998309a8a2ee54ef1e0289481405f":
		"woff2/CascadiaCodeItalic.woff2",
	"48e64f8d82acd86956df5f33076966eacf4d9c3ea620c9d88231fa94da117f2c":
		"ttf/CascadiaCodeItalic.ttf"
}

const source = process.argv[2]
if (!source) {
	console.error(
		"usage: node scripts/italic.ts <CascadiaCodeItalic.woff2|ttf from cascadia-code v2407.24>"
	)
	process.exit(1)
}
const hash = createHash("sha256").update(readFileSync(source)).digest("hex")
if (!official[hash])
	throw new Error(
		`${source} (sha256 ${hash}) is not the official v2407.24 CascadiaCodeItalic`
	)

const out = new URL(
	"../public/fonts/cascadia-code-italic.woff2",
	import.meta.url
).pathname
const dir = mkdtempSync(join(tmpdir(), "italic-"))
const python = (...args: string[]) =>
	execFileSync("python3", args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"]
	})

try {
	const subset = join(dir, "subset.ttf")
	python(
		"-m",
		"fontTools.subset",
		source,
		"--unicodes=U+0020-007E,U+00A0",
		"--layout-features=ss01,calt,kern,mark,mkmk,rvrn",
		"--name-IDs=*",
		"--name-legacy",
		"--name-languages=*",
		`--output-file=${subset}`
	)
	const instanced = join(dir, "instanced.ttf")
	python(
		"-m",
		"fontTools.varLib.instancer",
		subset,
		"wght=400",
		"-o",
		instanced,
		"-q"
	)
	python(
		"-c",
		`from fontTools.ttLib import TTFont
f = TTFont(${JSON.stringify(instanced)})
f.flavor = "woff2"
f.save(${JSON.stringify(out)})`
	)
	const check = JSON.parse(
		python(
			"-c",
			`import json
from fontTools.ttLib import TTFont
f = TTFont(${JSON.stringify(out)})
print(json.dumps({
	"features": sorted({r.FeatureTag for r in f["GSUB"].table.FeatureList.FeatureRecord}),
	"variable": "fvar" in f,
	"weight": f["OS/2"].usWeightClass,
	"glyphs": len(f.getGlyphOrder())
}))`
		)
	) as { features: string[]; variable: boolean; weight: number; glyphs: number }
	if (!check.features.includes("ss01"))
		throw new Error(`ss01 was dropped: ${check.features}`)
	if (check.variable) throw new Error("the output is still variable")
	console.log(
		`wrote ${out}: ${statSync(out).size} bytes, ${check.glyphs} glyphs, weight ${check.weight}, features ${check.features.join(" ")} (from ${official[hash]})`
	)
} finally {
	rmSync(dir, { recursive: true, force: true })
}
