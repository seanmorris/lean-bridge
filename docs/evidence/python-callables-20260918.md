# Python primitive callbacks and returned closures

Ordinary-source and independently reviewed wheels each pass 49,939 installed
checks on CPython 3.12.14 after the 20 September CI repair. The [acceptance record](python-callables-20260918.json)
retains the source, independent consumer, compiler model, receipt and archive
identities for both paths.

## Compiled and installed contract

The 60-export library applies callbacks once and twice and returns captured
two-argument closures for all nineteen primitives. Additional exports check
multiple callback arguments, mixed primitive signatures and expired host
borrows. Lean checks the callback identity lemmas. The reviewed signatures
come from an independent fixture, not compiler output.

Each run verifies and relocates the wheel, removes author and build directories,
then installs offline into a fresh virtual environment with an empty pip cache.
The consumer runs with no compilers on PATH. The wheel includes the native
adapter, compiled component and compatible shared runtime.

## Checks

- Callback arguments/results and returned-closure arguments/results preserve
  all nineteen primitives. Counters and distinct returned values verify that
  Lean uses the callbacks; different captures and arguments exercise both
  closure branches.
- Signed/unsigned endpoints, values around 2^31, 2^32, 2^53 and 2^64,
  5,121-bit integers, binary32 rounding, subnormals, signed zero, infinities,
  NaN classification, Unicode/NUL and arbitrary bytes cross the installed API.
- Invalid inputs and callback results reject Boolean/numeric coercions,
  out-of-range integers, surrogates, wrong Unit values and copy-budget overflow.
  Async functions and returned coroutines reject without unawaited-coroutine
  warnings.
- Original Python exception objects survive native cleanup. The first failure
  suppresses later callbacks; nested calls can catch failures and recover.
  The native 64-call re-entry limit rejects and recovers.
- Expired host callbacks remain invalid after token-slot reuse. Closures reject
  wrong-thread invocation and post-fork use, including when another thread
  holds the inherited runtime and closure locks. The fork-rejection test checks
  CPython's expected deprecation warning locally; other stderr still fails the
  installed consumer check. Independent calls and constant
  Unit closures execute concurrently on their own threads.
- Context managers, repeated close, garbage collection, deferred self-close,
  concurrent close and 4,096-lease exhaustion return the shared broker to its
  original live-identity count. Closures reject copying and serialization.
- Injected Python allocation failures release temporary buffers. Failures
  before and after closure wrapping release native leases without double-free.
  Runtime type annotations resolve for every exported function.

Run the checks with:

```sh
LEAN_BRIDGE_PYTHON_CALLABLE_TEST=1 node --test tests/python-callables.test.mjs
```

Local execution uses glibc floor 2.36; CI retains 2.38 and uploads both source-path
reports with the Python consumer artifacts. The existing installed Python
copied-value suite checks separate packages, nested records/arrays, relocation,
reproducibility, shared runtime loading and cleanup.

## Scope

This milestone enables synchronous primitive callables for PyPI wheels using
the shared C adapter. Host callbacks borrow the exporting call. Returned
`LeanClosure` values require invocation on their creating thread and provide
`with`, `close()` and garbage-collection cleanup. Native conversions and Python
conversions each have a 16 MiB call budget; these limits do not bound Lean's
working memory.

Resources, callable containers, retained host callbacks and asynchronous
delivery remain unsupported by this adapter. Other host callable projections
are separate work. NaN payload preservation is not claimed. Inventory promotion
covers primitive callable positions, reviewed primitive parameters/results,
callback parameters and closure results, without promoting copied fields.
