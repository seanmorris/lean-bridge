# Canonical Binding IR

Status: implemented contract for the architecture POC.

The binding intermediate representation records one component's public semantics before a generator chooses JavaScript, TypeScript, C, Rust, Python, or another host syntax. Every backend receives the same type, ownership, failure, capability, and assurance data. A backend can adapt those semantics to native language conventions. It cannot redefine them.

The version 3 artifacts are:

- [`schema/binding-ir.schema.json`](../../schema/binding-ir.schema.json), the closed interchange schema;
- [`src/binding-ir/contract.mjs`](../../src/binding-ir/contract.mjs), the graph and semantic validator;
- [`src/binding-ir/frontend.mjs`](../../src/binding-ir/frontend.mjs), the versioned producer adapter boundary; and
- [`poc/lean-link-spike/bindings/alpha.binding-ir.json`](../../poc/lean-link-spike/bindings/alpha.binding-ir.json), the reviewed golden fixture.

The JavaScript, PHP, Python, C, and Rust generators consume this fixture. The PHP generator compiles one public Composer package and a shared typed transport contract before selecting a native Zend or PHP-Wasm adapter. The Python generator emits a normal package, typed value and resource classes, stubs, a private transport protocol, documentation, and a hash-bound manifest. The C generator emits a public C11 header, implementation, internal per-declaration runtime interface, documentation, and a hash-bound manifest. The Rust generator emits a safe crate, a hidden typed runtime trait, documentation, capability-gap metadata, and a hash-bound manifest. Their tests demonstrate that target syntax, transport, and lifecycle conventions can change without creating another semantic contract.

## What the IR records

| Concern | Version 3 representation | Required backend behavior |
|---|---|---|
| Primitive values | Unit, booleans, fixed-width integers, arbitrary integers, floats, strings, and bytes | Preserve the semantic type. Do not substitute an untyped JSON protocol. |
| Constructed values | Arrays, options, results, tuples, named types, and generic parameters | Reject unsupported instantiations before generating a package. |
| Semantic variants | Named cases with typed copied fields | Emit discriminated unions or tagged classes. Do not expose Lean constructor numbers. |
| Value identity | Every named type declares `copied` or `identity` representation | Generate native values for copied types and canonical resources or classes for identity types. |
| Declarations | Functions, constructors, methods, static methods, properties, overload keys, parameters, defaults, and results | Emit direct named callables. Keep symbol dispatch and ABI calls private. |
| Mutation and effects | Immutable, read, and write access plus allocation, resource access, host calls, failure, async work, and nondeterminism | Preserve observable behavior and reject target profiles that cannot support required effects. |
| Ownership | Copy, borrow, lease, and transfer | Generate validation, retain and release operations, disposal, and wrapper reuse from the declared transition. |
| Lifetime | Call, receiver, parameter, explicit, or runtime scope with a checked anchor where required | Prevent a generated borrow from outliving its anchor. |
| Resource policy | Nominal kind, disposal policy, finalizer fallback, and cycle policy | Use generation-safe tokens and deterministic cleanup. Finalization remains a fallback. |
| Host object projection | Target set, canonical identity policy, and dynamic access policy | Generate Lean APIs whose members preserve receiver ownership, lifetimes, callbacks, iterators, and asynchronous delivery. Keep handles private. |
| Callbacks and closures | Identity-bearing callback types with invocation count, re-entry, self-disposal, parameters, result delivery, effects, and failure semantics | Generate stable signature IDs, native callables, handle conversion, fixed Wasm table adapters, nested frame checks, and deterministic cleanup. |
| Failure | No declared failure or a closed set of declared errors, plus trap or poisoned-runtime handling for unexpected failures | Project the same failures through idiomatic exceptions or result types without dropping cases. |
| Result delivery | Value, Promise, iterator, or async iterator | Generate the target's native protocol when its capability profile supports it. |
| Capabilities | Required or optional host, target, runtime, and feature capabilities | Fail generation for a missing required capability. Report an optional gap explicitly. |
| Assurance | Proved, trusted-boundary, or unverified claims with theorem names, assumptions, subject identity, and source | Keep assurance data attached to generated documentation and artifact metadata. |

## Ownership invariants

A copied value has no cross-boundary lifetime. The receiver can retain its own copy without registering a handle.

An identity value uses an opaque runtime token internally. Host code receives a canonical object, class, resource, or equivalent native projection. The token, runtime identity, generation, and nominal kind remain private.

A borrow does not create ownership. Its lifetime ends with the call or remains anchored to a named receiver or parameter. A lease retains a resource until explicit disposal or runtime shutdown. A transfer moves ownership through the call boundary. Backend tests must exercise the same transitions even when their surface syntax differs.

