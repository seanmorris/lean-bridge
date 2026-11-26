# Returning a Lean function from a C++ callback

The [Lean implementation](../../tests/fixtures/onboarding/leased-closure-fields/Owned.lean)
applies a two-argument function. The ordinary flat API gives both arguments
to the host callback. With the [staged export contract](../../tests/fixtures/structured-types/tariff-staged-contract.json),
C++ instead receives the first argument and returns a typed Lean function.
Lean applies that function to the second argument. A public C++ lambda is
not itself a leased Lean function.

| Author route | Verified package | Installed executions |
| --- | --- | --- |
| Ordinary Lean project | [Receipt](cpp-staged-callback-results-20261126/ordinary.package-set.json) | [pkg-config and relocated CMake](cpp-staged-callback-results-20261126/ordinary.execution.json) |
| Independently reviewed interface | [Receipt](cpp-staged-callback-results-20261126/reviewed.package-set.json) | [pkg-config and relocated CMake](cpp-staged-callback-results-20261126/reviewed.execution.json) |

The [C++20 consumer](../../tests/fixtures/structured-types/tariff-staged.cpp)
checks that missing recovery and a scalar in place of a function reply do not
satisfy the generated API at compile time. It then exercises six cases:

1. A flat scalar callback still receives both arguments.
2. A callback returns a fresh Lean function; Lean calls it and computes 93.
3. Returning a caller-owned function computes 703 and leaves the caller's
   original function usable.
4. A correctly typed but closed recovery function is rejected before the host
   callback runs.
5. A host callback constructs and invokes a function, then throws. The caller
   catches the original C++ exception, not a successful recovery value.
6. A callback returning a closed function is rejected after one invocation.
   A subsequent valid call on the same binding succeeds.

The pkg-config client contains no lifetime instrumentation. A second build
of the same application uses the relocated CMake package and a separate
[test observer](../../tests/fixtures/structured-types/tariff-cpp-probe.cpp).
The native broker has only the owner thread's session after every case and
zero live identities after that thread exits. Neither client needs the Lean
compiler, source tree or producer output to run.

Local toolchain: Lean 4.32.2, GCC/G++ 12.2.0, CMake 3.31.6, Linux x86-64
with the glibc 2.36 test floor. The GMP 6.3.0 kit matches the digest in the
[native toolchain receipt](c-retained-tasks-20261122.json).

To reproduce, run `npm run test:cpp-staged-callbacks` with the native author
toolchain. To retain verified handoffs use `LEAN_BRIDGE_CPP_TARIFF_KEEP`;
to test the same archives again set `LEAN_BRIDGE_CPP_TARIFF_REPLAY` to the
directory containing `ordinary/` and `reviewed/`. These Linux x86-64 tests
exercise a synchronous function reply, not a long-lived host registration.
