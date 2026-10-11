# Source history and filtered engine prerequisites

## Hosted Rust failure

[Rust job 114537520922](https://github.com/seanmorris/lean-bridge/actions/runs/38162208580/job/114537520922) failed at `b0cabee3ac47be0feeb4cf7154b3ce32ecfa56f5`. Its checkout fetched depth 1. Two source-history tests could not read the original Git files at `6f4aeaf349a0b696650e43a5aa677a1f073e869d` and `a1916306286ae10ce6568e94116fdc2f6b1d7411`. The log contains no other failing test. This failure does not establish a Rust runtime defect.

Original log: `build/vo1220-rust-114537520922.log`, SHA256 `c643eaafc89fb34c8aaa0edd76b1f6b8c32bb1a7fa242c4b5fb35377eae2a4ad`.

The local reproduction used the unchanged test files at `616dd5e` with an isolated depth-1 Git object store at the original CI commit. Both exact-history tests failed. Exposing the full repository's objects through `GIT_ALTERNATE_OBJECT_DIRECTORIES` made both pass without changing test files or HEAD. This control changed object visibility; it did not run the full historical checkout or rebuild a package. The isolated store occupied 636 KiB.

- Reproducer: `build/check-vo1220-native-history.mjs`.
- Failure TAP: `build/vo1220-native-history-shallow-r1.tap`, SHA256 `77a12e275f003e70b9e0390c5bec92acec3ba5660f531949acb887dc4b20e63f`.
- Successful TAP: `build/vo1220-native-history-full-objects-r1.tap`, SHA256 `4a679ab3f8cfb06da7b4187b69b03f2f657042121d8f3f46b35f092008d36202`.

The native consumer matrix now fetches full history for C/C++, Python and Rust. Native and managed jobs check that the checkout is not shallow before installing Node, Nix or any package. Managed jobs already fetched full history. The registered regression rejects 26 weakened workflow variants and executes the preflight against a real tiny depth-1 clone, then the same HEAD after `git fetch --unshallow`.

## Filtered Nix engine

The focused regression found a separate omission from `66639dd`: its three new mirror helpers were not in `nix/perl-engine-source-boundary.json`. Importing the filtered engine failed on `src/build/refinement-mirrors.mjs`. The manifest now also includes `src/build/component-refinement-mirrors.mjs` and `src/build/component-fin-guards.mjs`, the other two missing imports.

The engine import and CLI startup checks pass. Removing each helper independently makes the import fail; restoring it makes the import succeed. The existing missing Fin-diagnostic control remains. The first failed attempt is retained in `build/vo1220-native-history-focused-r1.tap`. No Nix package rebuild or installed support promotion is claimed.

## Verification and history

The initial Nix/history and Perl contract regression passed all 57 tests with no skips. The final targeted workflow, source-history, filtered-engine and inventory regression passed all 54 tests with no skips, including the real shallow-clone preflight control. TAP: `build/vo1220-native-history-regression-r2.tap`, SHA256 `38f16bc3c1c519a5e1c783d1e6d3f0fa62587c18ac43e7094da3c2f39be4424a`.

The earlier broad archive-mutation sweep was stopped to reduce host load. Its partial `build/vo1220-native-history-regression-r1.tap` is not acceptance evidence. Checks ran serially at low CPU and I/O priority, with the final regression limited to one CPU. Targeted lint, checked JavaScript types and all 16 generated references passed. Workflow actionlint passed with ShellCheck and Pyflakes integration disabled.

The immutable ledger records six exact transitions from `616dd5ee55dfe8ca1adbb126f448e6af25ec27ba`, updating 110 current-source pins only. Its SHA256 is `1918172bcc7e6ec1b4dd9633b224855164c57215a0e81399f6a4a4759914f080`. All 472 evidence entries and 571 observations retain their support claims. The boundary change adds exactly the three imports above. The independent audit checks all twelve changed or added paths and preserves all 10,049 older evidence files. Hosted confirmation requires a run containing this repair.
