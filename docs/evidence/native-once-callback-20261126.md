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
For native PHP, run `npm run test:php-native-once-callback` with
`LEAN_BRIDGE_PHP_SCHEDULER_CACHE` pointing to the pinned Amp and Revolt
Composer cache. `LEAN_BRIDGE_TEST_PHPS` accepts a JSON array of absolute PHP
CLI paths with FFI. Use `LEAN_BRIDGE_PHP_NATIVE_BUDGET_KEEP` to retain the
handoffs, or set `LEAN_BRIDGE_PHP_NATIVE_BUDGET_REPLAY` to an existing
directory containing both route handoffs. This is not the PHP-Wasm test.
For CPAN, run `npm run test:perl-once-callback` with the [four Perl
interpreters and offline Future/IO::Async dependencies](../contributing/testing.md).
The client checks both prebuilt and installer-generated XS. Set
`LEAN_BRIDGE_PERL_BUDGET_KEEP` to retain the handoffs, or
`LEAN_BRIDGE_PERL_BUDGET_REPLAY` to use existing ordinary and reviewed
distributions.
For WIT/WASI pollable tasks, run `npm run test:wit-pollable-once-callback`
with the pinned Lean compiler, wasm-tools and Wasmtime C SDK. Set
`LEAN_BRIDGE_WIT_BUDGET_KEEP` to retain both handoffs or
`LEAN_BRIDGE_WIT_BUDGET_REPLAY` to replay them. The C client uses only
the installed Wasmtime API. This test does not exercise canonical futures.
