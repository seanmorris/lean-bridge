# WIT and WASI

The Alpha package includes a WebAssembly Component Model adapter and a Wasmtime host. The exported `read-box` function enters the component, calls a typed native host import, and returns the value read from a real Lean `Box`.

## Use a prepared release

### Prerequisites

Use x86-64 Linux with glibc 2.38 or newer. The archive includes the Wasmtime 42 host, Wasmtime's shared library, and the native Lean libraries. Consumers do not need Lean, a C compiler, or a separately installed Wasmtime CLI.

Install `wasm-tools` only if you want to run the optional binary validation command. The [acceptance record](../evidence/wasi-consumer-acceptance.md) identifies the tested Wasmtime and wasm-tools versions.

### Obtain and extract the package

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

### Run the component

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

### Type conversions

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
| `Nat` or `Int` | No lossless built-in mapping | Arbitrary-precision integer signatures are rejected by the current WIT generator, not narrowed to `u64` or `s64`. |

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

For Alpha, [build the native bundle and WIT/WASI package](../contributing/testing.md#wasi-package), including its Component Model adapter and Wasmtime host. Use the resulting archive with [Obtain and extract the package](#obtain-and-extract-the-package). A standalone WIT declaration or Lean source file does not supply that executable host.

For another Lean library, check the [source workflow and supported targets](../consume.md#start-from-a-raw-lean-package). These Alpha builds use the repository's target-specific inputs.

### Acceptance checks

Contributors run this shell example through the [installed consumer checks](../contributing/testing.md#consumer-acceptance). The [WIT/WASI acceptance record](../evidence/wasi-consumer-acceptance.md) describes the component-to-native call and packaged library checks.

### Publish this package

See [Distribute C, C++, and WASI archives](../publish/archives.md) for package preparation, distribution, and verification after upload.
