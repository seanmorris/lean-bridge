# Installed C input transfers

C packages compile explicit input-transfer contracts from ordinary configuration
or an independently reviewed version-4 API. The public header adds an owner slot
beside each transferred value. Validation precedes an atomic handoff; the adapter
clears all consumed owner slots before Lean or a host callback runs. Later failure
does not restore those owners. The lower-level
[native/C tests](owned-transfer-c-20260929.md) cover allocation faults, malformed
replies, sanitizers and independent retains.

Native model version 8 and owned-graph version 3 authenticate the selected
parameters, whole-owner consumption and failure rules. Native-component,
public-adapter and package receipts use version 4; `ownedValues` uses version 3.
Readers without transfer support reject before projecting an API. Existing
borrow-only components keep their original versions and signatures.

## Acceptance

```sh
source scripts/env.sh
npm run test:owned-transfer-packages
```

Two compiler-only tests retain all 18 transfer decisions through public analysis.
They invoke real Lean through an injected process transport, without compiling C
or running Nix/Docker. Changed or missing author decisions reject.

Both package tests compile Lean, produce an archive, and reproduce that archive
by compiler-free reassembly. They remove the source project and producer output
before installation. Each public C consumer passes 446 checks with pkg-config, then again
through CMake after archive removal and package relocation. It checks resources,
records, aliases, all variant branches, empty values, nested Option/Except values,
forty-level trees, duplicate and foreign owners, callback reentry/failure/session
closure, captured and transferred Lean closures, cycles, thread affinity and fork.

Rewritten move contracts reject even when the enclosing adapter receipt is
replaced. C++ projection rejects transfer-bearing components until its binding
implements the same semantics. The generated package README explains which owner
slots remain valid after a failed call. CI runs these tests and uploads all four
reports from `build/owned-transfer-packaging/`.

The [source-bound record](owned-transfer-packages-20260929.json) retains the
observations, component and package receipts, source hashes, and exact reversible
changes from the previous milestone. Earlier receipts remain unchanged. This
milestone does not promote general type-table cells, which do not distinguish
transferred inputs from borrowed ones.

The preceding full core run exposed two historical extractor checks in JVM and
PHP evidence. They now authenticate the extractor bytes used by those installed
receipts through the exact source-history chain. Unknown changes still reject;
the original receipts and their extractor hashes remain unchanged.

## Remaining work

Implement input consumption in the other consumer bindings, owner-anchored
borrowed results, owned Docker acceptance, and final cross-language installed
acceptance. No registry publication is part of these tests.
