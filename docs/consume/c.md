# Use a Lean package from C

The Alpha C archive provides a C11 header, the native component and Lean runtime, and CMake and pkg-config metadata. Every fallible call returns a status and writes details to `lean_alpha_error`.

## Use a prepared release

### Requirements and package

Use a C11 compiler, CMake 3.20 or newer, and tar on Linux x86-64 with glibc 2.38 or newer. The [support contract](../consumer-support.v1.json) records the tested profile.

Request `lean-bridge-alpha-0.0.0-c.tar.gz` and the authentication files in [Use a prepared release](receive-package.md). Authenticate the archive before extracting it.

### Create the project

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

### Call Lean

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

### Type conversions

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

Input buffers may borrow application storage for the call. Returned buffers carry package-provided cleanup; use their generated `clear` functions, not `free`. This Alpha header does not expose `Nat`, `Int`, floating-point, optional, or asynchronous operations.

### Types, errors, and cleanup

Alpha's scalar values use `uint32_t`. Strings, bytes, and arrays pair a pointer with an explicit length; a string need not be null-terminated. `round_trip` returns copied buffers, toggles `enabled`, and increments `count`. Alpha adds two to the host callback result, giving 44 in the example.

Check each status before reading an output. Error messages carry `message_length`; the example prints them with `fwrite` instead of assuming a terminator.

Call `lean_alpha_payload_clear` on returned payloads. The input's borrowed stack buffers need no clear call. Dispose `Box` and returned callables with their pointer-to-pointer functions; disposal clears the owning pointer. The pointer returned by `identity` is borrowed from the original box. Never dispose it separately or use it after the owner is released.

### Troubleshooting

- If CMake cannot find `LeanBridgeAlpha`, pass the extracted package root through `CMAKE_PREFIX_PATH`, not the archive filename or its parent.
- Link the `LeanBridge::Alpha` target so the consumer receives the generated include paths and required libraries.
- Keep both native libraries together in the package's `lib` directory. If the loader reports a missing glibc symbol version, use the supported native platform.

## Start from a raw Lean package

For Alpha, [build the native bundle and C projection](../contributing/testing.md#build-the-example-artifacts-as-a-maintainer) to produce `lean-bridge-alpha-0.0.0-c.tar.gz`. The application then links the packaged component through the [CMake project above](#create-the-project).

For another Lean library, check the [source workflow and supported targets](../consume.md#start-from-a-raw-lean-package). These Alpha builds use the repository's target-specific inputs.

### Package authors and acceptance

Contributors can [build the Alpha examples](../contributing/testing.md#build-the-example-artifacts-as-a-maintainer) and run the [installed consumer checks](../contributing/testing.md#consumer-acceptance). See [native consumer evidence](../evidence/native-consumer-acceptance.md).

### Publish this package

See [Distribute C, C++, and WASI archives](../publish/archives.md) for package preparation, distribution, and verification after upload.
