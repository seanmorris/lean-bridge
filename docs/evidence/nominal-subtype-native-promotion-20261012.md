# Nominal Subtype C/C++ support and documentation

This milestone records the [four installed C/C++ selections](nominal-subtype-native-acceptance-20261011.md)
in the support inventory and documentation. It supersedes that checkpoint's
pending inventory update. The original package executions and archive remain
unchanged.

## Support change

Four evidence references authenticate the ordinary/reviewed and full/result-only
selections at producer `f2600a5efb6f8e0a64c0ed9f6903bf75f40ea332`. Each reference
checks the original archive, selected Git source snapshots, compiler records,
package receipts, observed runtime, source-free installation and relocated
execution. The sixteen retained executions contain 49,420 assertions.

Only `c` and `cpp` support cells change:

- Eight existing Subtype input/result cells retain their earlier evidence and
  gain nominal and constructor-free result checks.
- Four field cells gain installed acceptance for the tested Nat Subtype fields
  in acyclic copied records and variants, on both source routes.
- All other profiles and callback positions remain unchanged.

The inventory contains 480 evidence entries and 575 observations. The added
scope names C11/GMP, C++20, Linux x64/glibc 2.36, GCC 12.2 and Lean 4.32.2.
It covers repeated and nested records, active variants, aliases, structural
containers, per-use normalizing constructors, mixed Fin guards and exact
100-bit results. Standalone result-only packages select no input constructors.

Other primitive-base nominal fixtures, other native hosts, refined callbacks,
owned, recursive, dependent and broader generic Subtypes remain pending.
Constructor/source entry counts and memory are unmeasured. These runs do not
establish a hosted release floor. Package binaries and full toolchain closures
are not archived; original receipts, hashes, selected sources and execution
records are retained.

The C and C++ consumer guides, both author guides and generated reference now
describe this scope. The author matrix distinguishes C/C++ from the other native
hosts. The earlier Node acceptance remains intact.

## Verification

An initial focused native/npm promotion and source-history run passed twelve tests with
zero failures or skips. Log:
`build/vo1444-nominal-native-promotion-focused-r1.tap`, SHA-256
`6f67f9c24abfc729e39432ff24a26e24eb029d726203517217db0799c132b116`.

The final combined component, author, source-history, inventory, registration,
consumer-guide, generated-reference and structural-archive regression passed
228 tests with zero failures. Ten explicit build gates were skipped: two
existing fresh-Lean/compiler cases and four npm plus four native installed
selections. All eight installed selections have their separate original
acceptance records. The final run includes all twenty-four structural archive
selections across seventeen profiles and both PHP replay repairs below.
Log: `build/vo1444-nominal-native-promotion-final-r1.tap`, SHA-256
`346165bfdf8de0beba57dfa31edac9564816822cc3547de713d1d0fb536f2f84`.

All sixteen generated reference pages, checked JavaScript types, targeted ESLint
and diff checks pass. Verification used CPU 3 at nice 19 with idle I/O priority.

The promotion checks reject missing or corrupted original records, substituted
scope, runtime or counts, reordered/incomplete references, duplicate promotion
and overlapping observations. They compare every inventory cell and require
exactly the twelve C/C++ changes above.

An expanded structural-reference regression found two failures in the older
PHP report checker. It generated expected public API text with the current
generator, while the archive came from
`79dbeb20fdbab984500dcd420c770a807bf8ac40`. Commit `8af7aea` had corrected result
comments to describe projection instead of an input-constructor check.

The checker now imports the producer's complete 22-module JavaScript closure
from exact Git blobs into a temporary directory and removes that directory
after loading. It neither changes the archived API nor compares it with a
mixture of old and current generator modules. Both original PHP routes pass.
Four PHP evidence tests passed, including 216 missing/corrupted-original
controls, 70 coordinated report controls and six substituted-API controls.
The latter change documentation, a dispatch target or a named constructor,
with a matching manifest hash, and must fail the producer-API comparison.
Log: `build/vo1444-nominal-native-promotion-php-replay-r1.tap`, SHA-256
`1b0660f50f7f0df7c18bbe479ea65254bcd81f1557ab77c455425acefe30cbcf`.

The PHP-Wasm structural checker had the same current-generator dependency.
It now replays its producer `662cba28640b35b5708a8cba5116e9a0de2bf2ea` through
the same isolated module loader, including the producer's 32-bit PHP model.
The tests compare the embedded and Composer API identities against that
producer and explicitly distinguish today's result comments.
The combined nine PHP/PHP-Wasm evidence tests passed without skips. Their log is
`build/vo1444-nominal-native-promotion-php-replay-r2.tap`, SHA-256
`1bae05b3b270ddc9cb59e3650c39128279f12337717c6d7a06d552dc66d5cd17`.

The immutable source-history transition records nineteen exact changes from
`4d9424e6c1fa551d0c6802d39ee7c5d469ed8c23` and refreshes 177 current-source pins.
Its SHA-256 is
`b1a128529734fa9e25b09f2b125ce27ccf34ef92599587a10904abefd366f4e2`.
The writer refuses a different predecessor and refuses to rewrite a committed
ledger. All 10,347 earlier evidence files remain unchanged. No production
compiler, workflow or earlier package receipt changes in this milestone.

Required recurring nominal npm/native execution, measured entry probes, the
remaining consumers and the original broader Subtype requirements remain open
in VO #1444.
