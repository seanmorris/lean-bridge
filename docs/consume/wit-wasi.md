# WIT and WASI

## Use a prepared release

### Ordinary project packages

An ordinary `wit-wasi` release includes generated WIT, a Component Model binary, a Wasmtime 42.0.1 embedding library and the compiled native Lean runtime. Use it on Linux x86-64 with glibc 2.38 or newer. You do not install Lean or Wasmtime separately.

For the Cobalt example, [authenticate the release](receive-package.md), then extract its original archive:

```sh
export COBALT_WIT_ARCHIVE=/absolute/path/to/cobalt-api-2.0.0-rc.1-wit-wasi.tar.gz
mkdir cobalt-example
cd cobalt-example
tar -xzf "$COBALT_WIT_ARCHIVE"
export COBALT_WIT_PACKAGE="$PWD/cobalt-api-2.0.0-rc.1-wit-wasi"
```

Save this as `main.c`. These are Wasmtime's public value types; the package handles native Lean loading and conversion:

```c file=wit-wasi/ordinary.c
#include "cobalt_wasmtime.h"
#include <stdio.h>

static int report(wasmtime_error_t *error)
{
    if (!error) return 0;
    wasm_name_t message;
    wasmtime_error_message(error, &message);
    fprintf(stderr, "%.*s\n", (int)message.size, message.data);
    wasm_name_delete(&message);
    wasmtime_error_delete(error);
    return 1;
}

int main(void)
{
    cobalt_wasmtime *session = NULL;
    if (report(cobalt_wasmtime_open(&session))) return 1;
    wasmtime_component_val_t input = {
        .kind = WASMTIME_COMPONENT_U32, .of.u32 = 42
    };
    wasmtime_component_val_t output = {0};
    int failed = report(cobalt_wasmtime_call(
        session, "echo-u32", &input, 1, &output));
    if (!failed) {
        printf("%u\n", output.of.u32);
        wasmtime_component_val_delete(&output);
    }
    cobalt_wasmtime_close(session);
    return failed;
}
```

Compile your application with a C compiler and pkg-config, then run it:

```sh
export PKG_CONFIG_PATH="$COBALT_WIT_PACKAGE/lib/pkgconfig"
cc main.c $(pkg-config --cflags --libs cobalt-api-wit) -o cobalt-example
./cobalt-example
```

The program prints `42`. It calls `echo-u32` through the embedded component. The archive also contains the same bytes as `component/cobalt-api.wasm`. Custom Wasmtime hosts can load that file and call `cobalt_wasmtime_link` to supply its native imports.

Keep the installed libraries together. Arguments borrow caller-owned Wasmtime values for one call; results own independent storage and remain valid after the session closes. Delete results with `wasmtime_component_val_delete` and errors with `wasmtime_error_delete`. An error leaves the result unchanged. Each session belongs to one calling thread; separate sessions share the native Lean runtime.

At load time, the host checks the loaded native adapter, Lean component, shared
runtime and Wasmtime libraries against its recorded sizes and SHA-256 hashes.
It rejects a conflicting package already loaded under the same library name,
instead of calling that package's implementation. Keep installed library files
unchanged while loading hosts. After `fork`, inherited hosts reject calls and
session opens. A newly loaded host also checks already-loaded WIT hosts and
rejects an inherited host process, before opening a Wasmtime engine. Use `exec`
to start a fresh consumer process.
See the [installed library-isolation checks](../evidence/wit-host-isolation-20260924.md).

`Unit` uses a single-case WIT enum in all positions. `Nat` uses least-significant-first `u32` limbs, with an empty list for zero. `Int` adds a `negative` flag. Trailing zero limbs and negative zero are rejected. Arrays and records copy recursively; strings preserve UTF-8 and embedded NUL. Empty records use a single-case enum. The adapter caps conversion work at 16 MiB, and canonical-ABI scratch memory at 64 MiB. The session helper resets successful calls and replaces trapped stores before reuse. Custom embeddings must discard trapped instances. These limits do not bound the Lean algorithm's working memory.

See the [ordinary installed acceptance](../evidence/native-wit-20260914.md) for the exercised types and failure paths.

### Arrays and copied records

