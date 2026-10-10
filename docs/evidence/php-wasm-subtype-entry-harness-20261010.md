# PHP-Wasm Subtype installed entry-probe harness

This milestone prepares ordinary and independently reviewed probe packages for
the installed PHP-Wasm test matrix. The installed gates have not run at this
milestone. The earlier one-root measurements remain in
[the probe record](php-wasm-subtype-entry-probe-20261010.md).

## Implementation

The portable builder reproduces the earlier probe's Lean source and 55 selected
function definitions. It records reversible source annotations, original and
instrumented C inputs, compiler arguments, object hashes and the linked Wasm
identity. The ordinary package receipt authenticates the instrumented artifact;
a separate sidecar identifies its probe scope. Production build code is unchanged.

The installed tests build each route from two independent author directories,
compare package receipts, remove those directories, and install only the handed
off archives with compilers unavailable. The existing installed harness checks
offline npm/Composer installation, relocation, unchanged deployment files, startup
and lazy loading, and repeated execution in Node and Chromium.

An explicitly selected probe driver runs the complete original weak or strict PHP
caller: 2,024 assertions and 2,030 public calls, including 1,000 invalid/valid pairs.
It checks the exact constructor, validator, adapter and source-entry sequence,
then checks a separate unrefined positive control. Missing markers, altered call
sequences, incomplete assertions and incorrect control results fail the test.
The ordinary driver still requires empty stderr and is byte-identical to its
predecessor. Synthetic driver tests do not establish PHP or browser execution.

## Validation

- Integration: 186 passed, zero failed, 15 explicit compiler/installed skips.
  TAP `build/vo1443-entry-harness-integration-r1.tap`, SHA-256
  `96ca59c1f46fe718154e774f5761ded75938e4128f966190fd68d2241379184e`.
  The command also named a nonexistent copied-acceptance root. No coverage is
  attributed to that name; the actual copied-package root ran separately.
- Copied-package regression: eight passed, zero failed, zero skipped.
  TAP `build/vo1443-entry-harness-package-r1.tap`, SHA-256
  `ed44477a3272b9b834e3bf23410edea52572a708ca231c9e6a35848eb36e7546`.
- Full lint, checked JavaScript and all 16 generated reference pages passed.
- Independent Git audit: eight exact source transitions, eleven source-pin
  updates, 5,273 older evidence files unchanged. All 407 evidence claims and 509
  observations retain their scope. Audit log
  `build/vo1443-entry-harness-audit-r1.log`, SHA-256
  `f46dcbc3cd4adddc14f9c0049f66a2b11f2aea28deae2995679b7ec8a49e5c9d`.

The new source-history ledger is
`php-wasm-entry-harness-source-history-20261010.json`, SHA-256
`389a5db323ff45c03c1e931d0a6bcd402d15fb85a26385b54bf000b12a0d40fe`.
Its exact predecessor is `fc19615384b3f65de389c8c203e4cd67f3c124b0`.

## Remaining acceptance

Run both installed gates against a committed producer. Authenticate their reports
and probe sidecars independently, retain original failures and successes, add
corruption controls, and wire the accepted gates into CI. This harness milestone
does not close #1443, #1444 or #1220, or reduce their remaining host, nested,
nominal, graph, owned, callback and dependent-type requirements.
