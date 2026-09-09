# Generated reference and concept documentation

Date: 9 September 2026. VO1193, within phase 1185 and portfolio plan 1123. Tested working tree based on commit `3e764d247fdc353f5703dee06424c52b77cfa3a0`. The site identities mark the source state as modified. This record does not identify a clean release commit or authorize publication.

## Delivered scope

Fourteen new guides bring the site to 68 documentation routes, including eight compatibility pages, and 83 prerendered React routes overall. The twelve existing workbenches remain unchanged. The homepage links its business explanations to the new change-check, audit, and reuse guides.

Four reference pages are generated from reviewed templates into canonical Markdown. Ten new concept pages connect those contracts to runnable examples and adoption decisions. The existing proof-to-browser and benchmark guides remain their respective source owners.

## Page ownership and reader outcomes

The tested revision above applies to every row. Route and search ownership remains in `site/registry.mjs`; the canonical guide owns the explanatory text. Prerequisites describe what a reader needs to execute the example, not what is required to read the page.

| Canonical page | Audience and prerequisites | Contract or source owner | Expected result and next action |
| --- | --- | --- | --- |
| `docs/reference/cli.md` | Authors and publishers; installed CLI. | `src/cli/contract.mjs`, CLI configuration and result schemas. | Help and exit codes match the executable; run the author tutorial or resolve a diagnostic. |
| `docs/reference/package-api.md` | Consumers; the two prepared fixture releases. | JavaScript declaration generator and component packager. | Imports print `42n` and `true`; use the language installation guide. |
| `docs/reference/types.md` | Authors choosing exports and consumers passing values. | Scalar capability contract and generated fixture declarations. | Identify the host type, numeric range, and copy rules; choose supported exports. |
| `docs/reference/algorithms.md` | Engineers and reviewers; checkout for local adapter calls. | Demo manifest, `runtime.mjs` exports, proof receipts and their Lean sources. | Find every maintained adapter export and selected theorem; open its API contract or workbench. |
| `docs/concepts/index.md` | Product teams, engineers, and reviewers; no toolchain. | Canonical concept guides and documentation registry. | Choose an adoption, audit, or implementation path. |
| `docs/concepts/change-risk.md` | Maintainers and reviewers; pinned Lean for the command. | Author tutorial theorem and strict proof-check runner. | Original proof checks; both broken variants fail; review the theorem's actual strength. |
| `docs/concepts/auditable-claims.md` | Reviewers; no toolchain for source inspection. | Demo proof receipts, site identity, package-release receipt contract. | Trace a named claim to delivered bytes; record the evidence reviewed. |
| `docs/concepts/reusable-cores.md` | Application developers; basic graph vocabulary. | Dijkstra and flood-fill API contracts. | Map domain objects to IDs, directed edges, and costs; run a graph example. |
| `docs/concepts/trust-boundaries.md` | Application integrators; an intended input model. | Algorithm specifications, scalar validation, and adapter contracts. | Identify observable unit, conversion, direction, and stale-result failures; test the integration. |
| `docs/concepts/shared-runtime.md` | JavaScript consumers; prepared compatible fixture packages. | Component packager and runtime loader. | Automatic initialization and two-package composition print the stated results; review ownership. |
| `docs/concepts/ownership.md` | Application developers; maintained local Dijkstra artifacts. | Prepared adapter contract and scoped workbench owner. | Print `[0,1]` and dispose the solver; apply cleanup to late results. |
| `docs/concepts/adoption.md` | Technical leads and product teams; a bounded proposed operation. | Selected theorem/API, release metadata, benchmark method, and application adapter. | Define acceptance, whole-feature measurements, and rollback before replacement. |
| `docs/concepts/dijkstra.md` | Application developers; maintained Dijkstra artifacts. | CSR adapter and `dijkstraCsr_correct`. | Print `[0,1,2,3]` and `[]`; distinguish returned-path soundness from unreachability completeness. |
| `docs/concepts/flood-fill.md` | Application developers; maintained flood-fill artifacts. | CSR reachability and capability-closure theorems. | Print `[0,1]`, `[0,1,2,3,4]`, and sorted capabilities `[0,1]`; model reusable grants correctly. |

## Generated contracts and proof metadata

`scripts/generate-reference-docs.mjs` uses actual CLI help, parser defaults, exit codes, and the JSON result schema. It analyzes the tutorial and scalar fixtures and calls the same declaration generator as the npm packager. It reads adapter exports as syntax without importing the runtime.

Algorithm entries name the maintained exports, selected theorems, API contract, receipt, benchmark, and correctness tests. The generator verifies every source file listed by each receipt, including byte length and SHA-256. Missing selected theorems, altered Lean files, invalid adapter syntax, and unreviewed export forms fail the check. Site generation checks the existing Markdown rather than silently rewriting it.

This check found stale union-find selections in the demo manifest. `partitionCertificate_exact` and `certifiedPartition_correct` were replaced with the current receipt's `solvePartition_correct` and `connected_equivalence`. No Lean source, proof receipt, C bridge, runtime binary, or benchmark workload changed.

The downstream support inventory remains owned by `docs/consumer-support.v1.json`. Ordinary component analysis still labels discovered theorem relationships `unverified`; these reference pages do not promote that state.

## Installed prepared releases

The acceptance runner verified original component-package receipts before installing both components and their common runtime offline with lifecycle scripts disabled. It found one installed runtime dependency, compared both installed `index.d.ts` files byte-for-byte with the reference, executed all four unchanged JavaScript snippets, and ran strict TypeScript checks including rejected argument types.

