# Contract corrections after owned Perl integration

The full repository regression at `20d9504` exposed two outdated evidence tests.
Neither failure came from executing a Lean algorithm or an installed package.

The recursive C# CI assertion still required the old 90-minute Perl job timeout.
The expanded job has a 120-minute limit. The corrected assertion requires that
limit and checks all nine owned Perl suites alongside the four existing copied
suites.

The C# callback verifier compared current source bytes directly with its frozen
receipt. Owned Perl integration changed `elaborated-component.mjs` and
`owned-native-model.mjs`, and its accepted history records both exact changes.
The verifier now uses the existing ownership-history resolver to reconstruct the
recorded bytes. It checks byte length and SHA-256 after that reconstruction.
Unknown source changes still fail.

Both original failures were reproduced independently. Each corrected targeted
test passes. The successor record
`perl-contract-repair-20260928.json` binds the reproduction and acceptance logs,
the explicit source edits and their accepted predecessor hashes. It also records
the new test registration and refreshed live source digests. No type-surface
cells, compiled algorithms or prepared package artifacts change.

The frozen `owned-perl-integration-20260928.json` remains byte-for-byte unchanged.
Its source verifier follows only the successor's exact, recorded edits. Negative
tests reject substituted predecessors, unrecorded source bytes, unknown edit
paths, changed execution logs and inflated scope.

Run the focused regression with:

```sh
node --test --test-concurrency=1 \
  tests/perl-contract-repair-evidence.test.mjs \
  tests/dotnet-recursive-callable-evidence.test.mjs \
  tests/owned-dotnet-callback-evidence.test.mjs \
  tests/owned-perl-package-evidence.test.mjs
```

VO1219 remains open for the remaining PHP, JS/Wasm and selected WIT/WASI
ownership adapters, transferred inputs and anchored results.
