# David Blass

Boston, MA · david@arktype.io · [ssalbdivad.com](https://ssalbdivad.com)
[github.com/ssalbdivad](https://github.com/ssalbdivad) · [linkedin.com/in/ssalbdivad](https://www.linkedin.com/in/ssalbdivad) · [arktype.io](https://arktype.io)

TypeScript engineer. I make TypeScript's types do things they probably shouldn't- then make them fast. Lately, I work on agents, too.

Numbers: a snapshot of 2026-10-13; npm figures cover 2026-09-13 to 2026-10-12; each links to its source.

## Experience

### Author, ArkType ecosystem · 2022–present

- **[ArkType](https://arktype.io)**: TypeScript's 1:1 validator, optimized from editor to runtime. Its type-level parser infers TS syntax from strings; at runtime the same definitions compile to JIT-friendly validation code. [9.05M npm downloads a month](https://api.npmjs.org/downloads/point/2026-09-13:2026-10-12/arktype), [7.87K GitHub stars](https://github.com/arktypeio/arktype).
- **ArkRegex**: the first library to validate and infer regex from TypeScript's type system. [733K views on the launch post](https://x.com/arktypeio/status/1983210635266498649).
- **Attest**: granular type-level benchmarking and testing for TypeScript; deterministic instantiation counts let CI catch slow types. [427K npm downloads a month](https://api.npmjs.org/downloads/point/2026-09-13:2026-10-12/@ark/attest).
- **ArkSchema**: a set-theoretic type system with intersections, subtyping and union discrimination.

### Co-creator, Standard Schema · 2024–present

- Designed, with the creators of Zod and Valibot, the interface that lets any TypeScript validation library plug into any framework; integrated by tRPC, TanStack, Hono, React Hook Form and more. The spec package has [551M npm downloads a month](https://api.npmjs.org/downloads/point/2026-09-13:2026-10-12/@standard-schema/spec), mostly transitive installs.
- Co-authored Standard JSON Schema, so any validator can define tool inputs for AI agents and MCP.

### Co-founder, Pullfrog · 2025–present

- Co-founded [Pullfrog](https://pullfrog.com) with Colin McDonnell (creator of Zod): an open-source platform running AI coding agents in GitHub Actions ([1.3K stars](https://github.com/pullfrog/pullfrog)). Agents review PRs, triage issues, fix CI, resolve merge conflicts and test UIs in a headless browser.
- Built the model-agnostic agent runtime: OpenCode, BYOK, MCP tools, GitHub App/OIDC auth, sandboxed CI.
- Building [ntwine](https://github.com/ssalbdivad/ntwine) to run many coding agents in parallel and queue up the ones that need a human; used daily to develop Pullfrog.

### TypeScript performance consultant · 2023–2025

- Found, minimized, benchmarked and drove a TypeScript compiler fix for O(3^N) instantiations in chained Zod- and tRPC-style types; the patch is by Mateusz Burzyński ([TypeScript#61505](https://github.com/microsoft/TypeScript/pull/61505)). It shipped in TS 5.9: 2.0× faster checks on AnswerOverflow's tRPC dashboard ([6.66s → 3.29s, 5 runs each](https://github.com/microsoft/TypeScript/pull/61535#issuecomment-2780961089)), 2.1× on a tRPC monorepo I tested (one run), and 2.9× on Klarna's app (self-reported).
- viem: found 1.86s spent computing one type's variance in MUD's build; hand-annotated variance now ships in viem ([mud#2956](https://github.com/latticexyz/mud/pull/2956), [viem#2557](https://github.com/wevm/viem/pull/2557)).
- Prisma: built their type benchmarks and helped speed up their generated types, including 45% less check time on one generated file ([prisma/orm#27046](https://github.com/prisma/orm/pull/27046)); Prisma wrote it up in its [6.16 release notes](https://github.com/prisma/orm/releases/tag/6.16.0). Mongoose 8.19: 36–67% fewer instantiations on its `InferRawDocType` benchmarks ([mongoose#15588](https://github.com/Automattic/mongoose/pull/15588)).
- Deep expertise in V8 JIT optimization, including runtime codegen for high-throughput validation.
- Clients included tRPC, Drizzle, Prisma, Convex, AWS Amplify, Speakeasy, Stately, wevm, Vanta and Cloudinary.

### Founder, Redo Inc. · 2019–2021

- Led a team building a desktop app that generates UI tests from recorded user interactions.

### SDET II, Amazon Alexa Devices · 2017–2019

- Built PyEcho, Amazon's standard test-automation framework for Alexa devices (Python, Android).

## How I work with agents

Most days I have a lot of coding agents working on Pullfrog at once. I run them from [ntwine](https://github.com/ssalbdivad/ntwine), which I'm building to run them in parallel and queue up the ones that need me. The rules I've ended up with, for them and for me: size work by scope, never in days; report honest effect sizes; lead with what changed; preserve evidence.

## Talks

- Effect Days 2024 · [Discriminated Unions in TypeScript, Effect, and ArkType](https://www.youtube.com/watch?v=AaUKLH8N6go)
- TypeScript Congress 2023 · [ArkType: Bringing TypeScript to Runtime](https://gitnation.com/contents/arktype-bringing-typescript-to-runtime)

## Education

Tufts University, 2011–2015. Computer Science, Entrepreneurial Leadership, Philosophy.