`Array T` becomes a WIT `list<T>`. Nonempty Lean records become named WIT records
with their original field order and types. Empty records use the singleton
enum `empty`. A record name remains part of its WIT declaration even when another
record has the same fields.

Build arguments with Wasmtime's public list and record values. Record entries
must have the declared names, order and count. WIT labels use lowercase
kebab-case. Keywords such as `u8` and `char` use a percent escape in WIT source,
but runtime record entries use `u8` and `char` without the percent sign.
The package's `binding-manifest.json` records the field mapping.

Arrays and record fields retain all nineteen primitive mappings. Nested empty
arrays remain empty at their original depth; an empty record remains a value.
`Nat` and `Int` keep arbitrary precision, and `USize` and `ISize` use the native
Lean target's 64-bit range. Returned nested arrays, records and byte buffers
have independent storage, including repeated results from the same input.
Compare their field and element contents, not allocation addresses. Floating
point comparison should preserve the distinction between positive and negative
zero and handle NaNs explicitly.

The adapter rejects malformed boolean bytes, noncanonical integer signs,
misaligned buffers, overflowing counts and invalid field values before reading
them. Empty buffers do not dereference their pointers. Callers still supply
valid native backing storage; pointer checks cannot establish an arbitrary
allocation's size. The 32-level schema limit and 16 MiB conversion budgets apply.

The [collection acceptance record](../evidence/wit-collections-20260922.md)
covers both installed source paths, 24 nested Array levels, seven record types,
independent Lean field inspectors, reproducible archives and separate sanitizer
probes. Recursive copied records use the typed helpers described below.
Compound callback payloads remain unsupported.

### Options, results and products

Prepared packages from ordinary source and reviewed IR use WIT's `option<T>`,
`result<Success, Error>` and `tuple<A, B>` types. Products retain their binary
nesting. `Except Error Success` becomes `result<Success, Error>`; the error branch
is a normal returned value, separate from a failed bridge call.

The public Wasmtime C values keep each constructor explicit:

| Lean value | Wasmtime value |
| --- | --- |
| `Option.none` | `WASMTIME_COMPONENT_OPTION` with `.of.option = NULL` |
| `Option.some value` | `WASMTIME_COMPONENT_OPTION` with a non-null payload pointer |
| `Except.ok value` | `WASMTIME_COMPONENT_RESULT` with `.of.result.is_ok = true` and a payload |
| `Except.error error` | `WASMTIME_COMPONENT_RESULT` with `.of.result.is_ok = false` and a payload |
| `(first, second)` | `WASMTIME_COMPONENT_TUPLE` with exactly two ordered entries |

`Unit` remains the singleton enum `unit`, including inside a branch. It is not an
absent payload. For example, construct `some none` with two option values:

```c
wasmtime_component_val_t absent = {.kind = WASMTIME_COMPONENT_OPTION};
wasmtime_component_val_t present_absent = {
    .kind = WASMTIME_COMPONENT_OPTION,
    .of.option = wasmtime_component_val_new(&absent)
};
/* Borrow &present_absent for a call accepting Option (Option T). */
wasmtime_component_val_delete(&present_absent);
```

`wasmtime_component_val_new` transfers its argument's contents into a Wasmtime
allocation. Delete the outer value once; it owns its nested payloads. Do not
shallow-copy owned pointers into multiple values. Use
`wasmtime_component_val_clone` when both copies must own their storage.

These types compose with all nineteen primitives, arrays and acyclic copied
records. The compiled Lean target still uses 64-bit `USize` and `ISize`. Type
nesting stops at 32. Input validation, host conversion and native copying enforce
their conversion budgets; these do not bound all Lean or Wasmtime allocations.
The host validates branch payloads and tuple arity before Wasmtime copies them.
Caller-provided pointers must reference valid C storage for the call. Wasmtime's
allocation API does not provide recoverable out-of-memory errors.

The [compound acceptance record](../evidence/wit-compounds-20260920.md) includes
both installed source paths, malformed inputs, copy independence and trap
recovery. Compound payloads inside callback signatures remain unsupported.

### Lean Lists

Prepared packages accept `List T` in parameters, results and record fields on
ordinary-source and reviewed-IR paths. WIT uses `list<T>` for both Lean Lists
and Arrays; the source IR and native C types retain their separate identities.
Empty sequences, order, duplicates and nesting are preserved.

