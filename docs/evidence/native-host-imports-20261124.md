# Native application-owned host imports

A single application resource contract declared a mutable `Box` on four
hosts: C, C++, Rust and WIT. Lean 4.32.2 compiled all four generated import
modules and an ordinary Lean consumer that sets and gets the property on
each host. Its emitted C referenced each host's distinct setter and getter.
Lean rejected all four attempts to pass a neighboring host's `Box` to the
wrong function. The v3 semantic validator and JSON schema also rejected
unknown, repeated, or empty host selections; the v4 schema's host projection
agreed. None of these checks links a host's implementation or runs an
installed package.

With the pinned compiler on PATH or `LEAN_BRIDGE_LEAN_PREFIX` set, run:

```sh
node --test --test-concurrency=1 tests/native-host-nominal-contract.test.mjs tests/helpers/native-host-nominal-lean.mjs
```
