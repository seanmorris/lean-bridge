# Perl recursive native conversions

The private XS adapter calls compiled Lean with finite recursive copied values.
It uses the mutable named-field classes from the
[declaration milestone](perl-recursive-values-20260923.md). Arrays, Lists and
products use array references. `undef`, `Some->new(undef)` and nested `Some`
wrappers remain distinct; `Ok` and `Err` retain their branches.

## Conversion and cleanup

Typed C readers and writers follow the finite graph layout. Recursive fields
retain pointers to named nodes instead of expanding type definitions. Callers
pass Perl classes and containers, with no C pointers, tags or JSON encoding.
All nineteen primitive conversions preserve the existing Perl conventions,
including `Math::BigInt`, exact integer ranges, Unicode, embedded NUL, octet
strings, Float32 rounding, NaN classification, infinities and signed zero.

Readers check exact generated classes and fields, reject tied containers and
sparse arrays, and pin fields and sequence slots before child conversion can
invoke Perl code. `Math::BigInt` subclasses retain their existing `bstr` behavior;
its result must spell a finite integer. Perl boolean scalars remain valid integer
inputs, and integer scalars remain valid float inputs. Cycles and types without
finite inhabitants reject before invoking Lean. Shared branches produce
independent output values.

All arguments validate before Lean initialization or native graph invocation.
Validation can allocate bounded C scratch buffers. Input and output share a
262,144-node allowance, depth limit 128 and 16 MiB native-copy budget. A separate
16 MiB allowance accounts for conversion storage. These budgets do not bound
the Lean algorithm's working memory or every Perl allocator overhead.

The adapter registers its scope destructor before conversion. Native outputs
have a pre-bound cleanup function before invocation. Both normal returns and
Perl exceptions release the native result and scratch buffers. Cleanup reads
only the root owner, clears it first and never traverses malformed children.
Perl results remain mortal in the caller's temporary scope, avoiding an
unregistered reference between freeing inner temporaries and publishing the
result. Calls reacquire the Perl stack after callbacks that can grow it.

Malformed native values retire the shared runtime. Input, budget and recoverable
allocation errors leave it usable. Runtime readiness is checked again after
output conversion, including when a `Math::BigInt` constructor retires it.
Earlier copied Perl results remain usable, and retained native outputs can
still be released after retirement.

Native spans must reference readable memory from the authenticated producer.
Alignment, null and overflow checks cannot establish the accessibility of
arbitrary process addresses.

## Verification

The [receipt](perl-recursive-conversions-20260923.json) separates isolated XS
conversion from ordinary-source and reviewed-contract Lean execution. Both
suites compile with warnings treated as errors on Perl 5.36.3 and 5.38.2,
threaded and unthreaded, using their actual headers and ABI flags.

The isolated suite passes 34,320 assertions per ABI. It covers every scalar,
direct and mutual recursion, boxed
record links, all option/result branches, empty and uninhabited types,
256-field constructors, 128-level values and shared limits. It checks malformed
tags, flags, UTF-8, integer signs, pointers and cycles. Mutation, stack growth
and nested calls during `bstr` exercise pinned inputs. Every conversion
checkpoint is exercised with an exception and a delivered Perl signal. This
covers 228 checkpoints and all 30 C scratch allocation sites.

The compiled suite exercises eighteen exports on both source paths. A Lean
predicate independently checks every scalar field. Native arena allocations
and XS checkpoints receive injected failures, with ownership ledgers checked
after each call. Four fresh-process scenarios cover malformed Lean carriers,
malformed raw output, retirement after the native call and retirement during
Perl result construction. The private test module also rejects forked and
foreign-interpreter calls before allocation. Each scenario passes 6,445 checks
on threaded Perl and 6,444 on unthreaded Perl, including all 28 native arena
allocation sites, 94 scratch allocation sites and 732 XS checkpoints.

```sh
source scripts/env.sh
LEAN_BRIDGE_PERL_GRAPH_CONVERSION_TEST=1 LEAN_BRIDGE_PERL_GRAPH_NATIVE_TEST=1 \
  node --test tests/perl-copied-graph-conversions.test.mjs
```

The default local selection uses all four pinned interpreters. Set
`LEAN_BRIDGE_CORPUS_PERL` to one absolute interpreter path, or
`LEAN_BRIDGE_PERLS` to a JSON array of paths. Each Perl CI matrix job requires
both suites and retains `build/recursive/perl-conversions.json` and
`build/recursive/perl-native.json`.

These private module checks establish conversion behavior and cleanup. The
subsequent [CPAN package milestone](perl-recursive-packages-20260923.md) records
authenticated loading, source-free installations, shared package lifecycle and
reproducible archives. Structured callable payloads and explicitly owned resource
aggregates remain open in VO 1219.
