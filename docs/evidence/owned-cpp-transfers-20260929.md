# C++ input transfers

C++ packages compile explicit input-transfer contracts from ordinary author
configuration and independently reviewed APIs. Consumers pass rvalues with
`std::move`. The adapter validates every input and prepares native snapshots
before arming a move. It observes the public C owner slots at their exact handoff,
so callback reentry sees consumed source leases as closed. Whole leases and their
aliases move together; independent retains survive. Host-assembled graphs may
contain several leases, but two transferred arguments cannot share one lease.

Callback-local resource borrows cannot transfer ownership. Copied fields remain
ordinary C++ values. Failed validation or preparation preserves source leases;
failure after handoff leaves them consumed. RAII guards release temporary
snapshots, partial outputs and consumed source owners.

## Acceptance

```sh
source scripts/env.sh
npm run test:owned-cpp-transfers
```

Both compiler paths execute resource-containing arrays, lists, options, results,
products, records, aliases, all variant branches, nested values, forty-level
trees, returned closures and callback reentry. The probe injects failures at each
observed C++ and native bridge allocation site, for single and multiple inputs.
An independent counter at the C handoff checks that pre-handoff failures preserve
every input and post-handoff failures consume all of them. Cleanup must leave no
additional bridge allocations or identities. ASan and UBSan runs compare with a
separate Lean startup leak baseline.

The package gate builds C and C++ together, reproduces the C++ archive without a
compiler, and removes author sources and producer output before installation.
Public C++ consumers run using pkg-config, then relocated CMake and sanitizers
after archive removal. The consumer checks every level of its recursive result.
The documented C++ example also compiles and runs against the relocated package.
Forged move rules reject after their surrounding receipt is replaced. Unsupported
Rust projection still rejects before generation.

Native model version 8 authenticates the selected consuming parameters. Package
manifest version 4 and `ownedValues` version 3 retain the native contract;
`cppValues` version 2 adds rvalue signatures, alias consumption and independent
retains. Borrow-only headers and contracts remain byte-identical.

The [source-bound receipt](owned-cpp-transfers-20260929.json) retains both authoring
paths, installed observations and reversible changes from the C milestone.
Earlier receipts remain unchanged. CI runs the enabled gate and uploads all four
runtime and package reports. This milestone does not promote unrelated type-table
cells or publish packages to a registry.

## Remaining work

Complete input transfers for the other consumer bindings, owner-anchored borrowed
results, owned Docker acceptance, and final cross-language installed acceptance.
