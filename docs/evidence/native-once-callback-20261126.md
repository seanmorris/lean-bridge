# One call per native task registration

The [Budget program](../../tests/fixtures/javascript-once-callback/Budget.lean)
accepts two functions with the same Lean type: the author allows one call to
`f` and repeated calls to `g`. The [race](../../tests/fixtures/native-callback-budget/Racing.lean)
starts two Lean workers sharing one registration. One must get a value and
the other must receive the policy error. The host client independently counts
how many times its own function ran.

## C11

The [ordinary package](native-once-callback-20261126/c/ordinary.json) and
[reviewed package](native-once-callback-20261126/c/reviewed.json) have distinct
archive hashes and the same runtime identity. For each release the installer
verified the receipt, moved the extracted package to a new prefix, and
compiled the [C client](../../tests/fixtures/native-callback-budget/client.c)
using the installed `pkg-config` metadata. The binary ran with Lean off its
search path.

On both installs:

- All 16 races admitted one host call. Reusing a callable in two positions
  gave each position its own allowance; an independent task could reuse it.
- A caught application failure still spent the allowance. A fresh, uncaught
  application failure returned the original payload, not a policy error.
- A duplicate during startup returned the same policy status as a duplicate
  during task execution. A replacement Lean error with the exact same text
  remained a terminal IO error.
- Both C context destructors ran exactly once. The already-loaded broker
  reported zero live leases.

## C++20

The [ordinary archive](native-once-callback-20261126/cpp/ordinary.json) and
[reviewed archive](native-once-callback-20261126/cpp/reviewed.json) each
passed a separate relocated install. The [C++ client](../../tests/fixtures/native-callback-budget/client.cpp)
used only the installed public header and pkg-config flags. Both packages
had the same runtime identity as the C11 releases.

In each of 16 races per package, one worker entered the host closure and
the other was denied. The future threw the component's typed
`CallbackAlreadyInvoked`. A host exception with identical text came back
as the original `std::exception_ptr`; an error Lean created after catching
the policy violation came back as `TaskIOError`. A weak pointer confirmed
the callback held its capture while registered and released it on
destruction. The broker had zero live leases at the end.

## Rust

The [ordinary crate](native-once-callback-20261126/rust/ordinary.json) and
[reviewed crate](native-once-callback-20261126/rust/reviewed.json) both
passed offline installs. They have different component archives and depend
on the same runtime crate, byte for byte. Each compiled the
[Rust client](../../tests/fixtures/native-callback-budget/client.rs) against
the installed packages before moving the binary away from the build inputs.

Each of 16 worker races admitted exactly one callback. The client matched
a policy refusal as `Fault::CallbackAlreadyInvoked`, distinguished a typed
startup failure carrying 73, and recovered the original application error
by identity—even when that error wrapped a genuine earlier policy fault.
Lean's new IO error with the same message remained a task IO error.
Closing the registration released the captured object and left zero leases.

## Ruby

The [ordinary gem](native-once-callback-20261126/ruby/ordinary.json) and
[reviewed gem](native-once-callback-20261126/ruby/reviewed.json) ran on MRI
3.3.12 from separate, relocated local installations. The [Ruby client](../../tests/fixtures/native-callback-budget/client.rb)
uses the generated methods and `RetainedCallback`. In each of 16 races
one worker entered the block. The other received the component's
`CallbackAlreadyInvoked` exception naming the Lean declaration.

The client distinguishes that refusal from a failed task factory, an error
inside the task with the same message, and a typed error carrying 73.
Throwing a previous policy exception *as a Ruby application exception*
returns the same object, not a new policy refusal. A weak reference
confirmed that closing the reusable callback released its capture. The
loaded broker reported one initialization and zero live leases.

## .NET