Copied records cannot contain identity-bearing fields. Identity values cannot declare copy ownership. Non-copy ownership requires a lifetime. The semantic validator rejects each violation before generation.

The separate [owned aggregate contract](../evidence/owned-aggregate-metadata-20260926.md)
stages version 4 for immutable resource-bearing collections, records and variants.
It retains resource identity and requires explicit lease/disposal policies,
including a policy for anonymous containers. Compiler checks, private typed Lean/C
carriers, budgeted native value conversion and ownership cleanup execute in
dedicated tests. A separately compiled C consumer now exercises semantic value
types, opaque identities and explicit session/result lifetimes. The same C
consumer also executes an independently authored v4 contract after fresh Lean
reconciliation. The review selects resources and ownership policies; it cannot
supply layouts or proof evidence. C, C++ and Cargo package builds ship that transport
with the shared runtime, GMP and relocatable build metadata. C++ adds named value
types, standard containers, exact Boost integers and checked RAII resource leases.
Installed ordinary
and reviewed consumers execute without producer source or Lean. C, C++, Rust,
Python, Ruby, C#, Java, Kotlin and Perl packages
also admit explicit input transfers. The [native/C transfer implementation](../contributing/testing.md#staged-input-transfers)
validates every input owner before consuming the whole set, nulls owner slots
before Lean runs, and keeps copied storage alive through callback reentry.
Later call or result-conversion failure does not restore consumed inputs.
Native model version 8 records each consuming parameter and the move/failure
contract. Native-component, public-adapter and C/C++ package receipts use version 4;
`ownedValues` uses version 3. Readers reconstruct the contract from compiler
metadata and require explicit transfer capability. APIs without transferred
inputs keep their previous versions. C++ `cppValues` version 2 records rvalue
arguments, shared-lease alias consumption and independent-retain preservation.
Its adapter validates host-assembled graphs before preparing input snapshots,
then observes the C owner slots at their exact handoff. Rust's ownership contract
version 2 records mutable-reference inputs with the same alias and failure rules.
Its stable `Cell` owner slots let callback reentry observe the native handoff;
`Rc` keeps resource wrappers confined to their creating thread. Transfer-enabled
Rust projection and package receipts use version 3. Python's ownership contract
version 2 records ordinary-value inputs with the same lease consumption rules.
Conversion collects the leases it actually visits; it does not traverse mutable
Python containers again to decide ownership. Native slots expose the handoff
to reentrant callbacks. Transfer-enabled Python package receipts use version 3.
Ruby collects the leases visited during conversion and observes the same native
handoff. Its ordinary-value inputs consume shared `dup` and `clone` aliases;
independently retained owners survive. Ruby's ownership contract, private adapter
and package receipt use version 2 for transfers. Its isolated GMP and loading
policy remain unchanged. Perl's version-2 ownership and binding contracts record
the same consuming arguments and shared-lease alias rules. Its converter reserves
the resource leases it visits, rejects overlapping consuming arguments, and
observes the native handoff during callback reentry. Perl save-stack cleanup
preserves pre-handoff inputs and releases consumed owners after exceptions.
The remaining consumer profiles also implement explicit transfers; each consumer
page describes its handoff and alias rules. C, C++, Rust, Python, Ruby, C#, Java and Kotlin additionally implement
parameter-anchored function results. A borrowed result depends on the exact
input-owner generation, including when it contains no resources. Releasing or
transferring the owner expires all descendants; an independent retained alias
cannot revive them. C view handles separate lifetime from resource identity and
provide typed equality plus result-owner validation. Component model version 9
and package manifest version 5 authenticate `resultAnchors` separately from
`inputTransfers`. C++ uses a checked `Value<T>` for complete result ownership,
including empty constructors. Copies share an owner; explicit retain/copy makes
independent ownership. Its version-3 `cppValues` contract records original-owner
transfers and canonical resource equality. Rust's version-3 `rustValues` contract
uses `Value<T>` with checked `get()`, shared clones, independent retain/copy and
`&mut Value<T>` original-owner transfers. Its compiled projection and Cargo
package receipts use version 4. Fallible equality reports expired owners;
`PartialEq` returns false for expired values. Python's version-3 `pythonValues`
contract uses checked `Value[T]` roots, shallow aliases, independent retain/copy,
canonical equality that raises on expiration, and original-owner transfers.
Its package receipts use version 4. Python copy factories use a nominal class,
public result declaration or public argument declaration to select the exact
type without guessing from an empty value. Ruby's version-3 `rubyValues` contract
uses whole `Value` roots, shared `dup`/`clone` guards, independent retention,
symbol-selected copy factories and canonical equality. Raw resources obtained
through `get` borrow the whole owner. Ruby adapter and package receipts use
version 3; their `ownedValues` transport uses version 4. C# uses typed `Value<T>`
owners, checked `Get`, shared-owner `Share`, independent `Retain`, and
`Api.CopyValue` or declaration-selected copy factories. Raw resource views borrow
the whole owner; transfers pass its original native slot. NuGet packages preserve
those contracts in version-3 adapter, assembly and package receipts. Java and
Kotlin use typed `Value<T>` owners with checked `get`, shared-owner `share`,
independent `retain`, and `Api.copyValue` or declaration-selected factories.
Factories account for JVM erasure and for Array/List mappings to the same array
type. Raw resource views borrow the whole owner. Original native owner tokens
cross consuming calls, and Cleaner cleanup queues release on the creator
thread. The version-3 `jvmValues` contract authenticates canonical identity
comparison, original-owner expiration and raw-view lifetimes; adapter, compiled
JVM and Maven package receipts use version 3. Their native `ownedValues`
transport uses version 4. Perl's version-3 CPAN ownership contract uses checked
whole `Value` owners, `get`, shared-owner `share`, independent `retain`, and
declaration-selected `copy_value` factories. Raw resource views borrow the whole
owner. A borrowed result remains tied to its anchor even when it contains no
resource leaves. Consuming calls use the original owner's native slot. Generated XS checks anchor expiry
and compares resource identity through the native adapter. Other consumer
projections of result anchors remain unfinished.
Existing version-3 backends reject the version-4 contract. Prepared Wasm ownership
support is documented for [JavaScript](../consume/javascript.md),
[PHP-Wasm](../php.md) and [WIT/WASI](../consume/wit-wasi.md).

The [owned host callback projection](../evidence/owned-host-callbacks-20260926.md)
executes typed recovery and call-scoped C borrows for resource-containing
values. Temporary callback replies preserve resource identity through the parent
transaction. Ordinary and reviewed compiler paths pass lifetime, reentry and
allocation-failure checks. C, C++ and Cargo builds include the callback adapter in prepared
packages. Native model version 7 authenticates signature-specific recovery and
callback source; native, public-adapter and package receipts record that capability.
Readers reconstruct it from compiler metadata and reject changed lifetime rules
or callback implementations even when their claimed file hashes are updated.

The [C++ ownership projection](../evidence/owned-cpp-values-20260927.md) expires
callback resource wrappers at return unless the consumer explicitly retains them.
It copies callback replies into owned C storage before destroying local values,
then rethrows original exceptions after C/Lean cleanup. C++ package receipts bind
the generated headers, lifetime rules and pinned Boost dependency to the native
contract. Ordinary and reviewed installed consumers also execute boxed recursion
and higher-order closures accepting mutable callbacks.

The [Rust ownership projection](../consume/rust.md#resource-containing-values)
uses typed structs, enums and native containers with thread-confined resource
leases. Cloning a container copies its value storage and shares checked resource
leases. Callback borrows expire on return; explicit `retain()` creates independent
native ownership. Rust callbacks return typed results, and original panic payloads
resume only after C has returned. Prepared Cargo crates embed authenticated
libraries, verify the C/GMP ABI during the producer build and load the runtime
automatically. Package verification regenerates the Rust API and rejects changed
lifetimes, sources or native artifacts.

The [Python ownership projection](../consume/python.md#resource-containing-values)
uses frozen dataclasses, named variants and native containers with checked resource
leases. Callback resource leaves borrow the invocation; explicit `retain()` keeps
independent ownership after return. Native cleanup precedes propagation of the
original Python exception. Prepared wheels bundle authenticated Lean and GMP
libraries and load them automatically on ordinary import. Producer-side ABI
assertions check ctypes layouts. Strict stubs cover resource-containing values,
recursive aliases and higher-order calls. The loader rejects incompatible or
externally preloaded runtimes and post-fork reuse before taking its registry lock.
This profile requires GIL-enabled Python 3.11+ on Linux x86-64.

The [Ruby ownership projection](../consume/ruby.md#resource-containing-values)
uses frozen value classes and checked result leases. `dup` and `clone` create
independent close guards; `retain` creates an independent native owner. Callback
resource leaves expire on return unless explicitly retained. Ruby exceptions
return after native cleanup, and Fiber switches reject before suspension.
The prepared gem authenticates and loads Lean and a private GMP automatically.
Its private C forwarders check the exact Fiddle storage layouts during the
producer build. Compatible copied and owned gems use one loader registry.
This profile requires MRI Ruby 3.3 on Linux x86-64 with 1:1 native threads.

The [C# ownership projection](../consume/dotnet.md#resource-containing-values)
uses nominal records and variants with sealed, disposable resource and closure
wrappers. Aggregate inputs borrow their resource leaves; returned wrappers own
checked leases. Callback borrows expire on return unless retained explicitly.
Typed delegates preserve higher-order signatures and rethrow the original host
exception after native cleanup. The prepared NuGet assembly authenticates and
loads Lean and private GMP automatically, sharing its loader with copied-value
packages. Creator-thread exit drains native owners even when managed wrappers
remain reachable. Finalizers queue cleanup rather than calling Lean from the
finalizer thread. This profile requires .NET 8 on Linux x86-64.

The [Java](../consume/java.md#owned-resources-and-aggregates) and
[Kotlin](../consume/kotlin.md#owned-resources-and-aggregates) ownership
projections use nominal values with `AutoCloseable` resource and closure
wrappers. Inputs borrow their resource leaves; returned wrappers own checked
leases. Callback borrows expire on return unless retained explicitly.
Calls and callbacks stay on the creating platform thread; virtual threads
reject. Closing from another thread queues release, and native thread exit
drains owners even when JVM wrappers remain reachable. Prepared Maven
packages authenticate their libraries and share compatible Lean and private
GMP dependencies with copied and recursive packages. Consumers compile with JDK 22
and can deploy with a Java 22 runtime. They do not need Lean, native declarations
or a native compiler.

The [Perl ownership projection](../consume/perl.md#resource-containing-values)
uses generated nominal records and constructors, dense array references and
checked resource wrappers. Borrowed callback wrappers expire on return;
`retain` creates an independent result owner. Perl exceptions preserve their
identity after native cleanup. Each XS image contains the compiler-checked C
ownership adapter. Prepared CPAN packages authenticate XS, the Lean component
and private GMP before loading, including after a warm import. Independent
components share compatible libraries and reject foreign resource owners.
CPAN module names stay outside the language-neutral Lean model.

The [native PHP ownership projection](../php.md#resource-containing-values)
uses readonly value classes, consecutive-key arrays and opaque resource or
closure wrappers. Callback borrows expire on return; `retain()` creates an
independent lease. The private FFI adapter validates fields and types in both
weak and strict callers, preserves the original callback `Throwable`, and
releases partial results after failure. Prepared Composer packages authenticate
their bundled Lean, ownership adapter and private GMP libraries before loading.
Compatible owned and copied packages share one runtime. Native calls run in the
main NTS CLI context; post-fork and Fiber calls reject. PHP-Wasm ownership is a
separate transport and is not admitted by this projection.

## Rich values cross as rich values

The `result` constructor stores its arguments as `[success, error]`. Lean `Except ε α` therefore lowers to `result<α, ε>`. For example, `Except String UInt32` becomes `result<uint32, string>`, with a numeric success payload and a text error payload. This argument order is part of the IR contract, independent of the order used by a source language. Recognizing the type during analysis does not enable compound signatures in ordinary compiled packages; those still require their transport adapters.

The Alpha fixture declares this copied record:

```json
{
  "id": "lean:Alpha.Payload",
  "kind": "record",
  "representation": "copied",
  "fields": [
    { "name": "enabled", "type": { "kind": "primitive", "name": "bool" } },
    { "name": "count", "type": { "kind": "primitive", "name": "uint32" } },
    { "name": "label", "type": { "kind": "primitive", "name": "string" } },
    { "name": "bytes", "type": { "kind": "primitive", "name": "bytes" } },
    {
      "name": "values",
      "type": {
        "kind": "apply",
        "constructor": "array",
        "arguments": [{ "kind": "primitive", "name": "uint32" }]
      }
    }
  ]
}
```

The shortened example omits required documentation and mutability fields. The complete fixture is the executable contract. A JavaScript backend can project `bytes` as `Uint8Array` and `values` as an array or typed array after recording that target choice. A C backend can project fixed-width fields and explicit spans. Both projections originate from the same record definition and must round-trip the same values.

`List α` uses `{ "kind": "apply", "constructor": "list", "arguments": [α] }`,
with exactly one type argument. `list` and `array` remain different source types
even when a host represents both with an array. Reviewed-source reconciliation
rejects substituting one for the other. npm's copied transport uses the same
ordered sequence slot layout for both; typed Lean adapters perform the List
conversion. Copied Lists have installed-package checks across all seventeen
consumer profiles on both source paths. See the [List acceptance audit](../evidence/lists-acceptance-20260921.md).

Alias expansion must terminate at a primitive or a nominal definition. The
validator rejects direct alias cycles and cycles hidden inside containers.
Recursion through a named record or variant is a distinct type graph and remains
valid IR. Valid IR does not establish compiled support: the
[structured-type implementation record](../evidence/structured-types-20260921.md)
tracks adapters and installed acceptance separately.

The [recursive copied transport implementation](../evidence/recursive-copied-transport-20260922.md)
uses finite nominal references and iterative value traversal with separate schema,
value-depth, node and byte limits. Its graph comparison preserves the public IR's
identities and field order. [Fresh Lean extraction](../evidence/recursive-copied-metadata-20260922.md)
retains recursive definitions in closed nominal tables, checks their compiler
representations, and reconciles independently reviewed recursive contracts.
[Typed carriers and bounded C/Wasm walkers](../evidence/recursive-copied-adapters-20260922.md)
execute with input validation and partial-output cleanup.
[Compiled npm packages](../evidence/npm-recursive-20260922.md) use private ABI 8
for recursive graphs. A native allocation ledger owns the result; the loader
checks each returned buffer against that ledger before copying it. Cleanup does
not follow result pointers. [Native C transport checks](../evidence/native-recursive-transport-20260922.md)
now execute typed layouts, bounded conversions and private allocation cleanup
against freshly compiled Lean. [Native graph components](../evidence/native-graph-components-20260922.md)
compile and verify ordinary and independently reviewed exports through the
shared runtime. Host adapters must explicitly support their finite graph model.
Each consumer adapter must pass its own installed acceptance.
[C++ recursive value declarations](../evidence/cpp-recursive-values-20260922.md)
use named constructors, standard containers and deep-copy boxes.
[Bounded C++ conversions](../evidence/cpp-recursive-conversions-20260922.md)
check all arguments before creating views and release native results after
copying, including on allocation failure. [Native runtime retirement](../evidence/native-retirement-20260923.md)
rejects later calls through cached components while preserving owned-value
cleanup. The checked graph boundary retires malformed native results and
preserves recovery for input, limit and bridge-allocation failures.
[C/GMP graph values and conversions](../evidence/gmp-recursive-conversions-20260923.md)
use exact GMP integers, borrowed input children and independently owned results.
Root-relative integer finalizers remain valid when the result moves into caller
storage. [Prepared C/C++ graph packages](../evidence/native-recursive-packages-20260923.md)
pass ordinary-source and reviewed-contract installed checks through both public
APIs, including compiler-free execution after source and header removal.
[Rust graph declarations and conversions](../evidence/rust-recursive-conversions-20260923.md)
use owned structs/enums, native containers and boxed recursive fields. Their
guarded calls validate inputs, release native results through RAII and reject
publication after runtime retirement. [Prepared recursive Cargo packages](../evidence/rust-recursive-packages-20260923.md)
connect these conversions to authenticated embedded libraries and automatic
shared-runtime loading. Installed consumers compile offline and execute after
the author and installed source trees are removed.
[Python recursive declarations](../evidence/python-recursive-values-20260923.md)
provide named frozen dataclasses, constructor unions and bounded runtime type
annotations, with CPython execution and strict typing checks.
[Python native graph conversions](../evidence/python-recursive-conversions-20260923.md)
now pass independent C layout checks and ordinary/reviewed compiled Lean calls,
including bounded copies, allocation failures and retirement cleanup.
[Prepared recursive Python wheels](../evidence/python-recursive-packages-20260923.md)
connect those conversions to precise public functions and the authenticated
automatic loader. Private loader imports cannot be shadowed by public type names.
Offline-installed wheels run after relocation and removal of author inputs and
archive handoffs. Compatible recursive and acyclic packages share one runtime.

[Ruby recursive declarations](../evidence/ruby-recursive-values-20260923.md)
provide frozen keyword-initialized records and named constructor families,
pattern matching, exact-class value equality and finite alias metadata. MRI
execution covers direct and mutual recursion and shared structural aliases.
[Ruby native graph conversions](../evidence/ruby-recursive-conversions-20260923.md)
pass independent C layout probes and ordinary/reviewed compiled Lean calls.
Scoped buffers and pre-bound native cleanup release results on allocation errors
and interruptions. [Prepared recursive Ruby gems](../evidence/ruby-recursive-packages-20260923.md)
connect these conversions to named public functions and authenticated loading.
Original offline-installed gems run after relocation and producer removal.
Three-package checks cover shared retirement and fork rejection before loader
lock acquisition; independent builds reproduce archives and installed files.

[Perl recursive declarations](../evidence/perl-recursive-values-20260923.md)
preserve mutable named-field classes, recursive nominal edges and transparent
aliases. The declaration test runs on all four pinned Perl ABIs.
[Perl native graph conversions](../evidence/perl-recursive-conversions-20260923.md)
use bounded XS readers and writers with destructor-registered native cleanup.
Ordinary and reviewed Lean calls test exceptions, signals and retirement during
result construction. [Prepared recursive CPAN packages](../evidence/perl-recursive-packages-20260923.md)
connect those converters to authenticated automatic loading. Two independent
builds reproduce archives across all four Perl ABIs and both installation modes.
Shared-package checks cover private symbol collisions, coordinate conflicts,
retirement and inherited-closure cleanup while the runtime lock is held at fork.

[C# recursive declarations](../evidence/dotnet-recursive-values-20260923.md)
preserve nominal records and cases, typed arrays, nested value tuples and
transparent aliases. Compiled consumer checks cover bounded structural equality,
matching hashes, patterns and cycle rejection.
[Bounded C# native converters](../evidence/dotnet-recursive-conversions-20260923.md)
validate every argument before allocation and initialization, copy results into
managed values, and release native arenas on failure. Ordinary and reviewed Lean
components exercise malformed-output retirement, allocation failures and cleanup.
[The recursive NuGet package layer](../evidence/dotnet-recursive-packages-20260923.md)
connects these converters to public typed
methods and authenticated automatic loading. Original ordinary-source and
reviewed archives pass offline installs, relocated SDK-free runs and native
asset-tampering checks. Independent builds reproduce both installed archives.
Three-package tests exercise mixed C++/NuGet builds and shared retirement.
Coordinate-conflict tests reject a different build before loading it and preserve
the first package; identical builds can share the component. Shared-build
regressions and source evidence remain before final installed acceptance.
[Existing C# family regressions](../evidence/dotnet-recursive-family-regressions-20260923.md)
preserve public behavior and failure checks on both source paths without
rewriting older package identities.

[Java recursive declarations](../evidence/jvm-recursive-values-20260923.md)
preserve named records, sealed cases, typed arrays and transparent aliases.
Iterative equality, hashing and formatting reject cycles and enforce value
budgets. Typed builders handle constructors exceeding the JVM argument-slot
limit. [Java native graph converters](../evidence/jvm-recursive-conversions-20260923.md)
use iterative FFM readers and writers, validate all inputs before native
allocation or initialization, and release owned output through a pre-bound C
cleanup helper. Independent C layout probes and fresh ordinary/reviewed Lean
calls check bounded copying, allocation failures and shared-runtime retirement.
Java and Kotlin use separate typed value classes over the same finite layouts,
scalar codecs and iterative conversion engine. Kotlin retains non-null metadata
and uses type-table references for deeply nested arrays. Recursive Maven builds
include both APIs, an authenticated lazy loader and the native root-cleanup
helper. [Package tests](../contributing/testing.md#recursive-java-and-kotlin-packages)
cover offline installation and runtime-only execution. Shared-package and
cross-language regression acceptance remain under development.

[PHP recursive value declarations](../evidence/php-recursive-values-20260923.md)
use final readonly records and variant cases, precise PHPDoc containers, and
transparent aliases. One iterative validator checks weak and strict callers,
rejects object and array-reference cycles, and preserves shared acyclic values.
The same generated source runs in native PHP and the actual 32-bit PHP-Wasm
interpreter. PHP integer width and Lean word width are separate model inputs.
The [native PHP converters](../evidence/php-recursive-conversions-20260923.md)
use the shared C graph declarations and iterative cursors. They validate and
copy inputs before loading a native target, copy outputs into independent PHP
values, and release root-owned native output in `finally`. Fresh ordinary and
reviewed Lean checks cover allocation failures and shared-runtime retirement.
The [recursive Composer package tests](../evidence/php-recursive-packages-20260923.md)
check public functions, authenticated lazy loading, offline installation,
native-asset tampering and independent archive reproduction. The package audit
regenerates every public and private source file. Shared-loading checks cover
recursive and ordinary packages, fork rejection, retirement and conflicting
native identities. Final cross-language acceptance remains open.

The shared C graph transport also accepts an explicit 32-bit word model for
PHP-Wasm. `USize` and `ISize` use four-byte fields; fixed-width `UInt64` and
`Int64` stay eight bytes. The adapter checks boxed 32-bit scalars using the
pinned Lean runtime representation and validates memory bounds before reads.
The [wasm32 transport gate](../evidence/wasm32-recursive-transport-20260923.md)
executes fresh Lean carriers through a test-only Zend probe.

The separate recursive PHP/Zend converter uses finite compiler-checked C
descriptors and iterative cursors. Public PHP objects become private wire lists;
the Zend adapter validates those lists before entering Lean. It copies results
into an owned PHP value tree before releasing the native root. Partially built
children stay attached to that root zval so a Zend bailout can release them.
Allocation and size-limit failures remain recoverable; malformed native results
retire the shared runtime. The [conversion gates](../contributing/testing.md#recursive-php-wasm-conversions)
exercise independent C producers and freshly compiled Lean separately.
The PHP-Wasm compiler admits these graphs through its own fixed 32-bit model.
Lean checks the generated total carriers; the C compiler checks their prototypes
and constructor allocations against the actual target headers. Releases retain
the graph layout, transport, lifecycle and allocation-guard identities. Artifact
verification regenerates the PHP and C sources before accepting a package.
Prepared npm descriptors mount all five PHP files, and companion Composer ZIPs
contain the same API. The [installed-package gate](../contributing/testing.md#recursive-php-wasm-packages)
exercises both authoring paths in Node and Chromium. The
[reproduction and shared-loading gates](../evidence/php-wasm-recursive-loading-20260924.md)
rebuild the runtime and both source projects, reproduce npm/Composer archives,
and exercise original graph and acyclic packages in one interpreter. Duplicate
descriptors reuse libraries; conflicting compiled identities reject before
startup. Runtime retirement blocks all packages without invalidating copied PHP
values. A failed lazy link prevents further link attempts through peers.
Historical-source regression verification and final cross-language acceptance
remain open.

Native component builds [check emitted constructor allocations](../evidence/native-allocation-guard-20260922.md)
against the verified runtime's allocator limits. Oversized allocations fail
before linking. Component receipts bind that check and native packages retain
its header alongside their compilation evidence.

Compiled npm variants use private ABI 7, with a closed named-type table and
constructor-specific copied fields. Generated Lean helpers construct and match
values through typed one-element Array carriers. Native C adapters never inspect
source-defined Lean constructor tags or field offsets. The host discriminator is `kind`; its
value is the source constructor name. Runtime tag 37 carries the authenticated
constructor ordinal and only that constructor's fields. ABI 7 also preserves
concrete copied aliases and their named targets. Source extraction retains
alias chains, including return-only aliases; reviewed contracts must match those
names and targets. Aliases add no wire tag or ownership wrapper. See
[installed variants](../evidence/npm-variants-20260921.md) and
[installed aliases](../evidence/npm-aliases-20260921.md).

Native private conversion helpers normalize copied aliases to their checked
target representation while canonical Binding IR retains each named link.
C headers export `<prefix>_<snake_name>_t` typedefs with aggregate initialization
and cleanup helpers; C++ exports source-named `using` declarations. Public-name
collisions fail before packaging. See the
[installed C/C++ alias checks](../evidence/native-aliases-20260921.md).

Python exposes source-named `TypeAlias` declarations in its module and stubs.
Aliases retain the target's ordinary values and checks: record aliases use the
same frozen dataclass, container aliases retain list-or-tuple inputs and tuple
results, and an alias of Nat still rejects negative input. The
[installed Python alias checks](../evidence/python-aliases-20260921.md) include
strict checking and repeated execution after installation relocation.

Rust exposes source-named `pub type` declarations, retaining alias chains and
aliases inside compound targets and record fields. Strings and sequences keep
`&str` and slice inputs; other aggregate inputs borrow their alias. Returned
values own their copied data. The [installed Rust alias checks](../evidence/rust-aliases-20260921.md)
verify both source paths, static rejection, error and panic cleanup, and
source-free executables.

.NET retains copied alias identities, original targets and chains in installed
metadata and XML API documentation. C# signatures use the target CLR values;
source-file aliases cannot be exported from a NuGet assembly. The
[installed .NET alias checks](../evidence/dotnet-aliases-20260921.md) verify
both source paths, static rejection, conversion cleanup, and relocated execution
with a runtime but no SDK. Nat aliases still reject negative `BigInteger` values.

Java and Kotlin consume the same prepared Maven JAR. It contains the Java API and
a non-nullable Kotlin companion API, both using transparent alias target values.
The Maven manifest, README and Java source documentation preserve alias
names, targets and chains at parameters, results and record components. This
profile adds neither wrapper classes nor separate Kotlin typealias declarations.
The [installed JVM alias checks](../evidence/jvm-aliases-20260921.md) verify both
languages on both source paths, exact ranges, conversion failures and relocated
runtime-only execution. The [Kotlin companion checks](../evidence/kotlin-collections-20260922.md)
also exercise the Kotlin API's alias signatures and shared runtime ownership.

Ruby callers use ordinary target values. Prepared gems preserve copied alias
names, original targets and chains in their manifest, README and public API
comments at parameters, results and record fields. No separate Ruby constants
or wrapper classes are generated. Target constraints remain enforced when
calling Lean, including Nat's nonnegative range. The
[installed Ruby alias checks](../evidence/ruby-aliases-20260921.md) verify both
source paths, failure cleanup and relocated compiler-free execution.

Perl callers also use transparent target values. Prepared CPAN archives retain
the alias catalog in `binding-manifest.json`; installed POD preserves names,
original targets, chains and parameter/result/record-field contracts. No extra
Perl packages or wrapper identities are generated. Aliases retain exact target
checks and the existing XS conversion path. See the
[installed Perl alias checks](../evidence/perl-aliases-20260921.md).

Native PHP callers use transparent target values. Composer archives retain
alias names, original targets and chains in the binding manifest. Installed
PHPDoc records target types and original Lean contracts at parameter, result
and record-field sites, without alias wrapper classes. Weak and strict callers
receive the same target checks. See the
[installed native PHP alias checks](../evidence/php-native-aliases-20260921.md).

## Language-neutral core and producer metadata

The core contains concepts that every backend must understand:

- declarations and semantic types;
- value identity and mutation;
- ownership and lifetime transitions;
- failures, effects, and result delivery;
- capability requirements;
- documentation and assurance links.

The separation is explicit:

| Classification | Examples | Location |
|---|---|---|
| Universal semantics | Functions, records, resources, generics, ownership, lifetimes, failures, effects, and assurance states | Closed core fields |
| Target requirements | Browser host calls, runtime features, threads, async delivery, and optional target features | Capability records checked by each backend |
| Producer facts | Lean module names, elaborator output identity, export selection, source declarations, and proof-system provenance | Declared producer records and namespaced extensions |

Producer adapters supply this core. The first adapter reads Lean declarations, elaborated types, export selection, and proof provenance. Lean-specific facts remain under namespaced keys such as `lean-lang.org/module` and `lean-lang.org/export`. Bridge-generated facts use a separate namespace such as `lean-wasm.org/evidence`.

The validator rejects unnamespaced extension keys and references to undeclared producers. Another proof system or schema compiler can add an adapter without adding its declaration syntax to the core. It must still express ownership and proof meaning precisely. Language neutrality does not permit an adapter to erase those facts.

`createBindingIrFrontend` binds a producer ID, adapter name, and adapter version to an analysis function. It validates the returned graph, verifies the producer declaration, clones the result, and freezes it before a backend sees it. Contract tests exercise this boundary with a schema-produced arithmetic component that contains no Lean declaration or Lean metadata.

## Validation boundary

The JSON Schema rejects malformed and unknown fields. The JavaScript contract validator checks rules that require the complete graph, including unique identities, producer references, named type resolution, generic parameter scope, copied record closure, ownership compatibility, lifetime anchors, error references, capability references, assurance subjects, and async effects.

All generators MUST validate the IR before emitting files. A generator MUST reject an unknown schema version. Target-specific choices belong in backend capability analysis or namespaced metadata, never in an unreviewed core field.

## Canonical bytes and content identity

`canonicalizeBindingIr` emits compact UTF-8 JSON with these rules:

- object names are sorted by UTF-16 code unit;
- array order is preserved because declaration, parameter, field, and theorem order can carry meaning;
- numbers use ECMAScript JSON serialization and must be finite;
- strings and object names must contain valid Unicode scalar values;
- reference cycles, sparse arrays, non-JSON values, and non-plain objects are rejected; and
- the canonical byte sequence has no trailing newline.

These rules follow the JSON Canonicalization Scheme ordering and primitive serialization model. `hashBindingIr` computes SHA-256 over the canonical UTF-8 bytes. The reviewed Alpha fixture has this semantic identity:

```text
154b11f957639e1180ec0a59d20a85bdea7af2ddfab50d670f06c5bea1d6198b
```

Changing object insertion order preserves the hash. Changing documentation, assurance, types, ownership, or any other recorded field changes the hash. Packages and provenance reports can therefore identify the exact reviewed semantic contract consumed by every backend.

## Compatibility rules

`schemaVersion` is a semantic major version. Version 3 consumers accept version 3 artifacts and reject every other version before generation. Unknown core fields also fail validation. Namespaced extension objects can add producer facts without changing the core schema, but a backend cannot depend on an extension to replace required core semantics.

The version diagnostic reports one of these outcomes:

| Outcome | Required action |
|---|---|
| Exact version | Validate the full graph, then generate. |
| Older version | Run a registered migration and review the new hash. |
| Newer version | Upgrade the consumer before generation. |
| Invalid version | Regenerate with a conforming frontend. |

The version 1 to version 2 migration adds a null callable slot to existing record, resource, and alias definitions. Version 3 adds semantic variant cases, host projection metadata, and an explicit resource owner for constructors, methods, static methods, and properties. The migrator infers owners for constructors and instance members. It rejects a version 2 static method because its owner cannot be inferred safely. Migration returns a new validated artifact with a new content identity. It does not edit the older artifact.

## CLI contract

CI and agents can inspect the IR without loading a host backend:

```sh
npm run binding-ir -- validate poc/lean-link-spike/bindings/alpha.binding-ir.json
npm run binding-ir -- hash poc/lean-link-spike/bindings/alpha.binding-ir.json
npm run binding-ir -- diagnose poc/lean-link-spike/bindings/alpha.binding-ir.json
npm run binding-ir -- canonicalize poc/lean-link-spike/bindings/alpha.binding-ir.json
```

Diagnostics use stable error codes and structured details. The `diagnose` command emits JSON for automated migration and upgrade decisions.
