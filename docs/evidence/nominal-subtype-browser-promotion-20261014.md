# Browser nominal Subtype support

The [installed package archive](nominal-subtype-browser-20261014/index.json)
verifies the tested Nat Subtypes in copied records and variants on browser
pages, React and dedicated workers. Both ordinary-source and independently
reviewed packages passed with full and standalone result-only APIs. The producer
was `2f723c1300abf84975454486b80882130b97048b`.

## Installed configurations

All four selections ran on Linux x64 with Node 22.23.2, Chromium 151.0.7922.34,
Firefox 153.0 and WebKit 26.5. Each browser selection includes a page build,
React production and strict builds, and a dedicated-worker build.

| Original test output | Node executions | Browser executions | Browser lifecycle observations |
| --- | --- | --- | --- |
| [Ordinary full API](nominal-subtype-browser-20261014/ordinary-full/run.tap) | 2 | 12 | 51 |
| [Ordinary result-only API](nominal-subtype-browser-20261014/ordinary-result-only/run.tap) | 2 | 12 | 51 |
| [Reviewed full API](nominal-subtype-browser-20261014/reviewed-full/run.tap) | 2 | 12 | 51 |
| [Reviewed result-only API](nominal-subtype-browser-20261014/reviewed-result-only/run.tap) | 2 | 12 | 51 |

The Node callers and browser lifecycle observations completed 556,500 caller
checks, including 109,392 expected refusals. These are caller assertions;
constructor and source-entry counts and memory were not measured.

## Package and lifecycle checks

Two independent author roots reproduced both component and shared-runtime npm
archives for each selection. The author roots were removed before offline
installation. Strict TypeScript and Node callers passed before and after
moving the installation. Browser callers used source-free production bundles.
The reports authenticate the complete installed file sets and the Wasm files
actually served to the browsers against the original package archives.

The lifecycle checks cover missing-asset recovery, React remounts and pending
unmounts, worker restarts and disposal. Full APIs preserve each input site's
checked constructor, including distinct normalization choices for the same
record. Only active variant payloads run their constructors. Rejected inputs
remain unchanged and later valid calls succeed. Copied results expose existing
Lean payloads without proof fields or input constructor selections, including
100-bit Nat results and standalone result-only packages.

The archive retains both npm archives, original caller and compiler records,
test output, the launcher and its pre-launch digest. Browser binaries, framework
archives and deployment bundles are not retained. The local compiler used the
recorded Nix command transport adapter, not a Nix sandbox. Absolute paths in
the launch records identify the original machine; checks read the retained
repository files, not those historical paths.

## Support changes

Four installed-evidence entries supplement twelve existing browser Subtype
input/result cells and add six field cells across both author routes. Other
profiles, shapes and positions retain their previous claims. In particular,
the fixture's mixed Fin guards do not establish browser nominal Fin support.

Other primitive-base nominal fixtures, refined callbacks, owned values,
recursive graphs, dependent types and broader generic combinations remain
separate work. These local results do not establish hosted acceptance of a
later revision.

## Recurring checks

The [required browser workflow](../../.github/workflows/nominal-subtype-browser.yml)
runs all four source/API selections with all three browsers. It builds the
locked component engine and shared Wasm runtime, retains complete or partial
original records, and rejects skipped tests, incomplete output or failed
acceptance. The recurring driver uses repository-relative paths.

Run the support and history tests with:

```sh
node --max-old-space-size=3072 --test --test-concurrency=1 \
  tests/helpers/nominal-subtype-browser-promotion-tests.mjs \
  tests/helpers/nominal-subtype-browser-promotion-history-tests.mjs
```

The exact source transition starts at
`fc95d2c5ff661164d8bc966846cbc2b2adbafa0a`. Earlier evidence files and ledgers
remain unchanged.
