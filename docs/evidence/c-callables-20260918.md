# C primitive callbacks and returned closures

Ordinary-source and independently reviewed C packages each pass 47,329
installed assertions, plus 25 allocation-failure checks. The
[acceptance record](c-callables-20260918.json) retains source, consumer,
compiler model, receipt and archive identities for both paths.

## Compiled and installed contract

The library exports callback application, repeated application and a captured
two-argument closure for each of the nineteen primitives. Lean checks the
callback identity lemmas. An independent signature fixture defines the reviewed
contract without reading compiler metadata. A deliberate retained-callback
export checks rejection after its host borrow expires. The 59th export completes
this C-specific lifetime fixture; `wordBits` reports the native 64-bit target.

Each run verifies and relocates the release archive, removes the author and
build directories, then compiles a C11 consumer against the installed public
header and pkg-config metadata. Execution needs neither Lean nor author tools.
The archive includes its native runtime. The consumer uses no generated private
header and does not supply a runtime adapter.

## Checks

- All nineteen primitives cross host callback arguments/results and returned
  closure arguments/results. Callback counters and distinct return values check
  invocation and result use. Different captured and supplied values check both
  closure branches.
- Fixed-width endpoints, 256-bit and 5,120-bit limb values, UTF-8 with NUL, supplementary
  Unicode scalars, arbitrary bytes, binary32/binary64 subnormals, signed zero,
  infinities and NaN classification survive conversion.
- Invalid Unit/Char inputs, malformed UTF-8 results, null arguments, invalid
  buffers and oversized callback results reject without changing caller output.
- Nested calls succeed; the 64-call limit fails and recovers. The first host
  failure suppresses later callbacks; error messages preserve embedded NUL.
  Owned callback results release on both
  success and failure.
- Expired callbacks stay invalid after token-slot reuse. Wrong-signature and
  wrong-thread closure calls reject. Independently created closures work on
  their own threads, including Lean's shared constant Unit closure.
- The 4,096-identity capacity fails cleanly, disposal frees every identity, and
  subsequent creation succeeds. Repeated create/call/dispose leaves the shared
  broker at its original live-identity count.
- Allocation injection covers callback conversion, final-result conversion and
  the public closure wrapper. Failed wrapper allocation releases its native
  lease; every test returns to zero tracked C allocations.

Run the checks with:

```sh
LEAN_BRIDGE_C_CALLABLE_TEST=1 node --test tests/c-callables.test.mjs
```

Local execution uses the 2.36 glibc floor. CI retains 2.38 and uploads the
ordinary/reviewed execution report with the C-family consumer artifacts.

## Scope

This milestone enables synchronous primitive callables for target `c` only.
Host callbacks borrow their context for one call. Returned closures require
explicit disposal and invocation on the creating thread. Inputs, callback
conversions and results share a 16 MiB budget per active invocation. The limits
do not bound the Lean algorithm's working memory.

The inventory adds primitive callback positions, reviewed scalar inputs/results,
callback input and closure result coverage. Existing copied-field evidence stays
separate. C++ and the other copied-value host generators still reject callables.
Retained host callbacks, callable collections and asynchronous delivery remain
unsupported. C `Nat`/`Int` retain exact limb buffers; GMP integration remains a
separate decision. NaN payload preservation is not claimed.
