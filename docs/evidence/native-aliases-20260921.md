# Compiled C/C++ aliases, 21 September 2026

C/C++ packages preserve concrete copied Lean aliases in their public headers.
C uses `<prefix>_<snake_name>_t` typedefs. The `_t` suffix permits a source alias
`Rows` and a function `rows` in the same package. C++ uses source-named `using`
declarations. Aliases reuse their target's storage and conversions; they add no
runtime wrapper. Canonical Binding IR retains the source names and alias chains.

C aggregate aliases provide initialization and cleanup helpers. GMP integer
aliases use `mpz_t`; aggregate helpers initialize and clear nested GMP values.
Aliases keep the target's copied ownership, input validation, 32-level type bound
and shared 16 MiB conversion budget. C++ values own their contents and clean up
automatically. Public-name collisions reject before packaging.

The [installed package record](native-aliases-20260921.json) covers 27 aliases,
all nineteen primitive parameter/result/record-field payloads, chains, copied
records, arrays, Lists, nested options, results and products. Both ordinary-source
and independently reviewed builds pass 720 C and 366 C++ checks. Static type
assertions check all nineteen public primitive aliases. Lean independently checks
field payloads, including eighteen single-field mutations that must fail.

Runtime checks cover 5,121-bit integers, native word endpoints, Unicode/NUL,
independent returned copies, all three nested `Option Unit` states, both result
branches, negative `Nat`, invalid character and Unit inputs, invalid UTF-8,
IEEE endpoints, repeated oversized input/output failures and recovery. C aggregate
aliases exercise repeated cleanup. These alias checks do not claim allocation
fault injection or sanitizer coverage.

The test removes producer sources before offline installation. Consumers compile
against their prepared archives, then execute without Lean or a compiler on PATH.
Each application chooses an executable-relative library path, relocates its
complete installed directory and repeats the same checks without a loader-path
override. Every installed package file is reverified against its receipt after
relocation. Native library bytes agree across the two build paths; the record
retains all four original archive identities.

```sh
LEAN_BRIDGE_NATIVE_ALIAS_TEST=1 node --test tests/native-aliases.test.mjs
node --test tests/native-alias-contract.test.mjs
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 \
node --test tests/compiler-alias-metadata.test.mjs
```

Consumer CI requires the installed test and uploads `build/aliases/native.json`.
Inventory 0.46.0 promotes twelve C/C++ alias parameter/result/field cells, reaching
3,720 of 6,562 installed-tested cells. Aliases in the other ten consumer profiles,
native variants, bounded recursion, compound callables and explicitly owned
identity aggregates remain in VO1219 and related work.