Construct List arguments with Wasmtime's public list values. For the List
acceptance package, after opening a `lists_wasmtime` session:

```c
wasmtime_component_val_t input = {.kind = WASMTIME_COMPONENT_LIST};
wasmtime_component_vallist_new_uninit(&input.of.list, 3);
for (size_t i = 0; i < 3; ++i)
    input.of.list.data[i] = (wasmtime_component_val_t){
        .kind = WASMTIME_COMPONENT_U32, .of.u32 = (uint32_t)(i + 1)
    };
wasmtime_component_val_t output = {0};
wasmtime_error_t *error = lists_wasmtime_call(
    session, "reverse-uint32", &input, 1, &output);
wasmtime_component_val_delete(&input);
if (error) {
    wasmtime_error_delete(error);
} else {
    /* output contains 3, 2, 1 and owns its storage. */
    wasmtime_component_val_delete(&output);
}
```

Lists compose with every supported primitive, arrays, records, options, results
and binary products. `Nat` and `Int` elements retain arbitrary precision;
`USize` and `ISize` retain the native Lean target's 64-bit range. Results do not
share mutable storage with inputs or sibling results and survive session close.

The same 32-level type limit and conversion budgets apply. Callers must supply
valid Wasmtime C storage. The adapter rejects wrong element types, missing
buffers and excessive counts before Wasmtime copies them. A failed call leaves
the output slot unchanged; the session can accept the next valid call.
The [installed List checks](../evidence/wit-lists-20260921.md) cover both source
paths, nested values, copy limits and cleanup. List callback payloads remain
unsupported.

### Named copied aliases

Prepared packages preserve concrete Lean alias names and chains in both the WIT
source and compiled component. Function signatures, record fields and variant
payloads refer to
the original named types. The installed `binding-manifest.json` records their
Lean names and targets; the package README lists their WIT names.

For example, `abbrev Count := UInt32` produces a named WIT type backed by `u32`.
Pass a `WASMTIME_COMPONENT_U32` value to an export accepting `Count`. There is no
wrapper object or resource to create. An alias of `List Count` uses the same
Wasmtime list values described above, with `u32` elements.

Aliases preserve target checks and copying rules, including Option presence,
result branches, arbitrary-precision integers and independently owned outputs.
Lean `USize` and `ISize` use 64-bit values in this native profile. The existing
32-level type limit and conversion budgets still apply.

The [installed alias checks](../evidence/wit-aliases-20260921.md) cover ordinary
source and reviewed IR, including aliases used only as return types. Recursive
copied aliases use the typed helpers described below. Aliases inside callback
signatures and identity-bearing alias targets remain unsupported.

### Named copied variants

Prepared ordinary-source and reviewed-IR packages expose concrete Lean
inductives as named WIT variants. Each nonempty constructor has a named payload
record that preserves its fields and their order. Constructor numbers and Lean
object layouts stay private.

For the `Signal` family in the variant acceptance package:

| Lean constructor | WIT case | Wasmtime payload |
| --- | --- | --- |
| `Signal.idle` | `idle` | No payload, `.of.variant.val = NULL` |
| `Signal.stopped` | `stopped` | No payload, distinct from `idle` |
| `Signal.data count label` | `data(signal-data-fields)` | Record fields `count: u32`, `label: string` |
| `Signal.marker ()` | `marker(signal-marker-fields)` | Record field `value`, containing enum `unit` |

After opening a `variants_wasmtime` session, construct and call the Unit-bearing
case using the public Wasmtime API:

```c
wasmtime_component_val_t payload = {.kind = WASMTIME_COMPONENT_RECORD};
wasmtime_component_valrecord_new_uninit(&payload.of.record, 1);
wasm_name_new(&payload.of.record.data[0].name, 5, "value");
payload.of.record.data[0].val =
    (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_ENUM};
wasm_name_new(&payload.of.record.data[0].val.of.enumeration, 4, "unit");

wasmtime_component_val_t input = {.kind = WASMTIME_COMPONENT_VARIANT};
wasm_name_new(&input.of.variant.discriminant, 6, "marker");
input.of.variant.val = wasmtime_component_val_new(&payload);
wasmtime_component_val_t output = {0};
wasmtime_error_t *error = variants_wasmtime_call(
    session, "echo", &input, 1, &output);
wasmtime_component_val_delete(&input);
if (error) {
    wasmtime_error_delete(error);
} else {
    /* output owns its marker payload independently of input. */
    wasmtime_component_val_delete(&output);
}
```

