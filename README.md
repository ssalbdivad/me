# me

Personal site for [ssalbdivad.com](https://ssalbdivad.com) (and [ssalbdivad.dev](https://ssalbdivad.dev)).

A static, fully prerendered [TanStack Start](https://tanstack.com/start) app: React 19.3, Vite 8,
Motion, Tailwind 4, and the ArkType ecosystem- `arktype` validates every stat the build fetches and
runs live in the page, `arkregex` is in the hero, and every code sample is real TypeScript output
(build-time twoslash) highlighted with ArkDark/ArkLight and ArkType's own grammar.

```sh
pnpm dev          # vite dev
pnpm build        # scripts/prebuild.ts, then vite build → dist/client
pnpm preview      # serve dist/client exactly like a static host (404.html for unknown paths)
pnpm typecheck    # TypeScript 7 (tsgo)
pnpm bench        # re-measure the TS 5.9 merge-chain story with @ark/attest
```

## Data

Live numbers (npm downloads, GitHub stars and followers, this site's own check cost) are fetched
at build by `scripts/prebuild.ts`, which runs:

- `scripts/stats.ts` → `src/data/stats.json`: npm downloads (an explicit 30-day window ending
  on the last day npm has published), GitHub stars and followers. Each group that fails to
  fetch keeps its committed value, except on scheduled builds (`STATS_STRICT=true`), which fail
  instead so the live site never rolls back to older numbers.
- `scripts/snippets.ts` → `src/data/snippets/*`: twoslash for every `src/snippets/*.ts`.
- `tsgo --extendedDiagnostics` → `src/data/site-cost.json`, the footer's "⛳ this site" line.

Fixed numbers (case-study timings, instantiation counts, launch-post views) are typed by hand in
`src/data/caseStudies.ts`, `src/data/claims.ts` and `src/components/Work.tsx`, each beside the URL
it was read from.

`bench/merge-chain/run.ts` is the measurement behind the perf chart: David's
microsoft/TypeScript#61505 bench on TS 5.8.2, 5.9.3 and 6.0.3, written to `src/data/merge-chain.json`.

## Deploy

`.github/workflows/deploy.yml` builds on every push to `main` and every three hours (so the
numbers pick up npm's daily rollup soon after it lands), then deploys `dist/client` to GitHub Pages. One-time setup:

```sh
gh api -X POST repos/ssalbdivad/me/pages -f build_type=workflow
gh api -X PUT repos/ssalbdivad/me/pages -f cname=ssalbdivad.com
```

DNS: apex `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and
`185.199.111.153` (and `AAAA` to `2606:50c0:8000::153` through `8003::153`), and a `www` `CNAME`
to `ssalbdivad.github.io`. Once the certificate is issued, enforce HTTPS:
`gh api -X PUT repos/ssalbdivad/me/pages -F https_enforced=true`.

An Actions deploy ignores `public/CNAME`; the domain lives in the Pages settings. The file stays as
a record of the canonical domain. GitHub disables scheduled workflows after 60 days without a
commit, so a quiet repo needs a push (or a manual run) to keep the daily refresh alive.
