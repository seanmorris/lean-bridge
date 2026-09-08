# Documentation map

Build a Lean component, call it from an application, or prepare it for a release. Each path uses the same example and links to the commands, source files, and verification records it needs.

## Choose your starting point

| Your task | Start here | Result |
| --- | --- | --- |
| I write Lean | [Package a Lean library](lean-author-guide.md) | A checked source project, a component bundle, and two local npm archives. |
| I build applications | [Use a Lean package](consume.md) | Verified archive installation and calls from Node, React, or a browser worker. |
| I ship libraries | [Publish a Lean package](publishing.md) | A local handoff or a reviewed release workflow with its required records. |
| I maintain this site | [Publish the documentation site](publish/github-pages.md) | A tested static artifact for domain-root or project Pages hosting. |

The CLI is currently installed from a local checkout. Follow [toolchain setup](lean/setup.md) before the author tutorial. An application consuming generated archives does not need the author toolchain.

## Follow one complete example

The author tutorial defines `add` and `isEmpty`, then adds an addition theorem. Lean checks the theorem; analysis records which functions can be exported and which theorem relationships it found. The build produces a component, and a reproducibility dry run produces the runtime and component archives.

Follow [Build your first component](lean/first-component.md), then [JavaScript and TypeScript](javascript-typescript.md). The [React](react.md) and [worker](browser-workers.md) guides use that package by name. They do not import repository fixtures into the consuming application.

## Understand the demos

- [From proof to browser result](concepts/lean-to-wasm.md) traces the sweep-and-prune guarantee through Lean, compilation, and the browser adapter.
- [Read the benchmarks](concepts/benchmarks.md) explains warmup, medians, p95, histograms, and the JavaScript comparison.
- [Use a demo's local API](demo-api.md) calls a compiled box solver without the webpage.
- [Run the algorithm collection](../demos/index.html) to change inputs and inspect the results.

## Claim ownership

| Area | Canonical document |
|---|---|
| Project goal, benefits, examples, selected measurements, and current support summary | [Project README](../README.md) |
| Architecture requirements and decisions | [Architecture index](architecture/README.md) |
| Executed commands, measurements, artifact identities, and limitations | [Evidence index](evidence/README.md) |
| Versioned downstream support states and blockers | [Consumer support contract](consumer-support.v1.json) |
| Current implementation inventory | [Status](status.md) |
| Long-term direction | [Vision](vision.md) |

The root README is a landing page. It links to canonical records and selects a small amount of current evidence, but it does not own raw inventories or test logs.

## User guides

| Audience | Guide |
|---|---|
| Lean package authors | [Lean author guide](lean-author-guide.md) |
| JavaScript and TypeScript consumers | [JavaScript and TypeScript guide](javascript-typescript.md) |
| React applications and browser workers | [React](react.md), [browser assets and workers](browser-workers.md) |
| Library and site publishers | [Publishing guide](publishing.md) |
| Native PHP and PHP-Wasm consumers | [PHP guide](php.md) |
| .NET, JVM, and Ruby consumers | [.NET, JVM, and Ruby guide](dotnet-jvm-ruby.md) |
| Python, Rust, C, C++, browser npm, and WIT/WASI consumers | [Consumer guide](consumers.md) |

Guides describe commands that a user can execute with produced package archives. They state prerequisites, imports, calls, cleanup, receipt verification, and current blockers. A generated API preview does not become a supported workflow until the versioned support record and clean-consumer evidence agree.

## Architecture and evidence

Architecture pages define durable interoperability, safety, reproducibility, and ownership rules. Architecture decision records explain why the project selected a boundary and what alternatives it rejected.

The [React gallery and documentation-site plan](architecture/react-documentation-site-plan.md) describes the planned public site for Lean authors, downstream consumers, and publishers. It reuses the canonical guides above and keeps migration work separate from executed evidence.

Evidence pages record observations. Each one should identify the command, environment, source revision, artifacts, result, and limitation. A design expectation belongs in architecture; a command that passed belongs in evidence. Do not write future intent as an observed result.

Raw measurement and acceptance records stay under the evidence index or their versioned input directories. Documentation links to those records rather than translating them into vague claims.

## Contributor workflow

When behavior changes:

1. Update the owning implementation and test.
2. Update the machine-readable contract if support state or schema shape changed.
3. Execute the relevant workflow and record fresh evidence.
4. Update the detailed guide or status page.
5. Change the root README only when its selected summary has become stale.
6. Run `npm run test:docs` to validate links, paths, examples, support consistency, and writing rules.

Directory explainers under [`../src`](../src/README.md), [`../scripts`](../scripts/README.md), and [`../tests`](../tests/README.md) help contributors locate implementation. They should link here for canonical claims instead of becoming parallel status documents.

## Style and references

Repository prose follows the root writing rules. Use project URNs for identifiers; no project web domain is assumed. Use repository-relative links in committed Markdown. Keep examples on public generated APIs and omit private ABI names, raw pointers, and internal transport imports.

Run `npm run test:docs` before committing. The documentation test checks local links, forbidden workspace paths, punctuation, support-table consistency, and public example boundaries.
