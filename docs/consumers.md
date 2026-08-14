# Downstream consumers

The [versioned support contract](consumer-support.v1.json) records thirteen consumers separately. `supported` means that a clean consumer installs the documented artifact and executes real Lean through the generated public API. The current proof of concept supports every listed row. Native packages target x86-64 Linux with glibc 2.38 or newer.

## Browser JavaScript

The npm archive exposes its public module through a browser conditional export. Install with lifecycle scripts disabled, then use an ordinary bare-package import:

```sh
npm install --ignore-scripts ./lean-bridge-alpha-0.0.0.tgz
```

```js
import { Box, roundTrip } from "@lean-bridge/alpha";

const box = new Box(42);
console.assert(box.read() === 42);
box.dispose();

const value = roundTrip({
  enabled: true,
  count: 41,
  label: "browser",
  bytes: new Uint8Array([0, 127, 255]),
  values: [1, 5, 13],
});
console.assert(value.count === 42);
```

`npm run test:consumer:browser` installs the archive in a clean directory, bundles the bare import with Vite, and executes the real Lean component in Chromium. Raw ESM, workers, Rollup, Webpack, and React remain covered by the broader [browser bundler evidence](evidence/browser-bundler-acceptance.md).

## Python

The platform wheel contains generated Python, its lazy native adapter, one component library, and the shared runtime:

```sh
uname -m
getconf GNU_LIBC_VERSION
```

Continue only when these commands report `x86_64` and glibc 2.38 or newer. The platform check avoids pip's generic unsupported-wheel error on an older host.

```sh
python3 -m pip debug --verbose | grep -F 'py3-none-manylinux_2_38_x86_64'
python3 -m pip install --no-index --no-deps ./lean_bridge_alpha-0.0.0-py3-none-manylinux_2_38_x86_64.whl
```

The compatibility command must print the wheel's exact tag before installation.

```python
from lean_alpha import Box, Payload, make_adder, round_trip, with_callback

with Box(42) as box:
    assert box.read() == 42
    assert box.identity() is box

value = round_trip(Payload(True, 41, "python", b"\x00\xff", (1, 5, 13)))
assert value.count == 42
assert with_callback(40, lambda current: current + 2) == 44
with make_adder(2) as add_two:
    assert add_two(40) == 42
```

The Alpha `round_trip` fixture toggles `enabled`, increments `count`, and preserves the label, bytes, and values. The generated dataclass, callback, and returned callable hide the native adapter.

Verify the canonical package identity from the installed package without a Lean Bridge checkout:

```python
from hashlib import sha256
from importlib.resources import files

metadata = files("lean_alpha").joinpath("lean_bridge", "metadata")
manifest = metadata.joinpath("canonical-package.json").read_bytes()
expected = metadata.joinpath("canonical-package.sha256").read_text().split()[0]
actual = sha256(manifest).hexdigest()
assert actual == expected
print(actual)
```

## Rust

Extract the deterministic `.crate` into a local registry or vendor directory and add `lean_bridge_alpha` as a normal dependency. The crate locates its packaged component without an installation script:

```rust
use lean_bridge_alpha::{make_adder, with_callback, Box};

let boxed = Box::new(42)?;
assert_eq!(boxed.read()?, 42);
assert_eq!(with_callback(40, |value| Ok(value + 2))?, 44);
let add_two = make_adder(2)?;
assert_eq!(add_two.call(40)?, 42);
```

`Drop` releases identity-bearing Lean resources. The exported Lean closure remains an explicit `.call(...)` method because stable Rust does not permit generated implementations of the `Fn` traits.

## C

The C archive provides CMake and pkg-config discovery, the generated C11 header, and both native libraries:

```c
#include <lean_alpha.h>

lean_alpha_error error = {0};
lean_alpha_box *box = NULL;
uint32_t value = 0;

if (lean_alpha_box_create(42, &box, &error) == LEAN_ALPHA_STATUS_OK) {
  lean_alpha_box_read(box, &value, &error);
}
lean_alpha_box_dispose(&box);
```

With CMake, use `find_package(LeanBridgeAlpha 0.0.0 EXACT CONFIG REQUIRED)` and link `LeanBridge::Alpha`.

## C++

The C++20 archive adds typed values and deterministic RAII wrappers over the same C component:

```cpp
#include <lean_alpha.hpp>

lean_bridge::alpha::Box box{42};
auto value = box.read();
auto add_two = lean_bridge::alpha::make_adder(2);
auto result = add_two(40);
```

The wrapper is move-only. Destructors release `Box` and returned `Transform` values; `close()` is also available for deterministic early release.

`npm run test:consumer:native` builds all four deterministic projections, installs each in a separate clean directory, and executes retained resources, copied values, callbacks, closures, and disposal against real Lean. See [native consumer acceptance](evidence/native-consumer-acceptance.md).

## .NET, JVM, and Ruby

The NuGet, Maven, and RubyGems archives package idiomatic generated APIs over the same shared native runtime and independently compiled Alpha and Beta components. .NET 8 uses source-generated `LibraryImport`, JDK 22 uses the finalized Foreign Function and Memory API without JNI, and MRI Ruby 3.3 uses `Fiddle` without compiling a native extension.

`npm run test:consumer:managed` restores or installs every archive in a clean project and executes copied values, identity-bearing resources, callbacks, returned callables, repeated close, stale-use rejection, and two-component composition against real Lean. The JVM check also compiles Kotlin and uses isolated class loaders. See the [.NET, JVM, and Ruby guide](dotnet-jvm-ruby.md) and [managed consumer acceptance](evidence/managed-consumer-acceptance.md).

## WIT and WASI

The WIT/WASI archive contains the generated portable WIT projection, a binary Component Model adapter, an independent Wasmtime 42 host, and the same shared native Lean runtime. Run it directly after extracting the archive:

```sh
./lean-bridge-alpha-wasi-0.0.0/bin/lean-alpha-wasi-host
```

The host prints `42`. Wasmtime enters the packaged component, the component invokes its typed host import, and the host constructs and reads a real Lean `Box` through the generated C API. The adapter package also retains the broader WIT projection for `Box`, `read`, and `roundTrip`. Callback values and receiver-anchored borrowed results remain outside that portable WIT subset, but they are not required by the supported adapter entry point.

`npm run test:consumer:wasi` extracts the deterministic archive, invokes the component, and validates the binary independently with wasm-tools. See [WIT and WASI consumer acceptance](evidence/wasi-consumer-acceptance.md).

## Promotion rule

CI fails if any supported consumer does not install its package and execute real Lean. The workflow publishes all thirteen observations in the GitHub job summary.
