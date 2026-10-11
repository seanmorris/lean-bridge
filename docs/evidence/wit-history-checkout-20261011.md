# WIT consumer source-history checkout

[WIT job 114537520796](https://github.com/seanmorris/lean-bridge/actions/runs/38162208580/job/114537520796)
failed at `b0cabee3ac47be0feeb4cf7154b3ce32ecfa56f5` because its depth-1
checkout omitted Git objects needed by two source-history tests. The missing
files were:

- `6f4aeaf349a0b696650e43a5aa677a1f073e869d:tests/helpers/checked-record-browser-history.mjs`
- `a1916306286ae10ce6568e94116fdc2f6b1d7411:nix/perl-engine-source-boundary.json`

The earlier native-job fix did not change the separate `wasi-consumer` job.
Its checkout now fetches full history and rejects a shallow repository before
installing Node, Nix or any package. No runtime, package or support claim changes.

## Reproduction

`build/check-vo1444-wit-history.mjs` reproduced both failures with the unchanged
current tests and an isolated depth-1 Git object store at the original CI HEAD.
Exposing the full repository's objects through
`GIT_ALTERNATE_OBJECT_DIRECTORIES` made both tests pass. The control changed
object visibility, not test files or HEAD; it did not build a package. The
temporary object store was removed after verification.

- Original hosted log: `build/vo1444-wit-114537520796.log`, SHA-256
  `e2b5034506e50c422e2897e81a67f0747dfb451d2cb91d77f97d701d9a6a4b0a`.
- Failing control: `build/vo1444-wit-history-shallow-r1.tap`, SHA-256
  `e542da5472f302446e18e6875c4e0fa22924df9731183a0442917d34288974c9`.
- Successful control: `build/vo1444-wit-history-full-objects-r1.tap`, SHA-256
  `449a6bb09044f2d09b3a8330ec57cfb234d3810207062df8802a5d2201e29c32`.

## Regression and preserved evidence

The registered workflow regression now covers native, managed and WIT consumer
jobs. It rejects 39 weakened checkout/preflight variants and runs the shared
preflight in a real shallow clone, then at the same HEAD after unshallowing.

The workflow, source-history, filtered-engine, inventory, generated-table and
test-registration regression passed all 117 tests with no skips. Checks ran
serially at nice 19, idle I/O priority and CPU 3. The log
`build/vo1444-wit-history-regression-r2.tap` has SHA-256
`b8898b0fa1ddc20ce7fbc4708d2879ff044207bad13cbcafa035aeca953e92b9`.
Targeted lint and all 16 generated-reference checks passed. Actionlint passed
with ShellCheck and Pyflakes integration disabled.

The immutable source-history ledger records six exact transitions from
`9784c95ab51c804a4ad0c01c8a94236b1a7865a6`. It refreshes 92 current-source pins
without changing the 472 evidence entries or 571 observations. Its SHA-256 is
`0d5d9c9682e76601040cd51e8928395bc4207e4165ef1273f722176206b4ec59`.
All 10,194 earlier evidence files remain unchanged.

Hosted confirmation requires a run containing this repair. The PHP-Wasm, Ruby
and .NET jobs from the current run remain undisturbed.
