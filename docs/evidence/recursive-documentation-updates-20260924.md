# Documentation and registration evidence for recursive packages

The [review record](recursive-documentation-updates-20260924.json) separates
documentation changes from compiled-source verification. It retains exact
reversible edits for the C#, Java, Kotlin and PHP consumer guides, Binding IR
architecture, contributor testing instructions and documentation assertions.
The complete documentation run passed all 45 tests without skips.

The registration history retains every original receipt and registration entry.
New test and source registrations are additive. The verifier rejects removed or
modified historical entries, duplicate steps, unrelated document edits and
unknown predecessor hashes. It does not admit production-code changes.

Kotlin and PHP-Wasm collection checks now use the separately measured shared
backend regressions. The Composer check uses this documentation record alongside
its original compiled-package evidence. Exact checker reversals preserve each
complete prior test module apart from its source-verification integration.

```sh
node --test tests/current-source-evidence.test.mjs
```

The original package receipts and their execution observations remain unchanged.
