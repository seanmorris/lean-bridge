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

Ordinary-source and compiler-checked reviewed C packages support synchronous callbacks and returned Lean closures across all nineteen primitives. Use the callback struct and closure functions declared in your package's public header. Their generated names distinguish each complete signature. Alpha's `transform` names above belong to that example, not every package.

A callback struct contains a typed `call` function pointer and a `context` pointer. Both must remain valid until the exporting Lean call returns. Callback arguments borrow storage for that invocation only. String and byte-array argument views have null `owner` and `release` fields; do not clear, retain or mutate the underlying buffers. To return such an argument unchanged, shallow-copy its borrowed view into `*out`. To return your own buffer, populate `owner` and `release`. The adapter copies and releases the result once, including on failure. Use null ownership fields for storage you retain.

Integer callbacks receive borrowed `mpz_srcptr` arguments and an already initialized `mpz_ptr` output. Assign with `mpz_set(out, value)` or GMP arithmetic. Do not initialize or clear that output yourself, and do not mutate or clear the borrowed arguments. The adapter releases its temporary integers after the callback returns.

Return the package's `_STATUS_OK` on success. On failure, return a non-OK status and optionally fill the error code, message pointer and byte length. Keep that text valid until the callback returns. The adapter preserves the first failure through cleanup, suppresses further host callback invocations for that Lean call, and leaves the caller's output unchanged. Error messages use thread-local storage and are truncated to 1,023 bytes; copy them before the next failing call on that thread. C callbacks and release hooks must return normally. Do not unwind with `longjmp` or a C++ exception across Lean frames.

Returned closures own their captured Lean values. Call them on the creating thread, then pass the owning pointer's address to `_dispose`; it clears the pointer and repeated disposal is safe. Do not shallow-copy an owning pointer or use aliases after disposal. The adapter checks closure signatures and generation tokens. A Lean closure that retained a borrowed host callback fails after that borrow expires.

Same-thread nested C/Lean calls are supported up to 64 active callable invocations. Each call has a 16 MiB conversion budget covering inputs, callback arguments/results and the final output. Closure leases share the runtime's 4,096-identity capacity. These limits leave the Lean algorithm's own memory use unbounded. The [installed C checks](../evidence/c-callables-20260918.md) cover conversion, failure recovery, expired callbacks and disposal on both source paths.

### Type conversions

Profiles: C. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `uint8_t (zero)` (input, field, callback input); `void (no output)` (result, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | C inputs use zero; Unit results have no output argument. C value positions use uint8_t zero; no-payload results omit the output argument. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `bool` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `uint8_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `uint16_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `uint32_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `uint64_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `int8_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Required: -128..127; reject overflow before narrowing. |
| `Int16` | `int16_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `int32_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `int64_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `mpz_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact GMP 6.3.0 mpz_t; prepared archives include headers, a shared library, source and licenses. Initialize integers and copied records before use. Negative Nat inputs reject in scalar, field, array and callback positions. Inputs are borrowed; initialized outputs change only on success. Copy with mpz_set and finish standalone values with mpz_clear. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `mpz_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Signed exact GMP 6.3.0 mpz_t with the same initialization, borrowing and cleanup rules. Callback output integers are already initialized; assign with mpz_set without reinitializing or clearing them. No floating-point conversion. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `float` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `double` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `<prefix>_string` (input, result, field, callback input, callback result); `<prefix>_string buffer struct` (field) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Length-delimited valid UTF-8, including embedded NUL. Invalid UTF-8 is rejected before the Lean call. Inputs may borrow storage for the call. Clear owned returned buffers with the generated clear function, not free(). Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `<prefix>_bytes` (input, result, field, callback input, callback result); `<prefix>_bytes buffer struct` (field) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Copied uninterpreted bytes. Clear owned C outputs; C++ vectors own their data. Inputs may borrow storage for the call. Clear owned returned buffers with the generated clear function, not free(). Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `<prefix>_array_<type>_span` (input, result, field); `<prefix>_array_<primitive>_span` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Typed data/length spans. Inputs borrow caller storage; generated clear releases every owned nested output element. Do not shallow-copy an owned result. Inputs may borrow storage for the call. Clear owned returned buffers with the generated clear function, not free(). Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `<prefix>_<record>` (input, result, field); `Generated copied struct (Alpha: lean_alpha_payload)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Generated structs and deep clear functions. Packages exposing Nat/Int require the generated _init before first use; other packages use zero-initialized outputs. Empty records contain a placeholder byte; Lean constructors/accessors preserve compiler layout. Inputs may borrow storage for the call. Clear owned returned buffers with the generated clear function, not free(). Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | `Resolved target type` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `opaque resource pointer` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `generated typed callback struct` (input) | Ordinary source: Installed checks passed (input); Not audited (result, field, callback input, callback result). Reviewed IR: Installed checks passed (input); Not audited (result, field, callback input, callback result) | Host context and function pointer borrow the synchronous call. Primitive arguments use the checked C value representations. Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve order and elements without exposing list constructors; choose and test a lossless IR lowering. |
| `Char` | `uint32_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly one Unicode scalar, 0..0x10FFFF excluding surrogates. NUL, supplementary characters, combining scalars, noncharacters and line endings are preserved without normalization. Multi-scalar grapheme clusters require String. The shared C boundary rejects out-of-range values before calling Lean. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | `uint64_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, 0..18446744073709551615. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | `int64_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, -9223372036854775808..9223372036854775807. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Dependent parameters and results` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
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
