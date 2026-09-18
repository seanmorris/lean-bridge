# Use a Lean package from C++

Ordinary-source C++ releases include a generated header, C API, component library and matching Lean runtime. The package README and `lean-bridge-package.json` give its namespace, CMake target and pkg-config name. Loading the package initializes Lean automatically; no separate C package or Lean installation is needed. The walkthrough below uses Alpha's prepared example. Authors can [build C++ packages from ordinary Lean source](../publish/cpp.md#build-an-ordinary-lean-project).

The Alpha C++20 package provides typed values and move-only RAII wrappers over the compiled Lean component. CMake links the component and its shared runtime through one imported target.

## Use a prepared release

### Requirements and package

Use a C++20 compiler, CMake 3.20 or newer, and tar on Linux x86-64 with glibc 2.38 or newer. The [support contract](../consumer-support.v1.json) records the tested profile.

Request `lean-bridge-alpha-0.0.0-cpp.tar.gz` and the authentication files in [Use a prepared release](receive-package.md). Authenticate the archive before extraction.

## Create the project

Put the archive in your project directory and extract it:

```sh
mkdir -p vendor
tar -xzf ./lean-bridge-alpha-0.0.0-cpp.tar.gz -C vendor
```

Save this file as `CMakeLists.txt`:

```cmake file=cpp/CMakeLists.txt
cmake_minimum_required(VERSION 3.20)
project(lean_alpha_docs CXX)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
find_package(LeanBridgeAlpha 0.0.0 EXACT CONFIG REQUIRED)
add_executable(consumer main.cpp)
target_link_libraries(consumer PRIVATE LeanBridge::Alpha)
```

## Call Lean

Save this file as `main.cpp`:

```cpp file=cpp/main.cpp
#include <lean_alpha.hpp>
#include <iostream>
#include <stdexcept>

void require(bool condition) {
    if (!condition) throw std::runtime_error("Unexpected Alpha result");
}

int main() {
    try {
        using namespace lean_bridge::alpha;
        Box box{42};
        require(box.read() == 42 && &box.identity() == &box);
        const Payload input{true, 41, "Lean λ", {0, 255}, {0, UINT32_MAX}};
        const auto value = round_trip(input);
        require(!value.enabled && value.count == 42);
        require(value.label == input.label && value.bytes == input.bytes);
        require(value.values == input.values);
        require(with_callback(40, [](std::uint32_t current) { return current + 2; }) == 44);
        auto add_two = make_adder(2);
        require(add_two(40) == 42);
        add_two.close();
        box.close();
        box.close();
        require(box.closed() && add_two.closed());
        std::cout << "Box: 42; payload: 42; callback: 44; closure: 42\n";
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
```

Configure, compile, and execute:

```sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_PREFIX_PATH="$(pwd)/vendor/lean-bridge-alpha-0.0.0-cpp"
cmake --build build
./build/consumer
```

Expected output:

```text
Box: 42; payload: 42; callback: 44; closure: 42
```

## Values and cleanup

Ordinary-source arrays become `std::vector<T>`, and records become generated structs with owned fields. Both can nest; `Array Bool` uses `std::vector<bool>`. The wrapper keeps input views alive through the call and releases the intermediate C result even if copying a nested result throws. Returned C++ values are independent of the inputs and need no explicit cleanup.

