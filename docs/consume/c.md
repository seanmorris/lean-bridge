# Use a Lean package from C

The Alpha C archive provides a C11 header, the native component and Lean runtime, and CMake and pkg-config metadata. Every fallible call returns a status and writes details to `lean_alpha_error`.

The walkthrough below uses Alpha's prepared example. For an ordinary-source release, the package README and `lean-bridge-package.json` give its header, function prefix, CMake target and pkg-config name. Its compiled component and matching Lean runtime are included and initialize automatically. You do not write a runtime adapter or install Lean. See [ordinary-source package preparation](../publish/c.md#build-an-ordinary-lean-project) if you are the author.

## Use a prepared release

### Requirements and package

Use a C11 compiler, CMake 3.20 or newer, and tar on Linux x86-64 with glibc 2.38 or newer. The [support contract](../consumer-support.v1.json) records the tested profile.

Request `lean-bridge-alpha-0.0.0-c.tar.gz` and the authentication files in [Use a prepared release](receive-package.md). Authenticate the archive before extracting it.

## Create the project

Put the archive in your project directory and extract it:

```sh
mkdir -p vendor
tar -xzf ./lean-bridge-alpha-0.0.0-c.tar.gz -C vendor
```

Save this file as `CMakeLists.txt`:

```cmake file=c/CMakeLists.txt
cmake_minimum_required(VERSION 3.20)
project(lean_alpha_docs C)
set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
find_package(LeanBridgeAlpha 0.0.0 EXACT CONFIG REQUIRED)
add_executable(consumer main.c)
target_link_libraries(consumer PRIVATE LeanBridge::Alpha)
```

## Call Lean

Save this file as `main.c`. The shared cleanup path releases partially constructed state if any call fails.

```c file=c/main.c
#include <lean_alpha.h>
#include <stdio.h>
#include <string.h>

#define CALL(expression) do { \
    if ((expression) != LEAN_ALPHA_STATUS_OK) { \
        fprintf(stderr, "Lean error %d: ", (int)error.code); \
        if (error.message) fwrite(error.message, 1, error.message_length, stderr); \
        fputc('\n', stderr); \
        goto cleanup; \
    } \
} while (0)
#define REQUIRE(condition) do { \
    if (!(condition)) { fputs("Unexpected Alpha result\n", stderr); goto cleanup; } \
} while (0)

static lean_alpha_status add_two(void *context, uint32_t value,
                                uint32_t *out, lean_alpha_error *error) {
    (void)context;
    (void)error;
    *out = value + 2;
    return LEAN_ALPHA_STATUS_OK;
}

int main(void) {
    int exit_code = 1;
    lean_alpha_error error = {0};
    lean_alpha_box *box = NULL;
    const lean_alpha_box *same = NULL;
    lean_alpha_owned_transform *adder = NULL;
    lean_alpha_payload output = {0};
    uint32_t result = 0;
    const uint8_t bytes[] = {0, 255};
    const uint32_t values[] = {0, UINT32_MAX};
    const char label[] = "Lean λ";
    const lean_alpha_payload input = {
        true, 41,
        {label, sizeof(label) - 1, NULL, NULL},
        {bytes, 2, NULL, NULL},
        {values, 2, NULL, NULL},
    };
    const lean_alpha_transform callback = {add_two, NULL};

    CALL(lean_alpha_box_create(42, &box, &error));
    CALL(lean_alpha_box_read(box, &result, &error));
    REQUIRE(result == 42);
    CALL(lean_alpha_box_identity(box, &same, &error));
    REQUIRE(same == box);
    CALL(lean_alpha_round_trip(&input, &output, &error));
    REQUIRE(!output.enabled && output.count == 42);
    REQUIRE(output.label.length == sizeof(label) - 1);
    REQUIRE(memcmp(output.label.data, label, sizeof(label) - 1) == 0);
    REQUIRE(output.bytes.length == 2 && memcmp(output.bytes.data, bytes, sizeof(bytes)) == 0);
    REQUIRE(output.values.length == 2 && memcmp(output.values.data, values, sizeof(values)) == 0);
    CALL(lean_alpha_with_callback(40, &callback, &result, &error));
    REQUIRE(result == 44);
    CALL(lean_alpha_make_adder(2, &adder, &error));
    CALL(lean_alpha_owned_transform_call(adder, 40, &result, &error));
    REQUIRE(result == 42);
    puts("Box: 42; payload: 42; callback: 44; closure: 42");
    exit_code = 0;

cleanup:
    lean_alpha_payload_clear(&output);
    lean_alpha_owned_transform_dispose(&adder);
    lean_alpha_box_dispose(&box);
    return exit_code;
}
```

