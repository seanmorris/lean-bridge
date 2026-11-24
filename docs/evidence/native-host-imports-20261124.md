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

For C, a second gate compiled all five generated member implementations
in the same translation unit as Lean's own declarations: constructor, method,
property read/write and a nominal identity result. The resulting object
defined all five externs. A separate contract test checked the receiver anchor
on a borrowed result, a changed nominal kind, and distinct C and PHP domains.
These are compile-time checks; cross-component runtime identity still needs
an installed C consumer.

With the pinned compiler on PATH or `LEAN_BRIDGE_LEAN_PREFIX` set, run:

```sh
node --test --test-concurrency=1 tests/native-host-nominal-contract.test.mjs tests/c-host-member-bindings.test.mjs tests/helpers/native-host-nominal-lean.mjs
```
