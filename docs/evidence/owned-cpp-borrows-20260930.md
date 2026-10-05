# C++ borrowed results

C++ packages support function results anchored to an input's original owner.
`Value<T>` keeps the whole result, including empty arrays, `None`, and empty
variant constructors. Access through `get()`, dereference, a forwarded call, or
conversion to `const T&` validates that owner. Borrowed results do not retain their
anchor. Releasing or transferring the anchor expires its borrowed descendants.

Copies share immutable result storage and its owner. Closing one copy leaves the
others valid. `retain()` and `copy_value()` create independent owners. A C++
reference already extracted from `get()` does not revalidate ordinary field
reads; resource wrappers still check their own lifetime on use. Canonical resource
equality compares Lean identity rather than owner-specific borrowed handles.

Consuming calls move the original owner's slot, including for empty values.
Preflight failures restore ownership; once native handoff occurs, aliases and
borrowed descendants reject access, including during callback reentry. A borrowed
root cannot transfer ownership, and a call cannot consume its own result anchor
or an ancestor of that anchor.

## Acceptance

```sh
source scripts/env.sh
npm run test:owned-cpp-borrows
```

The runtime and installed test files were also run separately with
`LEAN_BRIDGE_OWNED_CPP_BORROW_TEST=1`. The [receipt](owned-cpp-borrows-20260930.json)
records those actual commands and their logs. Both ordinary-source and reviewed
APIs compile 26 exports, including 19 anchored results and four consuming
functions. Each runtime probe passes 918 checks; each sanitizer probe passes 910.
The separate header check also compiles a borrow-only API with no consuming calls.
The probes cover every aggregate constructor, nested options/results, recursive
values, empty owners, retained closures, callback expiration and original
exceptions, transitive expiration, thread/fork rejection, and allocation failure
before and after handoff. Cleanup leaves no bridge allocations or identities.
ASan and UBSan output matches the separate Lean startup leak baseline.

Four deliberately broken C++ implementations compile and then fail the oracle:
missing whole-value validation, dropped empty owners, escaping callback wrappers,
and equality based on view pointers instead of canonical resource identity.

Both installed-package paths pass 407 checks using pkg-config, relocated CMake,
and sanitizers. The tests remove author sources and producer output before
installation, then remove the archive handoff before relocated execution. The
consumer example compiles against that installed package and prints `42`.
Three incapable reader configurations and nine altered C++ anchor-contract fields
are rejected. Archive reassembly is byte-identical; this is not an independent
rebuild of the Lean component.

The native model uses version 9, C++ contract version 3, and package manifest
version 5. Unanchored generated C++ files remain unchanged. The source receipt
authenticates this milestone's additions and reversible edits while preserving
earlier receipt bytes. Type-table changes refresh source hashes without promoting
new support cells. CI requires all five enabled tests with no skips and retains
both source paths' runtime and installed reports.

## Remaining work

Borrowed-result projections for the other consumer bindings, Docker installed
acceptance, and the final cross-language documentation and CI audit remain open.
This milestone does not implement receiver or callback-result anchors and does
not publish packages to a registry.
