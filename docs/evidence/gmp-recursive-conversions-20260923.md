# Bounded C/GMP recursive values

The finite native graph has a C/GMP value projection and private typed conversion
calls. These complement the [C++ conversions](cpp-recursive-conversions-20260922.md).
Prepared C/C++ recursive package admission is not enabled by this change.

## Values and ownership

`Nat` and `Int` use `mpz_t`, including record fields and array elements. Records
retain named fields. Variants have named tags and constructor fields, with a
generated `select` helper. Recursive and oversized inline fields borrow typed
pointers; arrays and lists borrow contiguous spans on input. Aliases retain
their public names and initialization helpers.

Callers initialize aggregate values before use and use `select` to change an
active constructor. Input spans and pointer children remain caller-owned.
Clearing a caller-built aggregate clears its inline values, including an
independently owned result embedded in one of those fields. It does not free
borrowed pointer or span children.

A successful result owns copied buffers and integers. It can replace an already
initialized result, including when that result is also an argument. A rejected
call leaves the previous output unchanged. No successful result borrows an input
buffer or retains a Lean object.

Each result has a private allocation and integer-finalizer list. Finalizers for
inline root integers store offsets from the current root address. Finalizers
for heap integers retain stable addresses. This allows the generated temporary
result to move into caller storage, and permits GMP to reallocate an active
integer's limbs. Cleanup reads this list rather than following public tags,
span lengths or child pointers.

Owning roots must not be shallow-copied and then cleared twice. Nested result
values are borrowed views: clear or select the owning root, not a child. Keep
the private ownership fields intact. Do not overwrite initialized GMP storage
or write inactive constructor fields. These restrictions also apply when a
root is moved into another caller-owned aggregate.

## Conversion and failure rules

Every argument is checked before allocating a native view or invoking Lean.
Checks include negative naturals, UTF-8, Unicode scalars, Bool and Unit values,
tags, pointer alignment, wrapping spans, cycles, and finite inhabitants. Native
pointers must still reference readable, initialized process objects.

Input and output share limits of 262,144 value nodes, depth 128 and 16 MiB of
native copied storage. A separate 16 MiB conversion-storage budget accounts for
view buffers, output buffers, integer limbs and allocation/finalizer records.
Every partial allocation has a cleanup path.

Private call statuses match the native graph boundary:

| Status | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Invalid input |
| 2 | Node, depth or byte limit |
| 3 | Bridge-owned allocation failure |
| 4 | Malformed native result |
| 5 | Runtime unavailable or retired |

The lifecycle-aware form retires malformed native results and checks runtime
readiness before publishing output. Owned values remain clearable afterward.
GMP retains its default fatal allocation policy. Bridge allocation-failure
tests do not claim recovery from GMP's own out-of-memory behavior.

## Verification

The independent C suite passes 1,634 checks in normal and fatal
AddressSanitizer/UBSan builds. It exercises root movement and integer
reallocation, borrowed inputs, owned inline children, repeated replacement,
aliases, 1,001-bit integers, nested options/results, mutual recursion, empty and
Unit constructors, GMP arrays, invalid UTF-8, cycles, bounds and malformed
outputs. Allocation injection fails every bridge allocation in both a copied
leaf and a nested optional/result graph with GMP arrays. Both bridge and GMP
allocation ledgers return to their expected counts.

Run the isolated checks with a C compiler and GMP development headers:

```sh
node --test tests/c-gmp-graph-conversions.test.mjs
```

Both fresh compiled paths pass 1,121 C/GMP checks across eighteen exports,
including rejection of the uninhabited type. The suite checks ordinary-source
and independently reviewed contracts. It also runs the existing 169,840 raw C,
469 C++ and 490 lifecycle checks on each path. Both component binaries retain
SHA-256 `aa2db3227555cc4a790a09a6364955b64a23999ae5822cf9a8dd2968686da112`.

The GMP caller exercises both bridge and native allocation failures, an output
that grows past the allowed depth, and runtime retirement after a malformed
result. Calls reject after retirement, while an earlier owned result remains
readable and clearable. Run the compiled suite with the pinned Lean toolchain:

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_RECURSIVE_TEST=1 node --test tests/native-graph-model.test.mjs
```

This is generator and compiled-boundary verification. Prepared archive
installation, public C/C++ API integration, the other recursive consumer
profiles, structured callback payloads and resource-containing aggregates
remain required.