The outer variant owns the transferred payload. Delete it once, without also
deleting the transferred local `payload`. Use `wasmtime_component_val_clone`
for an independent copy. Returned values survive session closure. Compare
constructor names and selected fields recursively, not pointer addresses.

Read the package's WIT file and `binding-manifest.json` for exact names.
Constructor and field names use lowercase kebab-case. WIT keywords use a `%`
escape in source, but Wasmtime discriminants and record names omit that escape.
Labels that cannot use kebab-case receive an unambiguous encoded spelling;
normalization collisions reject at build time.

Variants compose with aliases, arrays, Lists, records, options, results and
products, under the existing 32-level type limit and conversion budgets.
Unknown cases, absent or extra payloads, wrong field order, names and types
fail without changing the output slot. Caller pointers must still refer to
valid C storage. Recursive copied values use a separate bounded representation
described below. Identity-bearing fields and variant callback payloads remain
unsupported.

The [installed variant checks](../evidence/wit-variants-20260921.md) cover both
source paths, empty and Unit cases, mixed integer/float payloads, a 257-case
family, malformed inputs, independent copies and recovery after failure.

### Recursive copied values

The builder now produces prepared WIT packages for recursive records and
variants, including mutually recursive types and their copied containers.
Both ordinary-source and reviewed-IR archives passed
[recursive acceptance](../evidence/wit-recursive-acceptance-20260924.md), including
[installation and independent rebuild checks](../evidence/wit-recursive-packages-20260924.md).
The [cross-package checks](../evidence/wit-recursive-composition-20260924.md)
exercise result lifetimes, shared-runtime retirement, mixed C/WIT consumers and
the executable example below on both source paths.

Use the package's generated `<prefix>_wasmtime.h` header. Its
`<prefix>_wasmtime_value_<export>` helpers accept named C values and call the
compiled Component Model binary. The helpers convert recursive values to finite,
typed WIT tables; callers do not assemble those tables. The manifest preserves
the original Lean types and records the transport mapping.

Inputs borrow caller-owned storage for one call. Initialize result aggregates
with their generated `_init` helper, then release successful results with their
`_clear` helper. Results own independent storage and remain valid after session
close. Clear a result before reusing its output slot. Use the generated named
constructor constants, not numeric tags or Lean object layouts.

For the `recursive` acceptance package, save this as `main.c`:

```c file=wit-wasi/recursive.c
#include "recursive_wasmtime.h"
#include <stdio.h>

static int report(wasmtime_error_t *error)
{
    if (!error) return 0;
    wasm_name_t message;
    wasmtime_error_message(error, &message);
    fprintf(stderr, "%.*s\n", (int)message.size, message.data);
    wasm_name_delete(&message);
    wasmtime_error_delete(error);
    return 1;
}

int main(void)
{
    recursive_wasmtime *session = NULL;
    if (report(recursive_wasmtime_open(&session))) return 1;
    recursive_spine_t leaf = {
        .kind = RECURSIVE_SPINE_T_KIND_LEAF, .cases.leaf.value = 71
    };
    recursive_spine_t grown;
    recursive_spine_t_init(&grown);
    int failed = report(recursive_wasmtime_value_grow(session, &leaf, &grown));
    recursive_wasmtime_close(session);
    if (!failed) {
        /* The result owns its storage even after the session closes. */
        failed = grown.kind != RECURSIVE_SPINE_T_KIND_NEXT
            || !grown.cases.next.value
            || grown.cases.next.value->kind != RECURSIVE_SPINE_T_KIND_LEAF
            || grown.cases.next.value->cases.leaf.value != 71;
        if (!failed) puts("next(leaf(71))");
    }
    recursive_spine_t_clear(&grown);
    return failed;
}
```

Set `PKG_CONFIG_PATH` to the extracted package's `lib/pkgconfig` directory, then
compile and run:

