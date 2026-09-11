# WIT and WASI

The Alpha package includes a WebAssembly Component Model adapter and a Wasmtime host. The exported `read-box` function enters the component, calls a typed native host import, and returns the value read from a real Lean `Box`.

## Use a prepared release

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
| `Unit` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected (input, result); Not audited (field, callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `bool` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `u8` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `u16` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `u32` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | The executable's u32 -> u32 Box probe covers an input and result. Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `u64` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `s8` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: -128..127; reject overflow before narrowing. |
| `Int16` | `s16` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `s32` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `s64` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected (input, result); Not audited (field, callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected (input, result); Not audited (field, callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `f32` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `f64` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `string` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `list<u8>` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `list<T>` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `option<T>` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | `result<T, E>` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `tuple<T, U>` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Generated WIT record` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | `Generated WIT type alias` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | `Generated WIT variant` (input, result, field) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result, field); Not audited (callback input, callback result) | This type is not exposed by the packaged executable adapter. Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | This type is not exposed by the packaged executable adapter. Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve order and elements without exposing list constructors; choose and test a lossless IR lowering. |
| `Char` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Dependent parameters and results` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
| `Polymorphic exports` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | This type is not exposed by the packaged executable adapter. Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |
| `Implicit arguments {α}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |
| `Instance arguments [C α]` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specialize or supply the selected dictionary without changing runtime behavior. |
| `Prop / theorem / proof arguments` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Record theorem identity and assumptions. Erasure does not remove the need to check a runtime refinement. |
| `Optional parameter with default` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Apply only the declared default; distinguish omitted input from a supplied Option.none. |
| `Explicit nullable host value` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Select an explicit host projection; null does not stand for every missing, erased or unsupported value. |
| `IO α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Executing IO is not automatically asynchronous. Preserve effect order and exceptions. |
| `EIO ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve typed failures separately from transport validation and unexpected traps. |
| `Declared failure contract` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Project every declared error and payload; preserve trap or poisoned-runtime handling separately. |
| `Task α / asynchronous result` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | This type is not exposed by the packaged executable adapter. Required: Keep completion, rejection, cancellation and runtime lifetime distinct; do not block a browser event loop. |
| `Declared host object` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate typed members and preserve receiver identity, dynamic-access policy and lifetime. |
| `Lean function returned to the host` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | This type is not exposed by the packaged executable adapter. Required: Preserve captured state, call signature, errors and deterministic disposal. |
| `Cancellation protocol` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specify acknowledgement and late completion; release pending work exactly once. |
| `Synchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | This type is not exposed by the packaged executable adapter. Required: Preserve values, end-of-sequence, failure, early return and cleanup. |
| `Asynchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | This type is not exposed by the packaged executable adapter. Required: Preserve backpressure, pending-pull cancellation and terminal cleanup. |

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

Follow [the WIT / WASI build-and-publish guide](../publish/wit-wasi.md) for source inputs and package preparation. For an existing library, start with [Adapt an existing library](../lean/existing-package.md).

### Acceptance checks

Repository checks live in [Contributing](../contributing/testing.md#consumer-acceptance).

### Publish this package

Continue in the [build-and-publish workflow](../publish/wit-wasi.md).
