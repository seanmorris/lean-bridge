# Reviewed Subtypes in installed native packages

Independently reviewed packages passed the twelve-export checked-Subtype corpus
on these native profiles. Each run reproduced package archives in two author
roots, removed the author roots before offline installation, moved the installed
package and replayed the unchanged caller without a compiler.

| Profile | Checks per execution | Original evidence |
| --- | --- | --- |
| Python 3.11.16 and 3.12.14 | 2,025 on each version | [Python archive](reviewed-subtype-python-hosts-20261010.md) |
| Rust | 2,026 | [Remaining native hosts](reviewed-subtype-remaining-hosts-20261010.md) |
| C# / .NET | 2,024 | [Remaining native hosts](reviewed-subtype-remaining-hosts-20261010.md) |
| Java | 2,024 | [Ruby and JVM archive](reviewed-subtype-ruby-jvm-hosts-20261010.md) |
| Kotlin | 2,023 | [Ruby and JVM archive](reviewed-subtype-ruby-jvm-hosts-20261010.md) |
| Ruby | 2,024 | [Ruby and JVM archive](reviewed-subtype-ruby-jvm-hosts-20261010.md) |
| Native PHP, weak and strict callers | 2,024 | [Remaining native hosts](reviewed-subtype-remaining-hosts-20261010.md) |
| WIT/WASI | 2,031 | [Remaining native hosts](reviewed-subtype-remaining-hosts-20261010.md) |
| Perl 5.36.3 and 5.38.2, threaded and unthreaded | 2,025 on each ABI | [Remaining native hosts](reviewed-subtype-remaining-hosts-20261010.md) |

The fixtures check Subtype parameters and results over `String`, `Nat`, `Int`,
`ByteArray` and `UInt8`, distinct
checked constructors for two instantiations of one generic, normalization,
mixed Fin/Subtype arguments, a zero-argument refined result, caller input
preservation and 1,000 rejection/recovery pairs. Each independent review
reconciles with fresh Lean compiler metadata. Errors name the reviewed
parameter and selected constructor.

Twelve evidence entries support nine observations in
[the type inventory](../type-surface.v1.json): eighteen parameter/result cells
on the reviewed-IR route. Both Python versions contribute to one Python
observation; all four Perl ABIs contribute to one Perl observation. Java and
Kotlin use their separate results from the shared JVM run. Earlier observations
remain unchanged.

These local runs use a glibc 2.36 package floor. They do not establish a later
hosted CI revision or another platform floor. Dispatch counts were not measured.
The archives retain original reports, selected producer sources and package
digests, but not package binaries or a complete toolchain closure. Their readers
open repository-relative archived files; recorded absolute producer paths are
provenance only.

Reviewed browser pages, React and workers, nested or nominal-field Subtypes,
refined callbacks, owned transports and broader generic Subtype combinations
remain separate work under #1444. This promotion does not close that task.

## Promotion checks

The source-history ledger records twenty exact transitions from
`7b56b06f8a8d1be86810bf71e0727d8a097d21d0`. Its SHA-256 is
`362add972169dd0f47c9d48ad1647dbc101acc6df1df822c7387b8178c9d10e7`.
The independent Git/inventory audit checks every predecessor, preserves all
407 previous evidence claims and 509 observations, and permits only 81
current-source pin updates before the twelve new entries. It also checks all
5,826 older evidence files against their Git blob identities.

The final affected regression runs these roots with `node --test --test-concurrency=1`:

- `tests/reviewed-subtype-installed.test.mjs`
- `tests/type-surface.test.mjs`
- `tests/lean-author-documentation.test.mjs`
- `tests/helpers/fin-history-buffer-repair-tests.mjs`
- `tests/helpers/refinement-followup-history-tests.mjs`

Result: 140 tests, 136 passed, zero failed, four explicit installed/compiler
skips. Original TAP: `build/vo1444-native-subtype-promotion-affected-r4.tap`,
SHA-256 `81920aaf1b4429b408dd261aa9f3408307c9fde5931b4802add56ca68622747c`.
This regression authenticates the earlier installed archives; it does not
rerun their producers.

Full repository lint, JavaScript typecheck and all sixteen generated reference
page checks passed. The independent audit output is
`build/vo1444-native-subtype-promotion-audit-r4.json`.

Two history checks used incomplete filename lists to decide whether to decode
Buffers. Both now use the authenticated source-history reader and each recorded
stopping digest. Unknown edits still fail. The Fin 0 history checks now run from
the registered reviewed-Subtype contract root.

Earlier attempts remain available with their original results:

- Seven-root baseline: 785 passed, one failed, 26 gated skips. The failure was
  the reviewed-host Buffer reader. `build/vo1444-native-subtype-promotion-registered-r1.tap`,
  SHA-256 `e2d72fbd2ff15a0864b00936bcaca9dc062f87a4ad3a3104292d66e51e64daa9`.
- Fin 0 reproduction: four passed, one failed, no skips.
  `build/vo1444-native-subtype-promotion-fin-zero-repro.tap`,
  SHA-256 `263e08cabae1c67051ae6cb17c6bd11e3c9039e07d9ba090e7b14bac222c1778`.
- An affected rerun started before the draft ledger refreshed. It failed on
  stale hashes and was stopped; it is not acceptance evidence.
  `build/vo1444-native-subtype-promotion-affected-r2.tap`,
  SHA-256 `5e6e09aed714f6e367706796a315947341b0a169bb65ad16fcbc60c018b45224`.
