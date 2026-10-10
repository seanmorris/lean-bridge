# PHP-Wasm Subtype entry checks in CI

The PHP-Wasm consumer job now runs both installed entry-probe routes, checks their
original TAP and paired reports, and uploads the complete probe output directory.
The existing uninstrumented Fin and Subtype gates remain unchanged.

The job prepares a fresh shared runtime from its pinned Lean archives before the
probes run. It passes that runtime path explicitly to the producer. The preparation
log, TAP, reports, C inputs, reversible probe insertions and compiler sidecars stay
in the job's unconditional artifact upload. Preparation, producer or checker
failure stops this sequence and reaches the existing final PHP failure check.

## Local checks

The [retained records](php-wasm-entry-ci-20261010/index.json) contain 34 files,
including the workflow, helper sources, original validation logs, runtime attempts
and independent Git audit. The index SHA-256 is
`e368288092502b3f6f474d4442fbce17711cc36abf2a0ac0bb1782d7b78020c1`.

- The final six-root regression passed 218 tests, failed none, and skipped 15
  explicitly gated compiler/installed tests. Its TAP SHA-256 is
  `907486cb77198661568db54f00056c7ebb74f84ac57af6935dda1e511f9a1ac4`.
- Ten focused CI/history controls passed without failures or skips. They cover
  changed workflow gates, incomplete or skipped TAP, actual Bash failure
  propagation, malformed CLI arguments, and an existing runtime output directory.
  The Bash controls use a synthetic Node executable and make no PHP/Lean execution
  claim. The first draft's TAP-header mutation failure remains in the archive.
- Full lint, checked JavaScript and all 16 generated reference checks passed.
- The Git audit preserves all 5,389 earlier evidence files. Ten exact source
  transitions refresh 98 inventory source pins. All 407 evidence claims and 509
  observations remain unchanged.

The [source-history ledger](php-wasm-entry-ci-source-history-20261010.json) has
SHA-256 `bb2792c47e1727b1c955e311f91dd28d1e6ed3d6d53e11b24aef4e4d471c9b4f`.

## Actual runtime preparation

The new preparation script built and verified a fresh shared runtime. Its complete
verified manifest matches the runtime used by the
[installed ordinary/reviewed probes](php-wasm-subtype-entry-installed-20261010.md):
`44535fd7b0e510b50f3aae5e2134970012d90e9f6be04048a04dce85bddbd966`.

The successful local attempt used the supported `LEAN_BRIDGE_PHP_LEAN_RUNTIME`
override to select the retained pinned archives. All 22 archive/header inputs
matched the earlier runtime before compilation. CI creates its default archive
directory in the preceding ordinary-PHP-Wasm step. No workstation path was added
to the workflow. The local build started with 2,071 MiB free, reached a minimum of
1,909 MiB, and did not trigger the 768 MiB stop floor.

The first two attempts failed before compilation because the local default
directory was absent and a second retained directory lacked `libInit.a`.
Their original runners, logs and terminal records remain alongside the successful
third attempt. No missing input was replaced with an unchecked runtime.

This milestone verifies CI wiring and runtime preparation locally. It does not
rerun the installed probes, whose original successful records remain in their
separate archive. Hosted acceptance of these new commands is pending. The older
PHP-Wasm job in run `38051564992` passed at `b8765be`; that revision does not contain
these new commands.
