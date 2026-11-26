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

## Reproduce the installs

Run `npm run test:native-once-callback` to build and install both native
targets. To replay without rebuilding, set `LEAN_BRIDGE_NATIVE_BUDGET_REPLAY`
to the retained directory containing `c/{ordinary,reviewed}` and
`cpp/{ordinary,reviewed}`. These standalone packages exercise callbacks
over integers, not callbacks transporting host objects.
