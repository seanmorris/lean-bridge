# Perl primitive callbacks and returned closures

Ordinary-source and independently reviewed CPAN packages pass 8,756 assertions
per source path on Perl 5.36.3 and 5.38.2, each threaded and unthreaded. The eight
installed executions use the same 58-export Lean library and 19 primitive types.
The [acceptance record](perl-callables-20260918.json) retains compiler/source,
consumer, model, receipt, archive and Perl ABI identities.

## Compiled contract

`Callables.lean` defines a host-callback application, a twice-applied callback,
and a captured, two-argument returned closure for each primitive. Lean checks
the identity lemma for each callback application. A separate `wordBits` export
reports the compiled 64-bit target. The public Perl mappings retain exact UV/IV
integers, Math::BigInt, native booleans, numeric floating-point values, Unicode
text, octet strings and `undef`.

`tests/helpers/callable-fixture.mjs` specifies the expected signatures without
reading compiler metadata. The reviewed contract authorizes synchronous
primitive arguments/results, repeated invocation, same-agent re-entry and
deferred self-disposal. Host callbacks use call-scoped borrows. Returned closures
use explicit leases. The outer parameter count determines the export arity;
fresh Lean metadata must match the entire remaining function type.

Reviewed admission rejects retained callbacks, async delivery, incompatible
ownership/failure policies, and callables inside copied containers. Four fresh
compiler rejection cases change callback inputs, callback outputs, closure
outputs or closure arity. Each fails before native linking and leaves no release
directory. npm scalar and copied C adapters still reject these signatures.

## Installed checks

Each run builds both CPAN distributions, relocates their receipt-checked archives,
removes the author and build directories, and installs offline into an empty
prefix with Lean/C compilers absent from the consumer PATH.
The consumer checks that its module and runtime came from that prefix.

The checks cover:

- Exact signed/unsigned bounds, values beyond 2^53, and 1,234-digit integers.
- Binary32 rounding, subnormals, signed zero, infinities and NaN classification.
- NUL, supplementary Unicode scalars, noncharacters, malformed text and octets.
- Distinct callback outputs, repeated application, captured closure state,
  closure input/result conversions and nested host/Lean calls.
- Invalid callback results, suppression of later callbacks after failure,
  original exception objects, recovery, closed and wrong-signature closures.
- Independent copies of captured Math::BigInt values, a rejected oversized
  callback result, and 100 create/call/close repetitions per primitive.
- Zero live scopes and host callbacks after each operation, with only explicitly
  retained closure wrappers remaining.

Run a configuration with:

```sh
export LEAN_BRIDGE_CORPUS_PERL="$PWD/.toolchains/perl/5.38.2-threaded/bin/perl"
export LEAN_BRIDGE_CALLABLE_REPORT=build/callables/perl-5.38.2-threaded.json
LEAN_BRIDGE_PERL_CALLABLE_TEST=1 node --test tests/perl-callables.test.mjs
```

Local acceptance used the 2.36 glibc floor. CI retains its 2.38 floor and runs
the same suite on all four pinned Perl configurations.

## Scope

This milestone enables reviewed Perl primitive callables and verifies both
source paths. The inventory adds callable primitive positions and reviewed
primitive input/result positions that were previously unaudited. Existing
copied-field evidence stays separate. The inventory has no separate primitive
closure-input/result columns; the acceptance record retains those executions.

Other languages' generic callable adapters, reviewed non-primitive callable
signatures, retained host functions, async calls and identity-bearing captures
remain open. NaN payload preservation is not claimed.
