# Restore the filtered component engine dependencies

Browser CI run [38189552536](https://github.com/seanmorris/lean-bridge/actions/runs/38189552536) failed on revision `08bd9c44240fc9e3bf0488627f197537ff08bb66`. The first ordinary-source package stopped before compilation or browser execution. Node could not import `src/build/component-refinement-mirrors.mjs` from the filtered Nix engine source.

The component engine source list omitted three dependencies introduced by the refinement adapters:

- `src/build/component-fin-guards.mjs`
- `src/build/component-refinement-mirrors.mjs`
- `src/build/refinement-mirrors.mjs`

The component list now includes all three. It also names `src/abi/generic-specialization.mjs`, which the core source list already admitted. The previous closure test's line-based regex missed that multiline import. The test now uses the repository's syntax-tree module walker.

Local reproduction used a temporary copy containing only files admitted by the component and core source filters. Importing the real engine modules failed with the same missing-module error. After the repair, those imports pass. Removing each of the four dependencies from the copied tree makes a fresh Node process fail, and restoring the files restores successful imports.

The browser workflow now runs the closure, filtered identity, and filtered import tests immediately after `npm ci`, before compiler bootstrap, browser installation, the Nix engine build, or runtime compilation. Workflow mutation controls reject bypassing or narrowing this preflight.

## Evidence and scope

The local reproduction logs are `build/ci-38189552536-component-boundary-repro-r1.tap` and `build/ci-38189552536-filtered-import-repro-r1.tap`. The repaired preflight passed three tests, without skips. The combined engine, workflow, source-history, inventory, and test-registration run passed 81 tests, without skips: `build/ci-38189552536-component-closure-validation-r1.tap`.

The immutable source-history ledger is `component-engine-closure-source-history-20261012.json`, with predecessor `3bff1f0340a57870ca94cb851d750fd5c5d5f18e`. It records nine exact transitions and refreshes nine current-source pins. All 480 evidence entries and 575 observations retain their previous support claims. Earlier receipts, archived sources, and execution records remain unchanged.

Nix is not installed in this local environment. These checks verify the filtered source closure and actual Node imports, not a new Nix build or hosted browser execution. Hosted confirmation remains required. The change does not add nominal Subtype acceptance for browsers or complete #1444 or #1446.