The [ordinary NuGet release](native-once-callback-20261126/dotnet/ordinary.json)
and the [reviewed release](native-once-callback-20261126/dotnet/reviewed.json)
each passed an offline restore and a second run on an SDK-free .NET 8 runtime
after removing the feed, build project and package cache. The
[C# client](../../tests/fixtures/native-callback-budget/Client.cs) awaited the
generated API directly. Across 16 races per release only one worker invoked the
delegate per registration. Original exception identity survived rethrow;
the factory IO error, typed startup error and terminal IO error stayed
distinct. Closing the registration released its capture and the native
broker finished with zero live leases. The two NuGet archives are distinct;
both contain the same native runtime libraries.

## Java and Kotlin

The [ordinary Maven package](native-once-callback-20261126/jvm/ordinary.json)
and [reviewed Maven package](native-once-callback-20261126/jvm/reviewed.json)
each ran two independently compiled applications: the
[Java future client](../../tests/fixtures/native-callback-budget/JavaBudget.java)
and [Kotlin suspend client](../../tests/fixtures/native-callback-budget/KotlinBudget.kt).
Both ran offline on a Java 22 runtime containing only `java.base`, with JNI
checking enabled. Each application raced two Lean workers 16 times per
release. Only one invocation reached the host in each race. Independent
slots and tasks remained usable. The original exception, same-text factory
and terminal errors, and typed startup failure (payload 73) stayed distinct.
Both clients observed the capture released and zero live broker leases.
The distinct JARs used the same broker, Lean runtime and owner library.

## Native PHP

PHP 8.2.35 and 8.5.10 ran the same [Composer client](../../tests/fixtures/native-callback-budget/client.php)
against both the [ordinary package](native-once-callback-20261126/php/ordinary.json)
and the [reviewed package](native-once-callback-20261126/php/reviewed.json).
In all four runs, only one of two racing workers reached PHP in each of 16
trials. A callback that threw consumed its permit. The client distinguished
the original exception (even a previously caught policy refusal), factory
and terminal IO errors with identical messages, and typed payload 73.
The retained capture was collected and the broker finished with zero leases.
Both archives embed the same broker and Lean runtime. The reviewed input
reconstructed from the ordinary interface and the author's change matches
the compiler's recorded source digest. These are native PHP runs, not Zend
inside WebAssembly.

## Perl

The same [downstream Perl program](../../tests/fixtures/native-callback-budget/client.pl)
ran against the [ordinary](native-once-callback-20261126/perl/ordinary.json)
and [reviewed](native-once-callback-20261126/perl/reviewed.json) CPAN packages.
Each ran on Perl 5.36.3 and 5.38.2, threaded and unthreaded, with both
prebuilt and installer-compiled XS. Across those 16 installations, exactly
one worker entered Perl in each of 256 two-worker races. Throwing spent
the callback's allowance. Reusing the same callback in another slot or task
did not spend that slot's allowance. The client distinguished a policy
refusal, the original Perl exception, and a typed startup failure (73).
Closing the registration released the captured object. All four broker
counters (identities, wrappers, callbacks and scopes) ended at zero.

The [ordinary package receipt](native-once-callback-20261126/perl/ordinary.package-set.json)
and [reviewed package receipt](native-once-callback-20261126/perl/reviewed.package-set.json)
identify distinct component archives and the same runtime archive. Independent
verification covered all 25 manifest-listed component files and all 36 runtime
files on each route, including the Lean component and the four prebuilt XS
binaries. The reviewed author input reconstructed from the ordinary interface
matches the compiler's recorded SHA-256 (`8780c3c5…`).

## WIT/WASI pollable tasks

The [ordinary](native-once-callback-20261126/wit-pollable/ordinary.json) and
[reviewed](native-once-callback-20261126/wit-pollable/reviewed.json) releases
shipped the same component, WIT world, and three runtime libraries in distinct
archives. Each component matched its installed world with `wasm-tools component
targets`. The [Wasmtime client](../../tests/fixtures/native-callback-budget/wit-client.c)
linked from the relocated package and ran without the SDK.

In each of 16 two-worker races per release, only one call reached the host.
The other received the payload-free `callback-already-invoked` case. Guest
callback errors, typed startup failure, and same-text factory and terminal IO
failures remained distinct. Both callback owners were destroyed and the broker
returned to zero live leases. This covers pollable tasks, not canonical futures.

The canonical runner has a separate [guest callback dispatcher](../../src/backends/wit/canonical-callback.mjs).
In an executable Wasm test, one guest registration handled three owned requests:
a byte-list argument produced a signed 64-bit reply, a guest failure preserved
its UTF-8 text and embedded NUL, and a late reply returned false. The issuer
observed exactly three consumed requests. Run `npm run test:wit-canonical-callbacks`.

To check the link against both original pollable packages, set
`LEAN_BRIDGE_WIT_CALLBACK_TASK_RELEASES` to their handoff directory and
`LEAN_BRIDGE_ASYNC_WASMTIME_C_API` to the canonical runner's Wasmtime 51 SDK.
`npm run test:wit-canonical-callback-link` verifies the sealed receipts, rebuilds
the exact archived Wasm bytes, validates the composed type graph for nine Lean
methods and eleven request sites, and compiles the native import declarations
against that SDK. Neither check is an installed canonical-future result.

## WIT/WASI canonical futures

The [downstream application](../../tests/helpers/wit-canonical-budget-client.mjs)
imports nine Lean task methods and reads standard WIT futures. Its
[provider](../../tests/fixtures/native-callback-budget/canonical-provider.wat)
owns the callbacks. Lean workers enqueue requests; only the Wasmtime store
owner invokes the provider. A task retains each callback slot separately.
Dropping a reader before delivery releases the registration without calling it.

Both source routes passed a native scheduler check. For each, the test
recompiled the four original Lean modules and matched the compiler, sources,
generated C and native runtime libraries to the sealed pollable release.
Using those modules, Wasmtime 51 ran 27 canonical futures per route. The
application counted actual callback calls, checked the results of 16
two-worker races and distinguished a one-call refusal from guest, factory,
worker and typed failures. Guest registrations returned to zero.

In a second [application](../../tests/fixtures/native-callback-budget/canonical-siblings.wat),
three tasks borrowed the same guest registration before any callback ran.
The guest released its own reference and dropped the middle reader. The other
readers returned 21 and 41; exactly two calls reached the provider, and its
live count returned to zero. Both routes passed with the command linked to
a separate native component using the package's exported-symbol list.

To reproduce, use the two release inputs for `test:wit-canonical-callback-link`
above, set `LEAN_BRIDGE_LEAN_PREFIX` to the matching toolchain and
`LEAN_BRIDGE_WIT_CALLBACK_NATIVE_RUNTIME` to the matching runtime directory
containing `include/` and `lib/`. This checks runtime behavior, not the
contents or relocatability of a newly produced canonical package.

## Reproduce the installs

Run `npm run test:native-once-callback` to build and install both native
targets. To replay without rebuilding, set `LEAN_BRIDGE_NATIVE_BUDGET_REPLAY`
to the retained directory containing `c/{ordinary,reviewed}` and
`cpp/{ordinary,reviewed}`. These standalone packages exercise callbacks
over integers, not callbacks transporting host objects. Run
`npm run test:rust-once-callback` for Cargo, or set
`LEAN_BRIDGE_CARGO_BUDGET_REPLAY` to the handoff directory containing `cargo/`.
For MRI, run `npm run test:ruby-once-callback`; set
`LEAN_BRIDGE_RUBY_BUDGET_REPLAY` to the directory containing `rubygems/`
to reuse the sealed gems.
For .NET, run `npm run test:dotnet-once-callback` or set
`LEAN_BRIDGE_DOTNET_BUDGET_REPLAY` to the handoff directory containing
`ordinary/` and `reviewed/`.
For Java and Kotlin, run `npm run test:jvm-once-callback` with JDK 22,
Kotlin 2.2.0 and the offline Maven seed in `LEAN_BRIDGE_JVM_TASK_M2_SEED`.
Set `LEAN_BRIDGE_JVM_BUDGET_REPLAY` to the directory containing both
sealed Maven handoffs to skip rebuilding.
For native PHP, run `npm run test:php-native-once-callback` with
`LEAN_BRIDGE_PHP_SCHEDULER_CACHE` pointing to the pinned Amp and Revolt
Composer cache. `LEAN_BRIDGE_TEST_PHPS` accepts a JSON array of absolute PHP
CLI paths with FFI. Use `LEAN_BRIDGE_PHP_NATIVE_BUDGET_KEEP` to retain the
handoffs, or set `LEAN_BRIDGE_PHP_NATIVE_BUDGET_REPLAY` to an existing
directory containing both route handoffs. This is not the PHP-Wasm test.
For CPAN, run `npm run test:perl-once-callback` with the [four Perl
interpreters and offline Future/IO::Async dependencies](../contributing/testing.md).
The qualifier checks those interpreters, dependencies, and the package's
glibc floor before compiling. On a glibc 2.36 build host, set
`LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36` for local qualification. The
default stays 2.38; a library requiring a newer symbol version must still fail.
The client checks both prebuilt and installer-generated XS. Set
`LEAN_BRIDGE_PERL_BUDGET_KEEP` to retain the handoffs, or
`LEAN_BRIDGE_PERL_BUDGET_REPLAY` to use existing ordinary and reviewed
distributions.
For WIT/WASI pollable tasks, run `npm run test:wit-pollable-once-callback`
with the pinned Lean compiler, wasm-tools and Wasmtime C SDK. Set
`LEAN_BRIDGE_WIT_BUDGET_KEEP` to retain both handoffs or
`LEAN_BRIDGE_WIT_BUDGET_REPLAY` to replay them. The C client uses only
the installed Wasmtime API. This test does not exercise canonical futures.
For canonical futures, run `npm run test:wit-canonical-once-callback` using
the pinned Lean compiler, wasm-tools and the complete Wasmtime 51 C SDK
(`LEAN_BRIDGE_ASYNC_WASMTIME_C_API`). Set `LEAN_BRIDGE_WIT_CANONICAL_BUDGET_KEEP`
to retain the original handoffs, or `LEAN_BRIDGE_WIT_CANONICAL_BUDGET_REPLAY`
to verify and run both existing archives without rebuilding Lean.
