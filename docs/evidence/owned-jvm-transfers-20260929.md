# Java and Kotlin consuming inputs

VO task: 1219. Baseline: `7dd8a21aa6a245693fbd27fbadb3895b10b8d174`.

This milestone implements author-selected input ownership transfer in generated
Java and Kotlin APIs. Consumers pass the same typed values they use for borrowed
inputs. The generated binding validates the complete call, prepares independent
native snapshots, and records which original resource leases belong to each
consuming argument. Lean's handoff consumes those leases. Java/Kotlin aliases
observe the same closed state, including inside a reentrant callback.
Independent `retain()` results remain usable.

The implementation rejects expired callback borrows and one lease assigned to
two consuming arguments. Repeating an identity within one argument is allowed.
Validation and preparation failures preserve the original inputs. Failures after
the handoff do not restore ownership. Shared handoff slots make `isClosed()`
observable from other threads; the creator still owns native calls and cleanup.

## Acceptance

Run from the repository with JDK 22, Kotlin 2.2.0, Maven and the pinned Lean/native
toolchains configured:

```sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-jvm-transfers
```

The gate passed all seven tests with no skips. It compiles both ordinary Lean
source and independently reviewed contracts.
Each contains 26 exports, including 20 consuming calls. It covers resource and
closure identities, mixed borrowed/consumed arguments, arrays, Lists, options,
results, products, records, aliases, every selected variant constructor and
recursive values. Mixed scalar payloads preserve exact integers, float bits,
Unicode, byte arrays and nested option distinctions.

Private Java and Kotlin probes sweep managed and native failures before and
after single- and multiple-input handoffs. Exceptions remain strongly reachable
while the probes check explicit cleanup. Callback tests exercise reentry,
foreign-thread observations, independently retained borrows, closure captures,
and interrupted creators. Native counters detect leaks and failed thread exits.

Each source path passed 1,244 private Java and 1,243 private Kotlin checks,
including all eight fault categories in each language. The probes ended with
zero tracked live allocations, zero identities, four successful thread exits
and zero thread-exit errors.

The package gate compiles Java/Kotlin consumers without producer sources,
installs each prepared JAR/POM into an empty offline Maven repository, checks
every exported signature, and rejects ill-typed consumers. It removes producer,
consumer source and handoff directories before two identical executions on a
runtime-only Java installation. Both consumer guides' exact examples execute
there too. The gate also checks byte-identical package reassembly, 16 packaging
mutations, and 40 missing/tampered native-asset cases per source path across Java,
Kotlin, cold loading and warm loading.

Each installed source path passed 77 Java and 76 Kotlin assertions, plus all
26 public signatures, three rejected Java consumers and four rejected Kotlin
consumers. The existing borrowed-value JVM regression suite passed all 31 tests
with no skips.

## Artifact contracts

Transfer packages use `owned-jvm-v2`, JVM ownership contract version 2, adapter
version 2 with `ownedValues` version 3, and version-2 compiled and package receipts.
Packaging regenerates compiler-authenticated sources and ownership rules before
accepting these artifacts. Borrow-only packages retain their existing versions
and generated source bytes.

The [machine-readable receipt](owned-jvm-transfers-20260929.json) binds the
executed gate, compiler metadata, private probes, Maven package and dependency
inventories, installed observations and exact source hashes. Its ordered edit
spans reconstruct the prior .NET checkpoint without changing any older receipt.
The type inventory only refreshes evidence-source hashes in this milestone.

Perl, PHP/native-Wasm, JS/TS and WIT/WASI transfers remain separate work.
Owner-anchored borrowed results, owned Docker acceptance, and final cross-language
acceptance are still required by the full structured-types goal.
