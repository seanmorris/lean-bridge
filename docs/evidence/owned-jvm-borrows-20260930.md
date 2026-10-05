# Java and Kotlin owner-anchored results

VO1219. Maven packages preserve original-owner function results from ordinary
Lean exports and independently reviewed IR. Java 22 FFM calls the checked C
adapter and the compiled Lean component. Kotlin uses the same native ownership
contract with its own generated value types and callback interfaces.

Resource-containing results use `Value<T>`, including empty containers. `get()`
checks the complete owner and returns borrowed resource views. `share()` adds a
guard for that owner. Closing its last guard or transferring the owner expires
dependent results transitively. `retain()` and typed copy factories create
independent owners. Resource equality compares canonical native identities;
equality on expired values throws. Declaration-selected copy factories avoid
ambiguous JVM overloads for erased generic types and arrays versus Lean lists.

Transferred arguments pass original native owner slots. Callback reentry sees
consumption immediately. Input validation happens before handoff; failures after
handoff leave inputs consumed. Shared FFM transfer slots detach before their
arena closes, including cross-thread disposal during reentry. A whole-value
scope pins input owners during conversion. Callback arguments remain call-scoped
unless explicitly retained.

The ownership contract, private adapter, compiled projection and Maven receipt
use version 3. Native owned values use version 4 and authenticate `resultAnchors`
separately from `inputTransfers`. Unanchored generated APIs keep their existing
bytes and versions.

## Validation

```sh
source scripts/env.sh
npm run test:owned-jvm-borrows
```

The gate requires eight tests without skips. Both authoring paths compile actual
Lean, then execute Java and Kotlin tests for nested and recursive values, empty
owners, callbacks, returned closures, canonical identity, transitive expiration,
wrong-thread access, creator-thread exit and garbage collection. A deterministic
schedule closes each language's whole owner on a foreign thread immediately
after `get()` validates it. The read must return its captured payload, never a
cleared `null`. The test failed before the snapshot-order correction. Managed and
native allocation fault sweeps retain thrown exceptions and require zero live
native allocations and identities. Five compiled mutations must fail runtime
assertions. Borrow-only APIs execute separately from mixed transfer APIs.

Prepared JARs install offline into empty Maven repositories after producer
sources are removed. Both consumers compile against public APIs only. Eleven
invalid Java/Kotlin programs must fail with the expected type diagnostics.
Consumers and the exact documentation examples execute again after relocation,
handoff and source removal, using a runtime with only `java.base`. The tests
require byte-identical JAR/POM reassembly and reject 25 altered contracts and
artifacts. Forty cold/warm checks remove or tamper with each native asset in
both languages, including forged mutable receipts and an already loaded package.

The JSON receipt retains the compiler inputs, native runtime receipt, generated
source hashes, mutation observations, installed package identities and exact
source transitions. Earlier receipts remain unchanged. No support-table cells
are promoted by this record. Other consumer bindings, receiver anchors,
callback-result anchors, inherited-process tests, sanitizers and Docker
acceptance remain separate work. No registry upload is performed.
