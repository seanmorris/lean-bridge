# Owned WIT conversion and native execution

VO task 1219. The [machine-readable receipt](wit-owned-native-20260929.json)
records the complete five-test execution and exact source transitions from
commit `9a2ab9091d501e6d4aac5d668496de2bd6a40579`.

The conversion probe runs under AddressSanitizer and UndefinedBehaviorSanitizer.
It covers all 19 scalar types and resource-bearing records, collections,
options, results, tuples, variants and recursive graphs. It checks every observed
scratch-allocation failure site, budget exhaustion, invalid graphs, and partial
resource cleanup. Mutations that remove cleanup or admit unreachable rows fail.

The native probe compiles ordinary Lean sources and independently reviewed
sources, generates the complete WIT component, and links its imports to those
compiled Lean adapters. Each source path executes 557 component calls and checks
248 resource observations across 49 graph cases. Captured and supplied closure
branches return the expected resources after releasing their original inputs.
Six native allocation-failure cases leave the output unchanged and no partial
leases live. Nested call rollback and repeated references to one graph node
receive separate checks.

Each returned Wasmtime resource retains an independent native lease. Native
broker identities stay 64-bit; 32-bit WIT handles reference the owning host's
registry. The normal and sanitizer executions finish with zero tracked native
allocations and identities. The sanitizer report must match the cold Lean
startup baseline. Removing either the independent output lease or pending-call
rollback makes the native probe fail.

The downstream WIT job requires all five tests, rejects skips, and uploads the
full log. The CLI source inventory and core test profile include the new code.
Previous receipts remain unchanged. The type-surface index receives source hash
updates only.

This milestone verifies the private native host. Owned WIT host callbacks, the
public session API, installed package generation, transferred inputs and
owner-anchored borrowed results remain open. It does not promote installed
support or change existing copied and callable packages.
