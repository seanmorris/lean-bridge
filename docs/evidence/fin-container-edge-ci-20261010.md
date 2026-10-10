# Native Fin container-edge CI

The downstream consumer workflow now requires measured installed-package checks for C, C++, Python 3.11 and 3.12, Rust, Ruby, .NET, Java, Kotlin, native PHP and WIT/WASI. Each selection builds the canonical package twice, removes its author roots before installation, and checks offline consumption, relocation and unchanged installed files.

Each producer runs the exact installed test in `tests/fin-container-edges.test.mjs` with `LEAN_BRIDGE_FIN_CONTAINER_EDGE_DISPATCH=1`. The same step requires a nonempty report and invokes `scripts/check-fin-container-edge-report.mjs`. Python selections bind the corresponding interpreter and require its version in the checker. Debugger-based observers require GDB. A failed producer or checker fails the consumer step and its job. The workflow records the commands and uploads the original reports, including on failure.

These selections cover ordinary-source packages. Reviewed IR keeps its existing tests and requirements. The original scalar, container, product and record gates remain in place.

## Verification

The focused workflow/history run passed seven tests without failures or skips. The four-root integration run then passed all 24 tests without skips, including the existing report mutation controls, current source pins and historical report checks:

```sh
node --test --test-concurrency=1 \
  tests/fin-container-edge-report.test.mjs \
  tests/fin-container-edge-integration-history.test.mjs \
  tests/helpers/native-fin-diagnostic-ci-tests.mjs \
  tests/fin-container-entry-ci.test.mjs
```

The workflow tests reject missing observations, missing checker commands, omitted uploads, weakened failure enforcement and wrong Python floors. Actionlint and focused ESLint passed. These checks validate CI wiring; the new workflow still needs a hosted run.

The immutable CI history ledger records seven exact source transitions from `b70f471bdd0aa3e173e6ba75a46847ed72f4f73b` and refreshes 92 current source pins. It changes no previous observations or support claims. Earlier ledgers and archived execution records retain their original bytes.
