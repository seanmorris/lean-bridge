# Prepared Python packages with resource-containing values

Ordinary Lean source and independently reviewed Binding IR now produce prepared
Python wheels with owned records, variants, recursive values and callbacks.
Consumers install the wheel and import its module. The package loads its bundled
Lean runtime and GMP without ctypes setup, compiler access or shared-library paths.

## Installed behavior

Both build paths pass 120 public API checks in each of three environments:
Python 3.11.16 with typing_extensions 4.6.0 or 4.16.0, and Python 3.12.14 with
standard-library type aliases. The same checks pass after moving each installed
environment and removing the release handoff. Separate scalar wheels pass 146
installed and 146 relocated checks per environment, covering all nineteen
primitive types inside resource-containing records.

The producer checkout and build output are deleted before installation. Pip
resolves the pinned backport wheels offline. Consumers use public generated
functions, frozen dataclasses and native containers; they supply no constructor
numbers, JSON transport, pointers or native declarations. Pinned mypy 2.3.1
accepts the strict positive consumer and the consumer-guide example. Thirteen
diagnostics reject eleven invalid operations, including incorrect callback
results and missing typed recovery values.

The reviewed composition build also emits C, C++ and Cargo packages through the
same compiled adapter. Their installed consumers pass 693, 577 and 596 checks
respectively. Both the Python and Rust package verifiers authenticate the other
projection's ABI contract when sharing an adapter.

## Ownership and failure handling

Resource leaves carry checked result leases. Container copies preserve value
storage; shallow wrapper copies share a lease, while explicit `retain()` creates
independent native ownership. Callback resource leaves expire when the callback
returns unless retained. Replies are copied into C-owned result storage before
the callback frame disappears. Python exceptions resume after native cleanup.
Returned Lean closures support higher-order calls and explicit close.

The compiled runtime probes exercise 324 assertions on Python 3.11 and 325 on
3.12 per source path. Value probes exercise 604 mixed-value checks, 216 malformed
output checks, 392 callback checks and 353 scalar checks per environment. They
inject every measured Python conversion allocation failure and native allocation
failures, retain exception tracebacks, and require zero live bridge allocations
and native identities after cleanup. Repeated callbacks hit the shared conversion
limit after 819 invocations; the following ordinary call succeeds.

Conversions bound depth to 128, visits to 262,144, native conversion data to
16 MiB and accounted Python conversion storage to another 16 MiB. These limits
do not bound Lean algorithm memory or every Python allocator overhead.

## Loading and package integrity

Compatible imports share one runtime and component initialization, including four
concurrent imports. The loader rejects incompatible runtime identities, unverified
preloaded libraries, modified libraries and symlinked native files. Fork probes
hold the parent's loader lock and require the child to reject reuse before taking
that lock. Closing the cached sessions leaves zero native identities.

Package verification rejects changed lifetime contracts, generated C sources,
Python ABI assertions and native libraries. Reassembling the same verified input
produces the same wheel bytes. Receipts retain the compiler-checked component,
adapter, generated APIs, native dependencies, source notices and package hashes.
Producer builds check the Python/C/GMP ABI rather than assuming ctypes layouts.

This native profile requires GIL-enabled Python 3.11+ on Linux x86-64. The recorded
local wheel tests explicitly select glibc 2.36, matching their host. Production
builds retain the default glibc 2.38 floor and validate library symbol versions.
Post-fork use, cross-thread resource use and subinterpreters are not supported.

## Evidence and reproduction

The [execution record](owned-python-execution-20260927.json) retains the accepted
logs, inputs, observations, package receipts and exact source identities. The
[integration record](owned-python-integration-20260927.json) preserves the original
Rust and C++ evidence through exact, hash-checked source deltas. The earlier
[Python conversion evidence](owned-python-values-20260927.md) remains a historical
record of the stage before prepared-wheel delivery.

```sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 \
node --test tests/owned-python-runtime.test.mjs tests/owned-python-values.test.mjs

LEAN_BRIDGE_OWNED_NATIVE_TEST=1 \
node --test --test-concurrency=1 \
  tests/owned-python-packaging.test.mjs \
  tests/owned-python-scalar-packaging.test.mjs

node --test tests/owned-python-package.test.mjs tests/owned-python-evidence.test.mjs
```

The consumer CI workflow provisions both Python versions, pinned typing wheels,
mypy and the Rust companion toolchain. It requires ordinary/reviewed composition
and scalar-wheel reports and uploads the runtime, value and package observations.

VO1219 remains open. Other host ownership projections, transferred inputs,
anchored results and Wasm ownership still need delivery. This milestone makes no
blanket type-surface promotion; the inventory remains 4,830 of 6,562 installed
cells at version 0.107.0.