```sh
cc main.c $(pkg-config --cflags --libs recursive-wit) -o recursive-example
./recursive-example
```

The program prints `next(leaf(71))`. The package loads its native Lean runtime
automatically; consumers install no separate Lean toolchain. Keep the package's
libraries installed alongside the application.

Conversion rejects cycles and enforces a depth limit of 128, 262,144 expanded
node visits and a 16 MiB copy budget. A limit error leaves the output unchanged
and the session usable. A malformed native result retires the shared runtime,
so later calls from every session fail. Structured callback payloads and
resource-containing aggregates are not part of this implementation.

### Callbacks and returned Lean functions

Callable packages add a checked session API. Each callable signature has a WIT `resource function-*` type and an `invoke-function-*` export. Lean borrows host callbacks for one exporting call. Returned Lean functions remain available until you close their tokens or their session.

Use the package's generated header to register a callback, then call exports with `<prefix>_wasmtime_invoke`. A `<prefix>_wasmtime_value` contains either a copied Wasmtime value in `.value`, or a callable token in `.function`. For the installed `callables` example, a callback that adds one is:

```c
static wasmtime_error_t *add_one(void *data,
    const wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *out)
{
    (void)data;
    if (count != 1 || args[0].kind != WASMTIME_COMPONENT_U32)
        return wasmtime_error_new("Expected one u32");
    *out = (wasmtime_component_val_t){
        .kind = WASMTIME_COMPONENT_U32, .of.u32 = args[0].of.u32 + 1
    };
    return NULL;
}
```

After opening a `callables_wasmtime` session, register `add_one` with `callables_wasmtime_callback_create(session, "function-uint32-to-uint32", add_one, NULL, NULL, &token)`. Pass a copied `u32` and `{.function = token}` to `callables_wasmtime_invoke(session, "call-uint32", args, 2, &result)`. Check each returned error before using its output. Delete copied results with `wasmtime_component_val_delete(&result.value)`; close tokens with `callables_wasmtime_function_close(session, &token)`.

Returned Lean functions use the same token representation. To invoke one, call its matching `invoke-function-*` export with the token first, followed by its arguments. You can also pass a returned function to a Lean export expecting the same callback signature.

The callback borrows its arguments and transfers an independently owned result or error to the adapter. Do not return a shallow copy of a string or list argument; use `wasmtime_component_val_clone`. The adapter deletes the result and error, including a result populated before failure. Registration transfers callback data only on success. Its optional finalizer runs once after active calls finish; finalizers must not reenter their session.

Tokens belong to their creating session, thread and process. Closing a token zeroes that variable and invalidates its aliases. Calls already in progress retain their inputs until return. Closing the session during a callback waits for the outer call to return an error. Do not use a session after close. A failed component call replaces its store after nested calls unwind; surviving Lean functions and host callbacks remain usable.

Callable signatures support all nineteen primitives, with one through sixteen arguments. Nested calls are limited to 64; each session holds at most 1,024 tokens and also uses the shared native identity registry. Callback arguments/results cannot yet contain arrays, records or other callbacks. Retained host borrows and asynchronous callbacks are rejected. If Lean captures a call-borrowed callback and invokes it later, that invocation fails.