Configure, compile, and execute:

```sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_PREFIX_PATH="$(pwd)/vendor/lean-bridge-alpha-0.0.0-c"
cmake --build build
./build/consumer
```

Expected output:

```text
Box: 42; payload: 42; callback: 44; closure: 42
```

## Values and cleanup

Ordinary-source arrays use typed spans; records use generated structs. Both can nest. Inputs borrow your storage for one call. Packages exposing `Nat` or `Int` provide generated `_init` functions for their aggregate structs. Call `_init` before first use, then `_clear` to release the complete value, including nested integers, arrays and record fields. `_clear` resets fields to initialized empty values. Successful calls replace initialized copied outputs; failed conversions leave them unchanged. Packages without arbitrary integers, including Alpha above, use zero-initialized outputs and require clearing before reuse. Do not shallow-copy an owned output and clear both copies.

The package enforces a shared 16 MiB input/output conversion budget and a maximum type nesting of 32. See [copied arrays and records](../publish/c.md#copied-arrays-and-records) for the accounting rules. These limits do not bound the Lean algorithm's own allocations.

`Option` structs have `uint8_t has_value` and a typed `value` field. Set the flag to 0 for none or 1 for some; `Some Unit` still has flag 1 and payload 0. `Except` structs have `uint8_t is_ok`, `ok` and `error` fields. Set `is_ok` to 1 for success or 0 for a domain error. Only the selected payload is validated and passed to Lean. Initialize both payload fields before use and cleanup. A domain error is a returned value, not a failing C status. Products have `fst` and `snd` fields and preserve nesting. All three can contain supported primitives, arrays, copied records and each other. See the [installed compound checks](../evidence/native-compounds-20260920.md).

### Arrays and records

For an installed [Parcels package](../publish/c.md#copied-arrays-and-records),
save `parcels.c`:

```c
#include "parcels.h"
#include <stdio.h>

int main(void) {
    parcels_error error = {0};
    parcels_parcel input, output;
    parcels_parcel_init(&input);
    parcels_parcel_init(&output);
    mpz_t counts[2];
    mpz_init_set_ui(counts[0], 2);
    mpz_init_set_ui(counts[1], 7);
    input.label = (parcels_string){"Seeds", 5, NULL, NULL};
    input.counts = (parcels_array_nat_span){counts, 2, NULL, NULL};

    const parcels_status status = parcels_reverse(&input, &output, &error);
    if (status == PARCELS_STATUS_OK) {
        gmp_printf("%.*s: %Zd, %Zd\n", (int)output.label.length,
                   output.label.data, output.counts.data[0], output.counts.data[1]);
    } else {
        fprintf(stderr, "Lean call failed: %d\n", (int)status);
    }
    parcels_parcel_clear(&output);
    parcels_parcel_clear(&input);
    mpz_clear(counts[0]);
    mpz_clear(counts[1]);
    return status == PARCELS_STATUS_OK ? 0 : 1;
}
```

Compile with the package's CMake target or pkg-config flags, as listed in its
README. It prints `Seeds: 7, 2`. The input span borrows the two initialized
integers; clear those separately after the call. The returned record owns its
copied label and counts, and one record clear releases them.

Generated fields use snake_case; C/C++ keywords get a trailing underscore,
such as `char_`. The [installed collection checks](../evidence/native-collections-20260921.md)
cover ordinary-source and reviewed-IR archives, malformed inputs, independent
returned storage and allocation-failure cleanup.

### Lists

Prepared packages accept Lean `List T` as typed `<prefix>_list_<element>_span` values. Set `data` and `length` to borrow contiguous input elements for the call; returned spans own copied storage and use the same initialization and cleanup rules above. Lists preserve order, duplicates and nesting, and can contain the supported copied types. `List` and `Array` remain distinct in the contract and generated C names. The [installed List checks](../evidence/native-lists-20260920.md) cover both source paths. Lists also work as [callback and returned-closure payloads](#callbacks-and-returned-closures).

### Named aliases

Concrete Lean aliases retain public names as `<prefix>_<snake_name>_t` typedefs.
For example, `abbrev Count := UInt32` exports `sample_count_t`, which you can pass
to the generated functions as an ordinary `uint32_t`. The `_t` suffix keeps the
type name distinct from a function named `count`.

Aliases use their target's storage, validation and ownership rules. Aggregate
aliases provide `<alias>_init` and `<alias>_clear`; aliases of `Nat` and `Int` use
the packaged GMP `mpz_t`. Initialize owning values before use and clear them
afterward. An alias does not make an owning value safe to shallow-copy. Chains,
copied records and nested containers have
[installed acceptance](../evidence/native-aliases-20260921.md) on both build paths.

### Tagged variants

Concrete Lean inductives become structs with a `kind` field and a union of named
`cases`. Use the generated constructor constants and `_select` function. The
[variant example](../../tests/fixtures/onboarding/native-variants/Variants.lean)
can be called from this `main.c`:

```c
#include <variants.h>
#include <string.h>

int main(void) {
    variants_signal input, output;
    variants_signal_init(&input);
    variants_signal_init(&output);
    if (variants_signal_select(&input, VARIANTS_SIGNAL_KIND_DATA)
        != VARIANTS_STATUS_OK) return 1;
    input.cases.data.count = 41;
    input.cases.data.label = (variants_string){"ready", 5, NULL, NULL};

    variants_error error = {0};
    variants_status status = variants_next(&input, &output, &error);
    int failed = status != VARIANTS_STATUS_OK
        || output.kind != VARIANTS_SIGNAL_KIND_DATA
        || output.cases.data.count != 42
        || output.cases.data.label.length != 6
        || memcmp(output.cases.data.label.data, "ready!", 6);
    variants_signal_clear(&output);
    variants_signal_clear(&input);
    return failed;
}
```

`_init` initializes the first constructor. `_select` releases the current payload
and initializes the selected constructor, including any nested GMP integers.
It resets fields even when selecting the same constructor. An invalid selection
returns `INVALID_ARGUMENT` without changing the value. Read `kind` to choose the
active case; change it through `_select`, not direct assignment.

Only the active constructor's fields are read, copied and cleared. Empty
constructors remain distinct; `Unit` fields hold zero. `_clear` releases owned
storage and restores the initialized first constructor. Repeated clear is safe.
Do not shallow-copy an owned result. Clear an earlier result before reusing its
output slot, following the package's [cleanup rules](#values-and-cleanup).

Payloads may nest supported copied primitives, records, variants and containers.
Constructor fields use snake_case, with a trailing underscore for C keywords.
The [installed checks](../evidence/c-variants-20260921.md) cover plain C and C/GMP
archives on both source paths. Packages containing recursive types use the
graph API below. Callable and identity-bearing payloads remain separate work.

## Recursive copied values

A package containing recursive copied types exposes named structs and constructor
tags. Recursive fields use typed pointers or spans. `Nat` and `Int` use GMP,
which the prepared archive includes and links through CMake or pkg-config.

For the recursive acceptance package, this copies an empty branch through Lean:

```c
#include <recursive.h>

int main(void) {
    recursive_tree_t input, output;
    recursive_tree_t_init(&input);
    recursive_tree_t_init(&output);
    recursive_tree_t_select(&input, RECURSIVE_TREE_T_KIND_BRANCH);
    recursive_error error = {0};
    recursive_status status = recursive_tree(&input, &output, &error);
    recursive_tree_t_clear(&output);
    recursive_tree_t_clear(&input);
    return status != RECURSIVE_STATUS_OK;
}
```

Graph variants start without an active constructor. Call `_select` before filling
one; `_clear` restores that unselected state. Calls replace an initialized output
on success and preserve it on failure. Input pointer/span children are borrowed.
Returned roots own independent copies. Clear or select the root, never a borrowed
child view, and do not shallow-copy owned results. Inline returned values can be
owned by a caller-built parent and released when that parent is cleared.

Calls share limits of 128 levels, 262,144 visited nodes and 16 MiB native copied
storage across inputs and output. Host conversion storage has a separate 16 MiB
budget. Cycles, invalid fields and exceeded limits return `INVALID_ARGUMENT`.
Bridge allocation failures return `UNEXPECTED_ERROR`; GMP keeps its default
fatal allocation policy. Malformed native results retire the shared runtime,
but previously owned values remain clearable. See the
[C/GMP ownership rules](../evidence/gmp-recursive-conversions-20260923.md).

## Exact integers

Prepared C packages expose Lean `Nat` and `Int` as GMP `mpz_t`, including array elements and record fields. The archive supplies GMP 6.3.0 and configures it through CMake and pkg-config. You do not install a separate dependency or construct limb buffers.

Initialize standalone integers with `mpz_init` or `mpz_init_set_str`, and release them with `mpz_clear`. Inputs use `mpz_srcptr`; outputs use `mpz_ptr` and must already be initialized. For a package exporting `Sample.echoNat (value : Nat) : Nat`, a call looks like this:

```c
#include <sample.h>

int main(void) {
    mpz_t input, output;
    mpz_init(input);
    mpz_init(output);
    mpz_setbit(input, 16384);
    sample_error error = {0};
    sample_status status = sample_echo_nat(input, output, &error);
    int failed = status != SAMPLE_STATUS_OK || mpz_cmp(input, output) != 0;
    mpz_clear(output);
    mpz_clear(input);
    return failed;
}
```

Negative `Nat` inputs return `INVALID_ARGUMENT`. `Int` preserves the sign. Calls can reuse initialized outputs, including the same integer as input and output. GMP integers are owning values: use `mpz_set` to copy, never struct assignment or `memcpy`. The [installed GMP checks](../evidence/c-gmp-20260919.md) cover both source paths, nested values, primitive callables and relocated packages.

The 16 MiB conversion limit still applies. GMP's default allocator aborts if its allocation fails; the bridge does not change its global allocation hooks. See [GMP allocation behavior](https://gmplib.org/manual/Custom-Allocation).

## Callbacks and returned closures

Ordinary-source and compiler-checked reviewed C packages support synchronous callbacks and returned Lean closures across all nineteen primitives, arrays, Lists, options, results, products, acyclic records, variants and transparent aliases. Use the callback struct and closure functions declared in your package's public header. Their generated names distinguish each complete signature. Alpha's `transform` names above belong to that example, not every package.

A callback struct contains a typed `call` function pointer and a `context` pointer. Both must remain valid until the exporting Lean call returns. Callback arguments borrow storage for that invocation only. String and byte-array argument views have null `owner` and `release` fields; do not clear, retain or mutate the underlying buffers. To return such an argument unchanged, shallow-copy its borrowed view into `*out`. To return your own buffer, populate `owner` and `release`. The adapter copies and releases the result once, including on failure. Use null ownership fields for storage you retain.

Integer callbacks receive borrowed `mpz_srcptr` arguments and an already initialized `mpz_ptr` output. Assign with `mpz_set(out, value)` or GMP arithmetic. Do not initialize or clear that output yourself, and do not mutate or clear the borrowed arguments. The adapter releases its temporary integers after the callback returns.

Structured callbacks receive pointers to typed copied values. Every nested string,
byte buffer and span is borrowed and has null ownership fields. These views expire
when the callback returns. Fill the initialized output's active fields, using
`mpz_set` for nested integers and generated `_select` helpers for variants. Do not
shallow-copy a struct containing GMP integers or owned storage. The adapter copies
the returned value into Lean and releases callback-owned storage even when the
callback reports an error. `None`, `Some(None)`, `Some(Unit)` and empty containers
remain distinct.

Return the package's `_STATUS_OK` on success. On failure, return a non-OK status and optionally fill the error code, message pointer and byte length. Keep that text valid until the callback returns. The adapter preserves the first failure through cleanup, suppresses further host callback invocations for that Lean call, and leaves the caller's output unchanged. Error messages use thread-local storage and are truncated to 1,023 bytes; copy them before the next failing call on that thread. C callbacks and release hooks must return normally. Do not unwind with `longjmp` or a C++ exception across Lean frames.

Returned closures own their captured Lean values. Call them on the creating thread, then pass the owning pointer's address to `_dispose`; it clears the pointer and repeated disposal is safe. Do not shallow-copy an owning pointer or use aliases after disposal. The adapter checks closure signatures and generation tokens. A Lean closure that retained a borrowed host callback fails after that borrow expires.

Same-thread nested C/Lean calls are supported up to 64 active callable invocations. Each call has a 16 MiB conversion budget covering inputs, callback arguments/results and the final output. Closure leases share the runtime's 4,096-identity capacity. These limits leave the Lean algorithm's own memory use unbounded. The [installed C checks](../evidence/c-callables-20260918.md) cover conversion, failure recovery, expired callbacks and disposal on both source paths.

The [structured callable checks](../evidence/c-structured-callables-20260924.md)
cover acyclic signatures up to 32 types deep. Packages containing recursive
callback values use the graph API and limits described below. Callbacks inside
copied containers, asynchronous delivery and resource-containing aggregates
remain unsupported.

### Recursive callbacks

Recursive callbacks receive borrowed graph values and fill an initialized owned
output. Use the generated `TYPE_copy` function to return or modify an independent
copy. It supports in-place copying and preserves the output on failure. Do not
shallow-copy the argument or its ownership fields. The adapter releases the
callback's output after copying it into Lean, including when the callback fails.

For the [publisher example](../publish/c.md#export-recursive-callbacks), save
`recursive-callables.c`:

```c file=c/recursive-callables.c
#include "structured.h"
#include <stdio.h>

static structured_status increment(void *context, const structured_tree_t *value,
    structured_tree_t *out, structured_error *error) {
    (void)context;
    structured_status status = structured_tree_t_copy(value, out, error);
    if (status == STRUCTURED_STATUS_OK && out->kind == STRUCTURED_TREE_T_KIND_LEAF)
        mpz_add_ui(out->cases.leaf.value, out->cases.leaf.value, 1);
    return status;
}

int main(void) {
    structured_tree_t input, output;
    structured_tree_t_init(&input);
    structured_tree_t_init(&output);
    if (structured_tree_t_select(&input, STRUCTURED_TREE_T_KIND_LEAF)
        != STRUCTURED_STATUS_OK) return 1;
    mpz_set_ui(input.cases.leaf.value, 42);

    /* This signature-specific name comes from structured.h. */
    structured_callbackf4488fe53adb351ea5ca callback = {increment, NULL};
    structured_error error = {0};
    structured_status status = structured_call_recursive(&input, &callback, &output, &error);
    int failed = status != STRUCTURED_STATUS_OK
        || output.kind != STRUCTURED_TREE_T_KIND_LEAF
        || mpz_cmp_ui(output.cases.leaf.value, 43)
        || mpz_cmp_ui(input.cases.leaf.value, 42);
    if (!failed) puts("43");
    structured_tree_t_clear(&output);
    structured_tree_t_clear(&input);
    return failed;
}
```

Compile using the installed archive's CMake target or pkg-config flags. The
program prints `43`; the input remains `42`. Returned recursive closures use the
same typed values and `_call`/`_dispose` ownership rules as other C closures.
Disposal invalidates the handle immediately; an active invocation keeps its own
reference until it returns. A new thread cannot invoke a closure whose creator
has exited, even if the operating system reuses its thread ID.

Recursive calls share the graph's 128-level, 262,144-node and 16 MiB native-copy
limits across arguments, callback values and results. Every container or
constructor edge counts toward the depth limit, so a tree level containing an
array consumes more than one edge. Host conversion has a separate 16 MiB budget.
The 64-active-call and 4,096-live-identity limits still apply. C and C++ headers
from the same release can be included in either order and share one runtime.

### Type conversions

Profiles: C. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `uint8_t (zero)` (input, field, callback input); `void (no output)` (result, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | C inputs use zero; Unit results have no output argument. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `bool` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `uint8_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `uint16_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `uint32_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `uint64_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `int8_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -128..127; reject overflow before narrowing. |
| `Int16` | `int16_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `int32_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `int64_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `mpz_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact GMP 6.3.0 mpz_t; prepared archives include headers, a shared library, source and licenses. Initialize integers and copied records before use. Negative Nat inputs reject in scalar, field, array and callback positions. Inputs are borrowed; initialized outputs change only on success. Copy with mpz_set and finish standalone values with mpz_clear. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `mpz_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Signed exact GMP 6.3.0 mpz_t with the same initialization, borrowing and cleanup rules. Callback output integers are already initialized; assign with mpz_set without reinitializing or clearing them. No floating-point conversion. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `float` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `double` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `<prefix>_string` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Length-delimited valid UTF-8, including embedded NUL. Invalid UTF-8 is rejected before the Lean call. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `<prefix>_bytes` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Copied uninterpreted bytes. Clear owned C outputs; C++ vectors own their data. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `<prefix>_array_<type>_span` (input, result, field); `Typed borrowed/owned C span` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Typed data/length spans. Inputs borrow caller storage; generated clear releases every owned nested output element. Do not shallow-copy an owned result. Nested buffers are borrowed with null ownership fields. Fill initialized callback outputs; use mpz_set for integers and generated variant selectors. Owned results are copied into Lean and released even on failure. Returned closures retain captured values; invalid inputs/results and expired leases preserve caller outputs. Typed spans preserve all nineteen copied primitive elements, order, duplicates, empty and nested arrays and records. Input storage is borrowed; returned dynamic payloads own independent copies. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `Generated struct with uint8_t has_value and typed value` (input, result, field); `Typed C value with has_value` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Flag 0 selects none; 1 selects some, including Unit or another none. Other flag values reject. Initialize all fields; generated clear releases owned results. Nested buffers are borrowed with null ownership fields. Fill initialized callback outputs; use mpz_set for integers and generated variant selectors. Owned results are copied into Lean and released even on failure. Returned closures retain captured values; invalid inputs/results and expired leases preserve caller outputs. Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | `Generated struct with uint8_t is_ok, typed ok and error` (input, result, field); `Typed C value with is_ok and success/error fields` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | is_ok=1 selects ok; 0 selects error. Only the selected payload crosses into Lean, but initialize both fields for cleanup. Domain errors return values with successful boundary status. Nested buffers are borrowed with null ownership fields. Fill initialized callback outputs; use mpz_set for integers and generated variant selectors. Owned results are copied into Lean and released even on failure. Returned closures retain captured values; invalid inputs/results and expired leases preserve caller outputs. Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `Generated struct with typed fst and snd` (input, result, field); `Nested typed C product` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | fst/snd retain arity, types and binary nesting. GMP packages supply recursive init/clear; other packages use zero initialization and clear-before-reuse. Nested buffers are borrowed with null ownership fields. Fill initialized callback outputs; use mpz_set for integers and generated variant selectors. Owned results are copied into Lean and released even on failure. Returned closures retain captured values; invalid inputs/results and expired leases preserve caller outputs. Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `<prefix>_<record>` (input, result, field); `Named typed C struct` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Generated structs and deep clear functions. Packages exposing Nat/Int require the generated _init before first use; other packages use zero-initialized outputs. Empty records contain a placeholder byte; Lean constructors/accessors preserve compiler layout. Nested buffers are borrowed with null ownership fields. Fill initialized callback outputs; use mpz_set for integers and generated variant selectors. Owned results are copied into Lean and released even on failure. Returned closures retain captured values; invalid inputs/results and expired leases preserve caller outputs. Named structs preserve source field meanings, including empty and single-field records. Keyword fields gain a trailing underscore. Generated init/clear functions manage nested GMP values. Failed conversions preserve the initialized output and release partial owners. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | `<prefix>_<snake_name>_t typedef of copied target storage` (input, result, field); `C typedef for its copied target` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Transparent target storage and validation. Aggregate aliases supply init/clear helpers; Nat/Int use initialized GMP mpz_t. Copy and cleanup rules follow the target. Nested buffers are borrowed with null ownership fields. Fill initialized callback outputs; use mpz_set for integers and generated variant selectors. Owned results are copied into Lean and released even on failure. Returned closures retain captured values; invalid inputs/results and expired leases preserve caller outputs. Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | `struct with named constructor tags and a union of payload fields; mpz_t for Nat/Int` (input, result, field); `Named C tagged union and constructor helpers` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Use named KIND constants with init/select/clear. Select releases the active payload and initializes the chosen case, including nested GMP integers; invalid selections leave the value unchanged. Empty cases and Unit fields remain distinct. Results own independent storage. GMP calls replace initialized output values; plain C requires clearing a prior owned result before reuse. Failed calls preserve the supplied output slot. Never assign kind directly or shallow-copy owned values. Nested buffers are borrowed with null ownership fields. Fill initialized callback outputs; use mpz_set for integers and generated variant selectors. Owned results are copied into Lean and released even on failure. Returned closures retain captured values; invalid inputs/results and expired leases preserve caller outputs. Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `opaque resource pointer` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `generated typed callback struct` (input) | Ordinary source: Installed checks passed (input); Not audited (result, field, callback input, callback result). Reviewed IR: Installed checks passed (input); Not audited (result, field, callback input, callback result) | Host context and function pointer borrow the synchronous call. Primitive arguments use the checked C value representations. Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | `<prefix>_list_<element>_span` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Borrow contiguous input data for one call; returned spans own independent copies. Preserve order, duplicates and nesting. List and Array have distinct generated types. Follow package initialization and deep-clear rules. Nested buffers are borrowed with null ownership fields. Fill initialized callback outputs; use mpz_set for integers and generated variant selectors. Owned results are copied into Lean and released even on failure. Returned closures retain captured values; invalid inputs/results and expired leases preserve caller outputs. Required: Preserve order, duplicates and nesting with a distinct list constructor. Validate all elements and copying limits; never expose Lean cons cells. |
| `Char` | `uint32_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly one Unicode scalar, 0..0x10FFFF excluding surrogates. NUL, supplementary characters, combining scalars, noncharacters and line endings are preserved without normalization. Multi-scalar grapheme clusters require String. The shared C boundary rejects out-of-range values before calling Lean. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | `uint64_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, 0..18446744073709551615. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | `int64_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, -9223372036854775808..9223372036854775807. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Dependent parameters and results` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | `Named structs, constructor tags, typed borrowed children and GMP integers` (input, result, field); `Named C structs, constructor tags, borrowed recursive inputs and owned GMP-backed replies` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Initialize outputs and select named constructors before filling their fields. Success replaces the initialized output; failure preserves it. Borrow input pointer/span children. Clear only owning result roots, not nested views; do not shallow-copy owners. GMP retains its default fatal allocation policy. Callback arguments borrow initialized values for the call. Use generated TYPE_copy or initialized fields for owned replies, never shallow-copy GMP values or owners. The adapter releases replies on success and failure. Failed calls preserve outputs. Returned closures retain independent captures and require explicit disposal. Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
| `Polymorphic exports` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |
| `Implicit arguments {α}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |
| `Instance arguments [C α]` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specialize or supply the selected dictionary without changing runtime behavior. |
| `Prop / theorem / proof arguments` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Record theorem identity and assumptions. Erasure does not remove the need to check a runtime refinement. |
| `Optional parameter with default` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Apply only the declared default; distinguish omitted input from a supplied Option.none. |
| `Explicit nullable host value` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Select an explicit host projection; null does not stand for every missing, erased or unsupported value. |
| `IO α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Executing IO is not automatically asynchronous. Preserve effect order and exceptions. |
| `EIO ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve typed failures separately from transport validation and unexpected traps. |
| `Declared failure contract` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Project every declared error and payload; preserve trap or poisoned-runtime handling separately. |
| `Task α / asynchronous result` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Keep completion, rejection, cancellation and runtime lifetime distinct; do not block a browser event loop. |
| `Declared host object` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate typed members and preserve receiver identity, dynamic-access policy and lifetime. |
| `Lean function returned to the host` | `generated owned closure pointer` (result) | Ordinary source: Not audited (input, field, callback input, callback result); Installed checks passed (result). Reviewed IR: Not audited (input, field, callback input, callback result); Installed checks passed (result) | Required: Preserve captured state, call signature, errors and deterministic disposal. |
| `Cancellation protocol` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specify acknowledgement and late completion; release pending work exactly once. |
| `Synchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Preserve values, end-of-sequence, failure, early return and cleanup. |
| `Asynchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Preserve backpressure, pending-pull cancellation and terminal cleanup. |

### Alpha example API

These names come from the prepared Alpha package's `lean_alpha.h`. Fallible functions return `lean_alpha_status` and write their result through an output parameter. Read that output only after `LEAN_ALPHA_STATUS_OK`.

| Lean type | C type | Conversion rules |
| --- | --- | --- |
| `Bool` | `bool` | Boolean from `<stdbool.h>`. |
| `UInt32` | `uint32_t` | Full unsigned 32-bit range. Validate wider or signed application values before casting. |
| `String` | `lean_alpha_string` | UTF-8 `data` plus byte `length`; no NUL terminator is required. |
| `ByteArray` | `lean_alpha_bytes` | `const uint8_t *data` plus byte `length`. |
| `Array UInt32` | `lean_alpha_array_uint32_span` | `const uint32_t *data` plus element `length`, not a byte count. |
| `Payload` | `lean_alpha_payload` | Field-preserving struct. Call `lean_alpha_payload_clear` on the returned copy. |
| `Box` | `lean_alpha_box *` | Opaque owned resource; dispose with `lean_alpha_box_dispose`. `identity` returns a borrowed `const lean_alpha_box *`. |
| `UInt32 → UInt32` callback | `lean_alpha_transform` | Typed function pointer plus context; writes the result and returns a status. Both must remain valid throughout the synchronous call. |
| Returned Lean closure | `lean_alpha_owned_transform *` | Call with `lean_alpha_owned_transform_call`; release with `lean_alpha_owned_transform_dispose`. |

Input buffers may borrow application storage for the call. Returned buffers carry package-provided cleanup; use their generated `clear` functions, not `free`.

## Types, errors, and cleanup

Alpha's scalar values use `uint32_t`. Strings, bytes, and arrays pair a pointer with an explicit length; a string need not be null-terminated. `round_trip` returns copied buffers, toggles `enabled`, and increments `count`. Alpha adds two to the host callback result, giving 44 in the example.

Check each status before reading an output. Error messages carry `message_length`; the example prints them with `fwrite` instead of assuming a terminator.

Call `lean_alpha_payload_clear` on returned payloads. The input's borrowed stack buffers need no clear call. Dispose `Box` and returned callables with their pointer-to-pointer functions; disposal clears the owning pointer. The pointer returned by `identity` is borrowed from the original box. Never dispose it separately or use it after the owner is released.

## Troubleshooting

- If CMake cannot find `LeanBridgeAlpha`, pass the extracted package root through `CMAKE_PREFIX_PATH`, not the archive filename or its parent.
- Link the `LeanBridge::Alpha` target so the consumer receives the generated include paths and required libraries.
- Keep both native libraries together in the package's `lib` directory. If the loader reports a missing glibc symbol version, use the supported native platform.

## Start from a raw Lean package

Follow [the C build-and-publish guide](../publish/c.md) for source inputs and package preparation. For an existing library, start with [Adapt an existing library](../lean/existing-package.md).

### Package authors and acceptance

Repository checks live in [Contributing](../contributing/testing.md#consumer-acceptance).

### Publish this package

Continue in the [build-and-publish workflow](../publish/c.md).
