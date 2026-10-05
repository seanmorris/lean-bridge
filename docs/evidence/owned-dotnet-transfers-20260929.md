# C# input ownership transfers

This milestone adds consuming inputs to prepared NuGet packages. Both ordinary
Lean source and independently reviewed contracts compile the same explicit
ownership decisions. Consumers pass the generated C# values and use `Retain()`
when they need an independent owner.

The [execution receipt](owned-dotnet-transfers-20260929.json) binds the compiler
inputs, generated sources, native and managed artifacts, installed observations,
test log and reversible source changes. Earlier receipts remain unchanged.

## Run the checks

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-dotnet-transfers
```

The recorded host uses .NET SDK 8.0.424 and glibc 2.36. Production builds retain
the default glibc 2.38 floor and check their linked symbol requirements. The
reviewed combined build also needs C/C++, Rust, Python with its pinned offline
typing wheel, and MRI Ruby 3.3. The local run selects the wheel directory through
`LEAN_BRIDGE_PYTHON_TYPING_WHEELS`.

## Checked behavior

The fixture contains 26 exports, including 20 consuming signatures. It exercises
arrays, Lists, nested options and results, products, records, aliases, every
variant constructor, empty cases, recursive trees and boxed chains. Mixed
values preserve large integers, Unicode and NUL, raw bytes, signed zero and
infinities alongside resource identities.

Validation and snapshot preparation precede the Lean call. At handoff, shared
aliases and sibling wrappers with the same owner close together. Independent
retains survive. Callback borrows must be retained before transfer. Two consuming
arguments cannot share a lease. Calls that fail before handoff preserve inputs;
failures after handoff leave them consumed.

Private probes inject managed and native allocation failures before and after
single- and multiple-input handoffs. They retain exceptions while checking
explicit cleanup without garbage collection. Callback reentry forces garbage
collection while native owner slots are pinned. The gate also checks original
exception identity, returned closures, wrong-thread rejection and interrupted
thread cleanup. Both compiler paths finish with zero tracked allocations and
resource identities.

Installed consumers compile with unsafe C# disabled and use only the public
assembly. They install from an offline NuGet feed after the producer and Lean
sources have been removed. Eleven ill-typed consumers must fail compilation.
The documented C# example executes from the installed package.

Fourteen metadata, source and artifact mutations must fail packaging. Loader
checks reject a modified native library and a symbolic-link replacement.
Reassembly must produce byte-identical archives. The test then removes the
handoff, feed, package cache and C# sources, relocates the output, and repeats
execution with a runtime-only .NET installation containing no SDK.

The reviewed build also installs and executes C, C++, Cargo, PyPI and RubyGems
companions from the same compiled Lean component. It retains .NET's private
thread-exit adapter and GMP dependency.

## Remaining work

This receipt does not promote unrelated type-surface cells. Other consumer
input-transfer bindings, owner-anchored borrowed results, owned Docker acceptance
and the final cross-language audit remain open.