The package enforces the same [copy budget and nesting limit](../publish/c.md#copied-arrays-and-records) as C. Invalid values raise the generated `Error`; C++ allocation failures propagate as `std::bad_alloc`.

### Type conversions

Profiles: C++. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `std::monostate` (input, field); `void (no output)` (result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Pass std::monostate; Unit results return void. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `bool` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `uint8_t` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `uint16_t` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `uint32_t` (input, result, field); `std::uint32_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `uint64_t` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `int8_t` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Required: -128..127; reject overflow before narrowing. |
| `Int16` | `int16_t` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `int32_t` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `int64_t` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `lean_bridge::<prefix>::Nat` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Little-endian uint32 limbs; empty means zero. No narrowing through floating point. Clear owned C outputs; C++ vectors own their data. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `lean_bridge::<prefix>::Int` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Little-endian uint32 magnitude limbs and a negative flag. Zero normalizes to a nonnegative empty magnitude. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `float` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `double` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `std::string` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Length-delimited valid UTF-8, including embedded NUL. Invalid UTF-8 is rejected before the Lean call. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `std::vector<uint8_t>` (input, result, field); `std::vector<std::uint8_t>` (field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Copied uninterpreted bytes. Clear owned C outputs; C++ vectors own their data. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `std::vector<T>` (input, result, field); `std::vector<std::uint32_t>` (field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Owned `std::vector<T>`, including `std::vector<bool>`; scoped views preserve all nested input storage. Returned values are independent copies. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `generated record struct` (input, result, field); `Payload` (input, result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected (input, result); Not audited (field, callback input, callback result) | Generated structs with owned fields and deep result cleanup on exceptions. Empty records use empty structs. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `Box` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `C++ callable` (input) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input); Not audited (result, field, callback input, callback result) | Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve order and elements without exposing list constructors; choose and test a lossless IR lowering. |
| `Char` | `char32_t` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Exactly one Unicode scalar, 0..0x10FFFF excluding surrogates. NUL, supplementary characters, combining scalars, noncharacters and line endings are preserved without normalization. Multi-scalar grapheme clusters require String. The shared C boundary rejects out-of-range values before calling Lean. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | `uint64_t` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | 64-bit compiled Lean target, 0..18446744073709551615. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | `int64_t` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | 64-bit compiled Lean target, -9223372036854775808..9223372036854775807. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Dependent parameters and results` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
| `Polymorphic exports` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |
| `Implicit arguments {α}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |
| `Instance arguments [C α]` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specialize or supply the selected dictionary without changing runtime behavior. |
| `Prop / theorem / proof arguments` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Record theorem identity and assumptions. Erasure does not remove the need to check a runtime refinement. |
| `Optional parameter with default` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Apply only the declared default; distinguish omitted input from a supplied Option.none. |
| `Explicit nullable host value` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Select an explicit host projection; null does not stand for every missing, erased or unsupported value. |
| `IO α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Executing IO is not automatically asynchronous. Preserve effect order and exceptions. |
| `EIO ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve typed failures separately from transport validation and unexpected traps. |
| `Declared failure contract` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Project every declared error and payload; preserve trap or poisoned-runtime handling separately. |
| `Task α / asynchronous result` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep completion, rejection, cancellation and runtime lifetime distinct; do not block a browser event loop. |
| `Declared host object` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate typed members and preserve receiver identity, dynamic-access policy and lifetime. |
| `Lean function returned to the host` | `Transform` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve captured state, call signature, errors and deterministic disposal. |
| `Cancellation protocol` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specify acknowledgement and late completion; release pending work exactly once. |
| `Synchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve values, end-of-sequence, failure, early return and cleanup. |
| `Asynchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve backpressure, pending-pull cancellation and terminal cleanup. |

### Alpha example API

These are the prepared Alpha package's public types in `lean_bridge::alpha`. The C++ wrapper handles the underlying C status and buffer cleanup.

| Lean type | C++ type | Conversion rules |
| --- | --- | --- |
| `Bool` | `bool` | Native Boolean value. |
| `UInt32` | `std::uint32_t` | Full unsigned 32-bit range. Check wider or signed values before conversion; a cast can wrap or truncate. |
| `String` | `std::string` | Owned UTF-8 bytes, including embedded NUL; length is explicit. |
| `ByteArray` | `std::vector<std::uint8_t>` | Owned byte buffer copied across the boundary. |
| `Array UInt32` | `std::vector<std::uint32_t>` | Owned vector of unsigned 32-bit elements. |
| `Payload` | `Payload` | Copyable value struct. `round_trip` borrows its input and returns an owned copy. |
| `Box` | `Box` | Move-only RAII resource; `identity()` returns a reference to the same wrapper. |
| `UInt32 → UInt32` callback | Callable taking and returning `std::uint32_t` | Pass a lambda or function object to the templated `with_callback`; it runs synchronously. |
| Returned Lean closure | `Transform` | Move-only RAII resource with `operator()` and optional early `close()`. |

Its generated `lean_alpha.hpp` defines the available API.

## Types, errors, and cleanup

`Payload` owns its `std::string` and `std::vector` fields. `round_trip` toggles `enabled`, increments `count`, and preserves the other values. Alpha adds two to the host callback result, giving 44 in the example. Scalar values use `std::uint32_t`.

`Box` and returned `Transform` objects are move-only. Their destructors release the Lean resources, including when an exception unwinds the stack. Call `close()` for early release; repeated close is safe. `identity()` returns a reference to the same wrapper, so its lifetime cannot exceed the owning object. Copied payloads need no explicit cleanup.

Native status failures raise `lean_bridge::alpha::Error`, which exposes `status()` and `code()`. Calls on closed wrappers raise `std::runtime_error`. The callback adapter catches a C++ exception and rethrows it after control returns from Lean; do not throw across the underlying C ABI yourself.

## Troubleshooting

- If CMake cannot find the package, pass the extracted root through `CMAKE_PREFIX_PATH`.
- If compilation reports deleted copy operations, move the wrapper or pass it by reference instead of copying it.
- A closed wrapper cannot make further Lean calls. Keep the resource open for every callback or reference that depends on it.
- Keep the package's native libraries together, and check the glibc requirement when deploying.

## Start from a raw Lean package

Follow [the C++ build-and-publish guide](../publish/cpp.md) for source inputs and package preparation. For an existing library, start with [Adapt an existing library](../lean/existing-package.md).

### Package authors and acceptance

Repository checks live in [Contributing](../contributing/testing.md#consumer-acceptance).

### Publish this package

Continue in the [build-and-publish workflow](../publish/cpp.md).