Callable packages require the owning session API. Their `<prefix>_wasmtime_link` returns an error without changing a custom linker. Copied-only packages retain the custom-linker API shown above. The [installed callable checks](../contributing/testing.md#native-wit-callables) exercise both ordinary-source and independently reviewed packages.

## Alpha prepared package

The Alpha package includes a WebAssembly Component Model adapter and a Wasmtime host. The exported `read-box` function enters the component, calls a typed native host import, and returns the value read from a real Lean `Box`.

### Prerequisites

Use x86-64 Linux with glibc 2.38 or newer. The archive includes the Wasmtime 42 host, Wasmtime's shared library, and the native Lean libraries. Consumers do not need Lean, a C compiler, or a separately installed Wasmtime CLI.

Install `wasm-tools` only if you want to run the optional binary validation command. The [acceptance record](../evidence/wasi-consumer-acceptance.md) identifies the tested Wasmtime and wasm-tools versions.

## Obtain and extract the package

Request `lean-bridge-alpha-wasi-0.0.0.tar.gz` and [authenticate its release identity](receive-package.md) before extraction. Use an absolute archive path and a new application directory:

```sh
export LEAN_ALPHA_WASI_ARCHIVE=/absolute/path/to/lean-bridge-alpha-wasi-0.0.0.tar.gz
mkdir lean-alpha-wasi-example
cd lean-alpha-wasi-example
tar -xzf "$LEAN_ALPHA_WASI_ARCHIVE"
export LEAN_ALPHA_WASI_PACKAGE="$PWD/lean-bridge-alpha-wasi-0.0.0"
```

Keep these directories together:

```text
lean-bridge-alpha-wasi-0.0.0/
  bin/lean-alpha-wasi-host
  component/lean-alpha.component.wasm
  lib/
  wit/lean-alpha-adapter.wit
  wit/lean-alpha.wit
  share/lean-bridge-alpha/
```

## Run the component

Save this as `run.sh` beside the extracted package:

```sh file=wit-wasi/run.sh
#!/bin/sh
set -eu

package_root=${1:?Usage: sh run.sh /absolute/path/to/lean-bridge-alpha-wasi-0.0.0}
"$package_root/bin/lean-alpha-wasi-host"
"$package_root/bin/lean-alpha-wasi-host" \
  "$package_root/component/lean-alpha.component.wasm" 73
```

Execute it:

```sh
sh run.sh "$LEAN_ALPHA_WASI_PACKAGE"
```

Expected output:

```text
42
73
```

The first invocation discovers its component relative to the executable and supplies the default input `42`. The second provides the component path and input `73`. The command-line sample accepts an unsigned 32-bit input; validate application input before passing it to this host because its command-line parser does not reject every malformed or out-of-range value.

## Values and cleanup

### Type conversions

Profiles: WIT/WASI. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `Single-case WIT enum { unit }` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Ordinary packages use a single-case enum, including inputs, results and fields. Unit uses an explicit single-case enum for callback inputs and results. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `bool` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `u8` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `u16` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `u32` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `u64` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `s8` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -128..127; reject overflow before narrowing. |
| `Int16` | `s16` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `s32` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `s64` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `list<u32> limbs` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Ordinary packages use least-significant-first u32 limbs. Empty limbs are zero; trailing zero limbs are rejected. Canonical least-significant-first u32 limbs; [] is zero. No fixed integer width; conversion budgets apply. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `record { negative: bool, limbs: list<u32> }` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Ordinary packages use a negative flag and least-significant-first u32 limbs. Negative zero and trailing zero limbs are rejected. Signed canonical u32 limbs; negative zero is rejected. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `f32` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Ordinary f32 calls preserve binary32 rounding, NaN classification, infinities and signed zero. Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `f64` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `string` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Ordinary packages validate UTF-8 before Wasmtime copies it, preserving embedded NUL. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `list<u8>` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Ordinary packages copy byte lists with independent returned storage. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `list<T>` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Ordinary packages check and copy every nested element. Conversion budgets count Wasmtime slots and native scratch. WIT `list<T>` preserves every primitive element, nested arrays and records, empty rows, order and duplicates. Nat and Int retain arbitrary precision; USize and ISize use the native 64-bit range. Wasmtime output lists have independent storage, including sibling copies. Invalid values, noncanonical boolean/sign bytes, missing or misaligned buffers and excessive counts reject before reads or allocation. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `option<T>` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result) | None is an absent option payload. Some Unit contains the singleton unit enum; Some None contains another option value. Presence is preserved at every nesting level. Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | `result<Success, Error>` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result) | WIT result arguments are [success, error], reversing Lean Except error/success parameters. Both branches contain typed payloads, including Unit. Domain errors remain separate from bridge-call failures. Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `tuple<A, B> (nested binary products)` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result) | Exactly two ordered WIT tuple entries preserve binary nesting and per-position types. All compounds compose with copied arrays and acyclic records. Conversion accounts for slots and payloads with a 16 MiB limit; C callers supply valid borrowed storage. Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Generated WIT record (empty: single-case enum)` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Ordinary packages use WIT field order and compiler-owned Lean accessors. Empty records use a single-case enum; returned values remain valid after closing the session. Named WIT records retain original field names, order and types. Empty records use the singleton enum empty. WIT source escapes keyword fields, while runtime fields use ordinary labels without percent signs. Missing, extra, reordered and wrongly typed fields reject. Returned nested fields own independent copies and survive session closure; compare contents rather than addresses. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | `Named WIT alias; ordinary target Wasmtime value` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Text WIT and the compiled component preserve original alias names and chains, API references and record fields. The manifest and README document target mappings; callers use ordinary Wasmtime values without wrapper resources. Native target conversions, branch presence, independent result ownership, 64-bit USize/ISize and existing copy budgets remain unchanged. An alias whose WIT name conflicts with a function receives an alias- prefix; other duplicate or reserved type names reject. Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | `Named WIT variant with named constructor payload records` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Constructor names and selected record fields preserve identity, order, empty cases and Unit payloads. Named aliases and all nineteen primitive payloads compose with admitted copied containers. Native USize and ISize are 64-bit. Input tags, payload presence, exact fields and scalar ranges reject before native entry; results own independent copies and survive session close. Only the selected native payload is read. Use WIT names, not Lean constructor numbers or pointer identity. Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `borrow<function-*> through a session token` (input) | Ordinary source: Installed checks passed (input); Not audited (result, field, callback input, callback result). Reviewed IR: Installed checks passed (input); Generation rejected (result, field, callback input, callback result) | The adapter checks the session, generation and signature before borrowing a callback for one Lean call. Failures return an owned Wasmtime error. The Alpha executable adapter does not expose this type. Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | `list<T> (owned Wasmtime component values)` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Canonical WIT lists preserve empty sequences, order, duplicates and nesting; Lean List and Array retain distinct IR and native types. Public Wasmtime values borrow inputs and return independent owned copies, including nested branches, fields and bytes. Delete results with wasmtime_component_val_delete; they remain valid after closing the session. Preflight rejects wrong element types, missing buffers, excessive counts and invalid branches before Wasmtime copies input. Errors leave the output slot unchanged; trapped stores are replaced before reuse. Required: Preserve order, duplicates and nesting with a distinct list constructor. Validate all elements and copying limits; never expose Lean cons cells. |
| `Char` | `char` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly one Unicode scalar, 0..0x10FFFF excluding surrogates. NUL, supplementary characters, combining scalars, noncharacters and line endings are preserved without normalization. Multi-scalar grapheme clusters require String. A Unicode scalar value, including NUL and supplementary values; surrogates reject. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | `u64` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, 0..18446744073709551615. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Unsigned u64 for the 64-bit compiled Lean target. Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | `s64` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, -9223372036854775808..9223372036854775807. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Signed s64 for the 64-bit compiled Lean target. Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Dependent parameters and results` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | `Named C records and tagged unions through generated Wasmtime helpers; finite typed WIT tables` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Inputs borrow named C storage for one call; results own independent copies. Initialize and clear result slots with generated helpers. Limit errors preserve outputs and session usability. Malformed native results retire the shared runtime; earlier results remain readable and clearable after all sessions close. Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
| `Polymorphic exports` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | The Alpha executable adapter does not expose this type. Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |
| `Implicit arguments {α}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |
| `Instance arguments [C α]` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specialize or supply the selected dictionary without changing runtime behavior. |
| `Prop / theorem / proof arguments` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Record theorem identity and assumptions. Erasure does not remove the need to check a runtime refinement. |
| `Optional parameter with default` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Apply only the declared default; distinguish omitted input from a supplied Option.none. |
| `Explicit nullable host value` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Select an explicit host projection; null does not stand for every missing, erased or unsupported value. |
| `IO α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Executing IO is not automatically asynchronous. Preserve effect order and exceptions. |
| `EIO ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve typed failures separately from transport validation and unexpected traps. |
| `Declared failure contract` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Project every declared error and payload; preserve trap or poisoned-runtime handling separately. |
| `Task α / asynchronous result` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | The Alpha executable adapter does not expose this type. Required: Keep completion, rejection, cancellation and runtime lifetime distinct; do not block a browser event loop. |
| `Declared host object` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate typed members and preserve receiver identity, dynamic-access policy and lifetime. |
| `Lean function returned to the host` | `own<function-*> through a session token` (result) | Ordinary source: Not audited (input, field, callback input, callback result); Installed checks passed (result). Reviewed IR: Generation rejected (input, field, callback input, callback result); Installed checks passed (result) | Explicit session-owned lease; invoke through the matching typed export. Active disposal is deferred; copied aliases expire together. The Alpha executable adapter does not expose this type. Required: Preserve captured state, call signature, errors and deterministic disposal. |
| `Cancellation protocol` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specify acknowledgement and late completion; release pending work exactly once. |
| `Synchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | The Alpha executable adapter does not expose this type. Required: Preserve values, end-of-sequence, failure, early return and cleanup. |
| `Asynchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | The Alpha executable adapter does not expose this type. Required: Preserve backpressure, pending-pull cancellation and terminal cleanup. |

### Alpha example API

The executable adapter only exposes `read-box: u32 -> u32`. The package also includes a broader WIT description; the availability column distinguishes those declarations from operations you can call through this adapter.

| Lean type | WIT type | Availability and conversion rules |
| --- | --- | --- |
| `UInt32` | `u32` | Executable input and result of `read-box`; full unsigned 32-bit width. The command-line parser still needs application-side validation. |
| `Bool` | `bool` | Declared in the broader `payload` record; not exposed by the executable adapter. |
| `String` | `string` | Text in the WIT projection; not exposed by the executable adapter. |
| `ByteArray` | `list<u8>` | Byte sequence in the WIT projection; not exposed by the executable adapter. |
| `Array UInt32` | `list<u32>` | Unsigned integer sequence in the WIT projection; not exposed by the executable adapter. |
| `Payload` | `record payload` | Copied fields in the WIT projection; `round-trip` is not exported by this adapter. |
| `Box` | `resource box` | Declared in WIT. The executable host creates and disposes a native box internally; it does not return a resource to the caller. |
| `UInt32 → UInt32` callback or returned Lean closure | No callable value mapping | Omitted from the WIT projection and executable adapter. |
| `Nat` or `Int` | Not exposed by the Alpha adapter | Alpha's resource-oriented WIT projection rejects these signatures. Ordinary copied-value packages use the lossless limb representations described above. |

The `result<u32, bridge-error>` on the broader WIT `box.read` method describes its declared failures. It is not the return type of the executable `read-box`, which returns `u32`.

### What the component executes

The packaged adapter exports `read-box: u32 -> u32` and imports `lean-read-box: u32 -> u32`. The supplied host implements that import by constructing a native Lean `Box`, reading it, and disposing it before returning through the component call.

`wit/lean-alpha.wit` describes the broader generated Alpha API. The executable adapter currently exposes the `read-box` entry point. The presence of record and resource declarations in the WIT projection does not make those operations available through this adapter.

Run the adapter with the packaged host. Loading only the component in an arbitrary WASI runtime will leave its native Lean import unresolved. The package's native libraries also retain the Linux and glibc requirements listed above. Callbacks and returned callables need additional Component Model adapter work.

The host owns its Wasmtime instance and native resources for one process invocation. It closes the Lean box inside the import and releases the Wasmtime objects before exiting. A failed component load, import, or call prints a diagnostic and exits nonzero; the shell example stops on that failure.

### Validate and troubleshoot

With the tested wasm-tools version installed, validate the binary independently:

```sh
wasm-tools validate --features component-model \
  "$LEAN_ALPHA_WASI_PACKAGE/component/lean-alpha.component.wasm"
```

- **A glibc symbol or shared library is missing:** check the platform profile and preserve the archive's `bin/` and `lib/` layout.
- **The component file cannot be opened:** keep `component/` beside `bin/`, or pass the component's absolute path explicitly.
- **An import cannot be resolved in another runtime:** use the packaged host, which supplies `lean-read-box` with the required type and native Lean implementation.

## Start from a raw Lean package

Follow [the WIT / WASI build-and-publish guide](../publish/wit-wasi.md) for source inputs and package preparation. For an existing library, start with [Adapt an existing library](../lean/existing-package.md).

### Acceptance checks

Repository checks live in [Contributing](../contributing/testing.md#consumer-acceptance).

### Publish this package

Continue in the [build-and-publish workflow](../publish/wit-wasi.md).
