# Full test suite at 1e26785

Status: passed. This record covers commit `1e267853f9c28c42ec8eecdc8787f783fa2878e4`, which completed Virtual Office nodes 790, 797, and 798.

## Result

| Field | Value |
|---|---|
| tests | 311 |
| passed | 311 |
| failed | 0 |
| cancelled | 0 |
| skipped | 0 |
| todo | 0 |
| JUnit duration | 20,223.781 ms |
| JUnit SHA-256 | `66ab3f7f72b72e08ce12f832b039e1e0cd73662bbcedcf3a6ae4693e342070a5` |

The [JUnit record](test-suite-1e26785.junit.xml) lists every test name and duration. It ends with the Node test runner's counts. A reviewer can check the count and absence of failures with:

```sh
rg -c '<testcase ' docs/evidence/test-suite-1e26785.junit.xml
rg '<failure|<error' docs/evidence/test-suite-1e26785.junit.xml
sha256sum docs/evidence/test-suite-1e26785.junit.xml
```

The expected outputs are `311`, no matching failure line, and the SHA-256 above.

## Commands

The full gate built the synthetic link probe, browser Lean runtime and side modules, threaded Lean runtime and side modules, and the canonical performance components before running every tracked test:

```sh
npm test
```

After that gate passed, the following command replayed the 311 test files tracked by the exact commit and wrote the review artifact:

```sh
mapfile -t LEAN_BRIDGE_TEST_FILES < <(git ls-tree -r --name-only 1e26785 tests | rg '\.test\.mjs$')
node --test \
  --test-reporter=junit \
  --test-reporter-destination=docs/evidence/test-suite-1e26785.junit.xml \
  "${LEAN_BRIDGE_TEST_FILES[@]}"
```

The JUnit replay used the artifacts produced by the preceding `npm test` run. It verifies the behavioral and structural test set again. It does not claim to be a second clean build or reproducibility result.

## Environment

| Tool | Version |
|---|---|
| Linux | 6.1.0-31-amd64, x86-64 |
| Node | 22.23.1 |
| Lean | 4.32.2, commit `f3b06c705e6c85f5314019d5d3baab0fec5b580c` |
| Emscripten | 6.0.6, commit `ce75e06884093bcefb86a6b8fd56a5d62a4cc245` |
| wasm-tools | 1.245.1 |
| PHP | 8.2.32 NTS |
| clang | Debian 14.0.6 |

This is a test execution record. The repository's separate reproducibility gates determine whether independent clean roots produce identical release artifacts.
