# Python receiver methods, properties and original-owner results

Plan node: 1219. The acceptance record is
`owned-python-receivers-20261001.json`. It binds the source inventory, generated
contracts, complete test log and installed-wheel observations to the Rust
receiver milestone. Earlier receipts and support-cell classifications remain
unchanged.

## Run the acceptance suite

```sh
source scripts/env.sh
export LEAN_BRIDGE_COLLECTION_MYPY_PYTHON=/app/build/python-collection-typecheck/bin/python
export LEAN_BRIDGE_PYTHON_TYPING_WHEELS=/app/build/python-typing-wheels
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-python-receivers
```

The gate requires 11 passing tests, no skips, and nine reports under
`build/owned-python-receivers/`. CI retains the complete log and every report.

## Coverage

Both ordinary Lean source and reviewed binding IR export 27 functions,
including 16 receiver methods or properties, 20 original-owner result anchors,
and four consuming functions. Python exposes read-only properties and nominally
checked methods on `Value[T]`. Class-level descriptors agree with the generated
type stubs. Resource-only members remain available on raw resource wrappers
when their contracts do not require the original whole owner.

Compiled runtime probes cover receiver and remaining-argument anchors, aliases,
independent retention, empty and recursive values, returned closures, callback
reentry, original-owner consumption, allocation failures, retained exception
tracebacks and foreign-thread close schedules. Three compiled broken variants
must fail their semantic checks. Separate receiver-only builds run without
callback or result-anchor support, with and without consuming receivers.

Each source path uses a freshly built, offline-installed CLI. Two independent
builds and package reassembly must reproduce the original archives. The suite
removes author sources and the CLI before installing wheels. It executes public
imports on Python 3.11 with both supported typing dependency bounds and Python
3.12 using standard-library typing, then relocates and reruns each installation
after removing the package handoff. Strict type checks reject invalid owners,
property assignment, raw anchored arguments and invalid member calls. The
published consumer example executes from each installed wheel.

The reviewed build shares an authenticated adapter with C, C++ and Rust. The
C++ and Rust consumers execute from their original prepared packages. Forged
receiver metadata and changed adapter files must fail package verification.

Callback-result anchors and the final cross-language container and coverage
audit remain separate work. This record does not publish a package or promote
installed-support cells.
