# Repair standalone CLI imports and the documentation CI check

Predecessor: `32d235a179a0aad87f4e709fd6dd1b3bfd26a9dc`.

Downstream run [38191944833](https://github.com/seanmorris/lean-bridge/actions/runs/38191944833)
at `875fbc9fb3191ad9eea959499abca5c01e631394` exposed two failures.

The standalone CLI package omitted `component-fin-guards.mjs`,
`component-refinement-mirrors.mjs` and `refinement-mirrors.mjs` from
`config/cli-package.v1.json`. The ordinary and reviewed CPAN receiver tests
installed that CLI successfully, then its build command failed while importing
the missing modules. The root npm manifest already included those files.
The repair adds the three files to the standalone package allowlist.

The documentation test passed a partially reconstructed workflow to the native
CI history checker. That checker authenticates complete-file digests before
reconstructing an earlier version. The partial input could not match its recorded
history, so the check compared the current native timeouts with an older budget.
The repair passes the original complete workflow to that checker. Existing
current-budget and failure-enforcement assertions remain unchanged.

## Reproduction and regression checks

Both failures reproduced locally before the repair. The standalone package's
actual build imports passed after the allowlist change; the focused documentation
check passed after receiving the complete workflow.

The new CLI regression installs the real archive offline into a separate
consumer, removes its packaging output, and imports both build modules in a fresh
Node process with an unavailable tool PATH. Removing each of the three dependencies
must fail with the corresponding missing-module error. Restoring them must pass.
An independent syntax-tree import-closure check also refuses every omitted build
dependency.

The CLI, documentation and source-history regression passed all 58 tests without
skips. Checked JavaScript and all sixteen generated reference checks also passed.
The broader refinement, engine, test-registration and inventory regression passed
139 tests, with no failures and thirteen explicitly gated compiler/installed
tests skipped. Scoped lint and the independent source-history audit passed.
These checks verify the CLI installation and imports; they do not claim a new
compiled receiver-package execution or a successful hosted rerun.

Original local logs and SHA-256 digests:

- `build/ci-38191944833-documentation-repro-r1.tap`:
  `90a47368b555d1d1691d8d7a156b54ecdc5546ff1c06e35bec57ab39e3872f46`.
- `build/ci-38191944833-documentation-fixed-r1.tap`:
  `735542269add965a3a7a4ba4e6c0ba3184c6845f77d42ef554f1707dbf11a121`.
- `build/ci-38191944833-cli-repro-before.json`:
  `6f3f52dc53e0cf89eb9c6f11a2a0b9ff3dc703f7dffbf4ed40063199109f0134`.
- `build/ci-38191944833-cli-repro-after.json`:
  `6a9b54c99011babc202336459b1d33be6e8f3ad2c4cb3900336f6e550289fb2e`.
- `build/ci-38191944833-repair-regression-r2.tap`:
  `f85f62877f7dc622164c2ae5b3d62f6d559cb2e4d6490bb2b285926d9c654a7a`.
- `build/ci-38191944833-repair-broad-r1.tap`:
  `650af6a2cc55380cc024b016991face507f5e517c2dcd17d431d07d58563d85b`.

## Preserve earlier evidence

The [source-history ledger](cli-import-repair-source-history-20261012.json)
records ten exact transitions against the predecessor Git blobs. Its SHA-256 is
`7789ae88905e0ed630be1a1392f3a55fa5d93d6e2c2099dc45839953c787b969`.
The inventory refreshes 45 matching current-source pins. All 480 evidence entries
and 575 observations retain their support claims. Earlier archives and ledgers
remain unchanged.

The independent audit reconstructs each predecessor without importing the new
history helper, checks the three-file allowlist addition, and compares all other
inventory content. Audit log `build/ci-38191944833-independent-audit-r2.json`
has SHA-256 `2b5a195e488314e33dd37bce4bbd1af02177f044d82d24bd22bb406cdb522ffb`.

The initial combined regression exposed a test that selected historical CLI
manifests by array offset. The final test selects each required predecessor by
its authenticated digest and retains the same file-presence and forged-manifest
checks. The new immediate predecessor remains available for earlier receipts.
