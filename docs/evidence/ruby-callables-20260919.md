# Ruby primitive callbacks and returned closures

Ordinary-source and independently reviewed gems pass more than 50,000 installed
checks each on MRI Ruby 3.3.12. The [acceptance record](ruby-callables-20260919.json)
retains the Lean sources, independent consumer, compiler model, receipt and
archive identities for both paths.

## Compiled and installed contract

The 60-export library applies callbacks once and twice and returns captured
two-argument closures for all nineteen primitives. Additional exports exercise
multiple callbacks, mixed primitive signatures and expired host borrows. Lean
checks the callback identity lemmas. Reviewed signatures come from an independent
fixture, not the compiler's output.

Each run verifies and relocates the gem, deletes the author and build directories,
then installs offline into a fresh gem home. Consumer execution has no compilers
on PATH. The gem includes the native adapter, compiled component and compatible
shared runtime. Consumers require the package and use Ruby methods and blocks.

## Checks

- All nineteen primitives cross callback arguments/results and returned-closure
  arguments/results. Counters, distinct return values and both closure branches
  check execution and captured state.
- Fixed-width endpoints, values around 2^31, 2^32, 2^53 and 2^64, 5,121-bit
  integers, binary32 rounding, subnormals, signed zero, infinities, NaN,
  Unicode/NUL and arbitrary bytes cross the installed API.
- Invalid types, integer ranges, wrong Unit values, malformed text, invalid
  Char values and copy-budget overflow reject without implicit coercion.
- Original exception objects survive native cleanup, including exceptions
  outside StandardError. The first failure suppresses later callbacks.
  Non-local return, break and throw become LocalJumpError. Nested calls recover
  after handled exceptions and the 64-call native re-entry limit.
- Suspended Fiber callbacks block interleaved native entry from another Fiber
  on the same thread. Expired host borrows remain invalid after slot reuse.
  Closures reject wrong-thread invocation and post-fork use. Independent threads
  execute their own callbacks and closures, including constant Unit closures.
- Scoped cleanup, repeated close, garbage collection, deferred self-close,
  concurrent close and 4,096-lease exhaustion restore the shared broker's
  original live-identity count. Closures reject copying and serialization.
- Injected scratch-allocation, result-conversion and closure-wrapping failures
  release native buffers and leases. The post-wrap fault exercises shared
  ownership of the output box and checks for double disposal.

Run the installed checks with:

```sh
LEAN_BRIDGE_RUBY_CALLABLE_TEST=1 node --test tests/ruby-callables.test.mjs
```

Set `LEAN_BRIDGE_RUBY` and `LEAN_BRIDGE_GEM` to absolute MRI 3.3 executable paths
when needed. Local execution uses glibc floor 2.36; CI retains 2.38 and uploads
both source-path reports. The existing installed Ruby suite separately checks
nested records/arrays, unrelated gems, byte-reproducible relocation, shared
runtime loading and packaging failure cleanup.

## Ownership and execution

Host callbacks borrow the exporting call. Returned `LeanClosure` values provide
`call`, `close`, `closed?` and `with { |closure| ... }`. Invocation stays on the
creating thread. Generated code uses
[Fiddle's GVL-aware calls](https://docs.ruby-lang.org/en/3.3/Fiddle/Function.html)
and contains Ruby control flow inside the callback trampoline. Async thread
interrupts are deferred while native resources are owned. Native calls require
MRI's default 1:1 threads, not `RUBY_MN_THREADS`; Ractors and post-fork use remain
unsupported.

Native conversions and Ruby scratch have separate 16 MiB call budgets. These
limits do not bound Lean working memory or Ruby object overhead. This milestone
adds primitive callable support to RubyGems. It does not promote compound
callables, resource identities, asynchronous effects or other host backends.
