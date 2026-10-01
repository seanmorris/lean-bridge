# Ruby receiver methods, properties and original-owner results

Plan node: 1219. The acceptance record is
`owned-ruby-receivers-20261001.json`. It binds the source inventory, generated
contracts, complete test log and installed-gem observations to the Python
receiver milestone. Earlier receipts and support-cell classifications remain
unchanged.

## Run the acceptance suite

```sh
source scripts/env.sh
export LEAN_BRIDGE_PYTHON_TYPING_WHEELS=/app/build/python-typing-wheels
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-ruby-receivers
```

The gate requires 10 passing tests, no skips, and eight reports under
`build/owned-ruby-receivers/`. CI retains the complete log and every report.

## Coverage

Both ordinary Lean source and reviewed binding IR export 27 functions,
including 16 receiver methods or properties, 20 original-owner result anchors,
and four consuming functions. Ruby exposes nominally checked methods and
zero-argument property readers on `Value`. Raw resource members are available
only when their contracts do not require the original whole owner. Record
fields remain fields on the raw value; exported properties are Lean calls.
Ruby introspection and unbound method invocation use real class members.

Compiled runtime probes cover receiver and remaining-argument anchors, aliases,
independent retention, empty and recursive values, returned closures, callback
reentry, original-owner consumption, allocation failures and foreign-thread
close schedules. Three compiled broken variants must fail their semantic
checks. Separate receiver-only builds run without callback or result-anchor
support, with and without consuming receivers.

Each source path uses a freshly built, offline-installed CLI. Two independent
builds and package reassembly must reproduce the original archives. The suite
removes author sources and the CLI before installing the gem, then relocates
the installation after removing the package handoff and gem cache. It executes
the published consumer example from the installed gem. Loader checks cover
concurrent require, initialization counts, isolated GMP, fork affinity, changed
libraries, symlinked libraries and unverified runtime injection.

The reviewed build shares its compiled Lean component with C, C++, Rust and
Python. C++, Rust and Python consumers execute from their original prepared
packages. Ruby keeps a private adapter and GMP library. Forged receiver
metadata and changed adapter files must fail package verification.

Callback-result anchors and the final cross-language container and coverage
audit remain separate work. This record does not publish a package or promote
installed-support cells.
