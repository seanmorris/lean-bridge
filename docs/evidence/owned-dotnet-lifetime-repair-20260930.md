# C# whole-owner lifetime repair

VO1219. Two actual-Lean reproductions exposed lifetime races in C# `Value<T>`.

A foreign thread could dispose the whole owner after `Get()` validated it but
before it read the payload field. The read then returned a cleared value. The
guard now captures an immutable payload holder before validation. The holder
provides an atomic reference read even when `T` is a multi-field value type.
Disposal still clears the guard's payload reference. Later reads reject.

An optimized temporary expression such as `Api.NewTicket(42, "x").Retain()`
could lose its receiver to garbage collection while retention was converting
its raw resource view. `Get`, `Share`, `Retain` and both equality overloads now
keep the receiver alive until the operation returns or throws. Equality also
keeps its other whole-owner argument alive. Raw views remain non-owning and do
not keep an abandoned whole owner alive after the operation.

## Validation

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-dotnet-borrows
```

Prepare the pinned offline Python dependency wheels described in the testing
guide. The reviewed package test also installs the same native component in
C++, Rust, Python and Ruby. `LEAN_BRIDGE_PYTHON_TYPING_WHEELS` selects an existing
verified wheel feed when it lives outside the current worktree.

Both source paths run optimized C# code against compiled Lean. Deterministic
foreign-thread disposal tests cover empty reference-type results and nested
value-type results. Twenty-one forced-GC schedules cover `Get`, `Share`,
`Retain`, typed equality and object equality, including temporary arguments.
Six compiled mutations must fail, including a late payload read and removal
of receiver rooting. Existing allocation-failure, callback, thread-exit,
transitive-expiration and leak checks remain enabled.

The seven-test gate also installs original NuGet archives offline and executes
the public API and documentation after relocation without author sources or an
SDK. It retains typed-invalid consumer diagnostics and package-tampering checks.
The JSON receipt binds these executions to the exact repaired source. Historical
receipts remain unchanged; hash-selected source reconstruction preserves their
original generated C# declarations and package contracts. No support-table cells
are promoted, and no registry upload is performed.
