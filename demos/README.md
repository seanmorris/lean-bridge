# Develop and verify demos

This directory owns the Lean algorithms, proofs, C adapters, runtime APIs, differential tests, and benchmark workloads used by the [algorithm gallery](index.html). The [documentation site](../site/README.md) owns the React presentation for all twelve demos. Source-preview pages mount the same scoped controllers; published legacy URLs redirect to their React routes.

To call a maintained solver without changing it, use the [demo-local API guide](../docs/demo-api.md). To produce an installable library from your own Lean source, follow the [author guide](../docs/lean-author-guide.md).

## Prepare the checkout

Run commands from the repository root. Use Node 22.23.2 to match the Pages workflow and prepare the pinned toolchains:

```sh
npm ci --ignore-scripts
npm run bootstrap
```

The demo build scripts load the repository environment and build the pinned Lean runtime when it is missing. Builds write generated outputs and may download toolchains or dependencies. Review the [contribution requirements](../CONTRIBUTING.md#before-changing-code) before changing Lean sources, bridge metadata, or compiler patches.

## Reproduce a demo

Build and check sweep-and-prune, then assemble the documentation and demo artifact:

```sh
bash demos/lean-sweep-and-prune/build.sh
node --test demos/lean-sweep-and-prune/test.mjs
node demos/lean-sweep-and-prune/benchmark.mjs --assert
npm run demos:site
```

The [build script](lean-sweep-and-prune/build.sh) checks the maintained Lean modules and executable guards, generates the proof receipt, and compiles the browser runtime. The JavaScript tests compare both complete pair sets with an independent quadratic oracle. The [algorithm guide](lean-sweep-and-prune/README.md#verification-and-benchmark) records its differential corpus, input rejection, and ownership checks.

Use each demo's own instructions for its proof graph and runtime tests:

- [Myers verification](lean-myers/README.md#verification-and-performance) checks complete edit scripts against a dynamic-programming oracle.
- [Dinic verification](lean-dinic/README.md#verification-and-benchmark) compares flows and cuts with independent graph algorithms and exhaustive small cases.
- The [gallery manifest](manifest.json) identifies the complete algorithm collection and its named guarantees.

## Run regression checks

After building the selected demos, run their command-line workloads:

```sh
node demos/lean-sweep-and-prune/benchmark.mjs --assert
node demos/lean-dinic/benchmark.mjs --assert
```

These commands enforce the CLI workloads' regression limits and report the measured timings and ratios. A passing limit does not establish parity with JavaScript. Keep matched inputs, output requirements, preparation boundaries, and result checks when changing a workload. The [benchmark-reading guide](../docs/concepts/benchmarks.md) explains browser samples and comparisons; each demo's README identifies its timed work.

Before handing off changes that affect the collection, run the complete proof builds, runtime suites, benchmark assertions, and site assembly:

```sh
npm run demos:verify
git diff -- demos
```

Inspect generated differences against the changed sources. Rebuild generated loaders, binaries, and receipts through the owning build script; do not edit them manually or discard unrelated work to make a freshness check pass.

## Check proof receipts

The sweep-and-prune [audit generator](lean-sweep-and-prune/generate-proof-audit.mjs) names the required declarations and records source hashes in the [proof receipt](lean-sweep-and-prune/runtime/proof-audit.json). Its build invokes the generator after checking the Lean modules. Changing a theorem name or source graph requires reviewing the build inputs and the required-declaration list together.

Keep the Lean source, compiled runtime, and receipt from the same build. Site assembly checks the audited source hashes before copying them. In the proof panel, confirm that the downloaded source matches the receipt and that the checker inputs contain the maintained modules. Follow [From a Lean proof to a browser result](../docs/concepts/lean-to-wasm.md) for the distinction between source identity, Lean checking, compiled execution, and package assurance.

The site build identity records the source revision, route map, and published file hashes. It is unsigned and does not authorize a package release. Record executed commands, environment, source revision, artifacts, results, and limitations in the [evidence collection](../docs/evidence/README.md).

## Check the browser pages

After assembling the site, install the audit browsers and run the demo and site suites:

```sh
npx playwright install --with-deps chromium firefox webkit
DEMO_BROWSERS=chromium,firefox,webkit npm run demos:browser
SITE_BROWSERS=chromium,firefox,webkit npm run site:browser
```

The suites serve the assembled artifact themselves. Demo checks cover live runtimes, proof controls, layouts, and benchmark lifecycle; site checks cover documentation and React workbench behavior. Keep browser lifecycle changes with the owning [site components](../site/README.md#content-and-ownership).

Follow [Publish the documentation and demos](../docs/contributing/github-pages.md) to select the deployment base, preview the exact artifact, and review the Pages workflow. Local build and audit commands do not deploy it.
