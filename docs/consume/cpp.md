# Use a Lean package from C++

The Alpha C++20 package provides typed values and move-only RAII wrappers over the compiled Lean component. CMake links the component and its shared runtime through one imported target.

## Use a prepared release

### Requirements and package

Use a C++20 compiler, CMake 3.20 or newer, and tar on Linux x86-64 with glibc 2.38 or newer. The [support contract](../consumer-support.v1.json) records the tested profile.

Request `lean-bridge-alpha-0.0.0-cpp.tar.gz` and the authentication files in [Receive a package](receive-package.md). Authenticate the archive before extraction.

### Create the project

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

### Call Lean

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

### Types, errors, and cleanup

`Payload` owns its `std::string` and `std::vector` fields. `round_trip` toggles `enabled`, increments `count`, and preserves the other values. Alpha adds two to the host callback result, giving 44 in the example. Scalar values use `std::uint32_t`.

`Box` and returned `Transform` objects are move-only. Their destructors release the Lean resources, including when an exception unwinds the stack. Call `close()` for early release; repeated close is safe. `identity()` returns a reference to the same wrapper, so its lifetime cannot exceed the owning object. Copied payloads need no explicit cleanup.

Native status failures raise `lean_bridge::alpha::Error`, which exposes `status()` and `code()`. Calls on closed wrappers raise `std::runtime_error`. The callback adapter catches a C++ exception and rethrows it after control returns from Lean; do not throw across the underlying C ABI yourself.

### Troubleshooting

- If CMake cannot find the package, pass the extracted root through `CMAKE_PREFIX_PATH`.
- If compilation reports deleted copy operations, move the wrapper or pass it by reference instead of copying it.
- A closed wrapper cannot make further Lean calls. Keep the resource open for every callback or reference that depends on it.
- Keep the package's native libraries together, and check the glibc requirement when deploying.

## Start from a raw Lean package

For Alpha, [build the native bundle and C++ projection](../contributing/testing.md#build-the-example-artifacts-as-a-maintainer) to produce `lean-bridge-alpha-0.0.0-cpp.tar.gz`. Return to the [prepared release steps](#use-a-prepared-release) with that archive.

For another Lean library, check the [source workflow and supported targets](../consume.md#start-from-a-raw-lean-package). These Alpha builds use the repository's target-specific inputs.

### Package authors and acceptance

Contributors can [build the Alpha examples](../contributing/testing.md#build-the-example-artifacts-as-a-maintainer) and run the [installed consumer checks](../contributing/testing.md#consumer-acceptance). See [native consumer evidence](../evidence/native-consumer-acceptance.md).

### Publish this package

See [Distribute C, C++, and WASI archives](../publish/archives.md) for package preparation, distribution, and verification after upload.
