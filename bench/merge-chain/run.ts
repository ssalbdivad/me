/**
 * Re-measures the TypeScript 5.9 "Cache Instantiations on Mappers" story
 * (microsoft/TypeScript#61505) that the home page charts.
 *
 * For every TypeScript version below, a chain of N `merge()` calls is
 * benchmarked with @ark/attest (deterministic instantiation counts), then
 * type-checked with `tsc` to record whether the chain trips TS2589
 * ("Type instantiation is excessively deep and possibly infinite").
 *
 * The bench body is David's own repro from
 * https://github.com/microsoft/TypeScript/pull/61505#issuecomment-2768089049,
 * so functional(10..12) on 5.8.2 must reproduce 59,386 / 177,537 / 531,887.
 *
 * Run: node --experimental-strip-types bench/merge-chain/run.ts
 * Each version installs into bench/merge-chain/.versions/<version> (ignored).
 */
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const versions = ["5.8.2", "5.9.3", "6.0.3"]
const maxKeys = 16
const attestVersion = "0.57.0"

const root = dirname(fileURLToPath(import.meta.url))
const out = join(root, "../../src/data/merge-chain.json")
const keys = "abcdefghijklmnopqrstuvwxyz".split("")

const preamble = `import { bench } from "@ark/attest"

type merge<base, props> = Omit<base, keyof props & keyof base> & props

declare const merge: <l, r>(l: l, r: r) => merge<l, r>

type Type<t> = {
	merge: <r>(r: r) => Type<merge<t, r>>
	unwrapped: t
}

declare const start: Type<{ a: 1 }>
`

// functional(n): n keys, so n - 1 merge() calls (matches #61505's naming)
const functionalBody = (n: number) => {
	const lines = [`const ${keys[0]}0 = merge({ a: 1 }, { b: 2 })`]
	for (let i = 1; i < n - 1; i++)
		lines.push(
			`const ${keys[i]}0 = merge(${keys[i - 1]}0, { ${keys[i + 1]}: ${i + 2} })`
		)
	return lines.join("\n\t")
}

const chainedBody = (n: number) => {
	const lines = [`const ${keys[1]}1 = start.merge({ b: 2 })`]
	for (let i = 2; i < n; i++)
		lines.push(
			`const ${keys[i]}1 = ${keys[i - 1]}1.merge({ ${keys[i]}: ${i + 1} })`
		)
	return lines.join("\n\t")
}

const forms = { functional: functionalBody, chained: chainedBody }
type Form = keyof typeof forms

type Point = {
	keys: number
	calls: number
	instantiations: number
	ts2589: boolean
}

const results: Record<string, Record<Form, Point[]>> = {}

for (const version of versions) {
	const dir = join(root, ".versions", version)
	if (!existsSync(join(dir, "node_modules"))) {
		mkdirSync(dir, { recursive: true })
		writeFileSync(
			join(dir, "package.json"),
			JSON.stringify({
				name: `merge-chain-${version}`,
				type: "module",
				private: true,
				dependencies: { "@ark/attest": attestVersion, typescript: version }
			})
		)
		execFileSync("pnpm", ["install", "--ignore-workspace", "--silent"], {
			cwd: dir,
			stdio: "inherit"
		})
	}
	// attest resolves the nearest tsconfig.json, so pin one beside the benches
	writeFileSync(
		join(dir, "tsconfig.json"),
		JSON.stringify({
			compilerOptions: {
				strict: true,
				module: "NodeNext",
				moduleResolution: "NodeNext",
				target: "ESNext",
				noEmit: true,
				skipLibCheck: true
			}
		})
	)

	results[version] = { functional: [], chained: [] }
	for (const form of Object.keys(forms) as Form[]) {
		for (let n = 2; n <= maxKeys; n++) {
			const file = join(dir, `${form}-${n}.ts`)
			writeFileSync(
				file,
				`${preamble}\nbench("${form}(${n})", () => {\n\t${forms[form](n)}\n}).types()\n`
			)
			const bench = spawnSync(
				"node",
				["--experimental-strip-types", "--no-warnings", file],
				{ cwd: dir, encoding: "utf8" }
			)
			const match = /Result: (\d+) instantiations/.exec(bench.stdout)
			if (!match)
				throw new Error(
					`No result for ${version} ${form}(${n}):\n${bench.stdout}${bench.stderr}`
				)
			const instantiations = Number(match[1])
			const check = spawnSync(
				"node",
				[
					join(dir, "node_modules/typescript/bin/tsc"),
					"--noEmit",
					"--strict",
					"--skipLibCheck",
					"--module",
					"NodeNext",
					"--moduleResolution",
					"NodeNext",
					"--target",
					"ESNext",
					file
				],
				{ cwd: dir, encoding: "utf8" }
			)
			const ts2589 = check.stdout.includes("TS2589")
			const point = { keys: n, calls: n - 1, instantiations, ts2589 }
			results[version][form].push(point)
			console.log(version, form, JSON.stringify(point))
		}
	}
}

writeFileSync(
	out,
	`${JSON.stringify({ measuredAt: new Date().toISOString(), attest: attestVersion, results }, null, "\t")}\n`
)
console.log(`wrote ${out}`)
