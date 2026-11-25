# Return a Lean function directly from a C callback

The [two exports](../../tests/fixtures/onboarding/leased-closure-fields/Owned.lean)
have the same Lean implementation, `choose base units`. The flat contract
gives C both numbers and expects a number back. The
[staged contract](../../tests/fixtures/structured-types/tariff-staged-contract.json)
gives C only `base`; the callback returns a function and Lean applies it to
`units`. No C function pointer is stored as a Lean closure.

| Author route | Installed package-set receipt | Consumer execution |
| --- | --- | --- |
| Ordinary Lean source and export contract | [Receipt](c-staged-callback-results-20261125/ordinary.package-set.json) | [Results](c-staged-callback-results-20261125/ordinary.execution.json) |
| Independently authored reviewed interface | [Receipt](c-staged-callback-results-20261125/reviewed.package-set.json) | [Results](c-staged-callback-results-20261125/reviewed.execution.json) |

The [installed client](../../tests/fixtures/structured-types/tariff-staged.c)
checks six observable results:

1. The flat callback receives both numbers once and computes 103.
2. The staged callback receives one number and supplies a freshly owned
   function. Lean computes 93. The saved handle is stale after the call.
3. The callback returns a function its caller already owns. Lean computes
   703. The independent owner still works until explicitly released.
4. Without a typed recovery function, the bridge rejects the call before
   invoking the callback.
5. If the callback reports an error after supplying a freshly owned reply,
   the caller receives `CALLBACK_FAILED` and the supplied handle expires.
6. If the callback supplies a function from another session, the caller
   receives `INVALID_ARGUMENT` and the foreign reply owner is released.

Failure never publishes the private recovery function's answer or an output
owner. The application can still call its original recovery function.
The pkg-config client uses only the public header. A second executable
built with relocated CMake also reads an identity count after **every** case:
one live session, then zero after closing it. Both clients run without the
Lean project or release producer. Each execution report binds the two client
source digests to the verified package receipt.

Run `npm run test:c-leased-closure-fields` with the pinned author toolchain
to reproduce the Linux x86-64 C11 checks. These results concern synchronous
callbacks that return an actual typed Lean function; they do not establish
registration of an arbitrary C callback for use after it returns.
