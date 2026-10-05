# Installed recursive npm values

VO 1219, 2026-09-22. Ordinary Lean source and independently reviewed IR now build
installed npm packages containing bounded recursive copied values.

The [callable-alias compiler repair](callable-alias-ci-repair-20260922.md) includes
a subsequent rebuild of these packages and the alias/variant regressions on all
three browsers. Its new receipt retains the original installed record unchanged.

## Public values

Generated TypeScript retains recursive names, constructor names, fields and
aliases. JavaScript callers use ordinary objects and arrays. The installed
fixture covers mutual recursion through Array and List, record wrappers,
aliases, Option, Except, nested products and all nineteen primitives. Lean-side
checks interpret every primitive field independently of the identity exports.
Shared input subtrees return as independent copies. Cyclic host values reject.

The compiler uses a finite graph ABI with total typed Lean carriers. Its C
walkers use generated constructors and projections, not constructor offsets or
tags. All arguments validate before Lean allocation. Graph-backed calls share
128 value edges, 262,144 value slots and 16 MiB copied slots/payloads across
arguments and results. Lean working memory is outside the copied-value budget.

## Ownership and failure

Every recursive call has a native output allocation ledger. The loader snapshots
the receipt and checks disjoint spans, ownership flags, exact physical sizes and
complete one-time use of each allocation. It rejects input/result overlap,
duplicate buffers, interior pointers, borrowed output and unclaimed allocations.
Empty scalar payloads own one physical byte; empty child tables allocate none.

Native cleanup uses ledger entries, never returned slot pointers. Replacing
result pointers after a successful copy does not change what gets freed.
Allocation and result-budget failures clear partial output and recover. Traps,
malformed frames and malformed output retire the shared runtime without following
untrusted pointers. Generated host validators use explicit work stacks with
cycle, node and depth checks before runtime dispatch.

## Installed checks

Both source paths install offline after the author sources have been relocated.
Node and executed strict TypeScript run with compiler tools removed from PATH.
Chromium, Firefox and WebKit each execute the public package in a page, React
and a dedicated worker. Every JavaScript context executes 199,675 assertions
and 46 rejection cases, followed by recovery calls.

The checks include 65,535 empty tree branches within the combined node budget,
65,536 branches rejected, near-limit strings, oversized results, 20,000-deep
host input, recursive-first constructors and a type with no finite inhabitant.
Raw compiled Wasm checks inject failure at each output conversion and verify
that every copied allocation is freed exactly once. Synthetic loader tests
independently construct malformed slots and receipts; these are separate from
installed execution evidence.

```sh
CHROMIUM_PATH=/usr/bin/chromium \
LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit \
node --test tests/component-recursive.test.mjs
```

The [receipt](npm-recursive-20260922.json) records exact package identities,
consumer results and source hashes. Historical variant, alias and Kotlin
receipts remain byte-identical; [source lineage](recursive-npm-source-lineage-20260922.json)
records test-registration and evidence-check updates separately.

Recursive values remain unverified in the other twelve consumer profiles.
Compound callable payloads and explicitly owned identity aggregates remain
required work. No registry publication is part of this milestone.