| Archive | SHA-256 |
| --- | --- |
| `onboarding-small-1.0.0.tgz` | `3100fadf33f2daf5f57e72499b002a4d3b6d07965c12d31971f4aaa7d8296463` |
| `onboarding-scalars-1.0.0.tgz` | `1787339d72344b929821a93503e89fb3372c37d8d11cf2fe71bca4714175b85f` |
| Shared runtime archive | `6345fc7dcb5c7315a697c750a67d7824242d8a73de051855b36f8e4f847fe32f` |

Both components require `@lean-bridge/runtime@0.0.0-abi2.2e51780e057374fea1f6fc268c33a94eef24a7d4f9a6fb733a6a690213c53f0d`. The scalar fixture was freshly compiled using the pinned local toolchain. The tutorial component came from the previously verified author release bundle and was packaged against that same runtime.

Node checks cover 4096-bit natural and signed integers, fixed-width overflow, wrong host types, unpaired surrogates, embedded NUL, single-precision rounding, negative zero, copied bytes, and repeated imports. The generated public validators report fixed-width overflow as `TypeError`; the type guide now states that behavior instead of the lower-level transport's `RangeError`.

The unchanged imports also passed in a production Vite build served under `/prepared/` in Chromium 152.0.7977.75, Firefox 153.0, and WebKit 26.5. Each engine fetched one main Wasm binary and two component binaries, retained identical public functions across repeated imports, and returned exact 128-bit arithmetic. All seven log lines matched the Node examples, with no page errors.

Bundlers can give static and dynamic imports distinct namespace wrappers. The browser harness compares the public function identity and exact result, not wrapper identity. It serializes bigint logs inside the page because console protocols differ in their display representation.

Report: `build/reference-package-acceptance-v3/report.json`.

## Verification status

The focused documentation suite passes 44 tests. The core contract profile passes 342 tests, including the newly registered reference-documentation tests. Site unit tests pass 69 cases; assembled-artifact tests pass 25. Lint and both core and site type checks passed.

The strict tutorial check passed with Lean 4.32.2, commit `f3b06c705e6c85f5314019d5d3baab0fec5b580c`. `OnboardingSmall.add_commutative` depends on no axioms. Both a changed implementation and an admitted proof were rejected. Tutorial source SHA-256: `d4f4b4fe9141a24726b11bc665420909f4ab3aa875c661e1371a66d4c2af2816`.

Both the root artifact and the `/nested/lean-bridge/` artifact passed the full 83-route audit in Chromium 152.0.7977.75, Firefox 153.0, and WebKit 26.5. Each base passed all eight Chromium child gates for proof controls, search, performance, workbench interaction, recovery, and documentation reading. Each base measured 207 landing/documentation page loads with no prose runtime requests and within the 200 KiB gzip JavaScript limit.

The focused reading audits each checked 68 guides at 320, 390, and 1440 pixels: 204 layouts, 921 code/table container observations, and 501 overflowing containers whose contents remained reachable. They checked 34 historical section-link visits, exact grouped pagination, mobile navigation, and identical no-JavaScript article text. Both recorded zero page errors and zero failed requests. Four concept links opened the corresponding running Sweep, Dijkstra, or flood-fill workbench through client navigation. The three homepage explanation links also opened their expected guides.

All 36 maintained runtime loaders, Wasm binaries, and proof receipts match the base commit byte-for-byte in the checkout and both assembled artifacts. This documentation task reused those audited artifacts; it did not recompile the twelve algorithms.

Reports and screenshots are retained under `build/react-site-audit/{root,prefixed}/` and `build/documentation-site-audit/{root,prefixed}/`. The root build identity was generated at `2026-09-09T14:49:02.054Z`. Each artifact's `build-identity.json` records its deployment path, revision, modified source state, route map, and file hashes.

## Reproduction

```sh
npm run docs:reference
npm run lint
npm run typecheck
npm run test:contracts
npm run test:docs
npm run test:docs:proof
npm run site:typecheck
npm run site:test
npm run demos:site
node --test demos/site.test.mjs
SITE_BROWSERS=chromium,firefox,webkit npm run site:browser
```

Build the nested artifact with:

```sh
node --input-type=module -e 'import { assembleSite } from "./scripts/build-demos-site.mjs"; await assembleSite({base: "/nested/lean-bridge/", output: "build/github-pages-prefixed"});'
SITE_ARTIFACT_ROOT=build/github-pages-prefixed SITE_BROWSERS=chromium,firefox,webkit npm run site:browser
```

The [contributor package check](../contributing/testing.md#reference-package-examples) accepts two prepared release directories and a new output directory. This run used `build/reference-package-fixtures/tutorial` and `build/reference-package-fixtures/scalars-current` as its inputs. The reports preserve exact archive identities rather than depending on those machine-local paths.

## Isolated-builder follow-up

An additional Docker CLI build of the scalar fixture failed before compilation. Nix reported that the Docker-mounted Git checkout at `/workspace/engine` was not owned by the current user. The diagnostic is retained in `build/reference-isolated-build-diagnostic.log`. This run did not change Git safety settings or repository ownership.

The pinned direct build produced the scalar component used in the successful prepared-package checks. That result did not establish Docker workflow success.

VO1194 follow-up, 9 September: the entrypoint now registers the exact selected source path in the disposable container's Git configuration, which Nix's libgit2 reader honors. A network-disabled regression accepts the selected foreign-owned repository, rejects an unrelated one, excludes ignored inputs, and confirms that the host Git configuration is unchanged. The full Docker scalar build then passed compilation and provenance validation using cached pinned compiler dependencies. The [container guide](../../containers/README.md#building-and-testing) documents the regression, which also runs in Docker CI.

No commit, push, registry upload, or site deployment is included in this documentation batch. VO1194 owns the full cutover acceptance; VO1145 requires separate deployment authority.
