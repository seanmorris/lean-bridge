# Use a Lean package from Rust

Add the publisher's crate to your Cargo project and call its generated functions. The crate supplies typed Rust values, compiled Lean libraries and automatic runtime loading. You do not need Lean, handwritten FFI or runtime paths.

## Use a prepared release

### Ordinary project packages

Use Rust 1.90 or newer on Linux x86-64 with glibc 2.38 or newer. This example uses the Cedar acceptance package. Substitute your publisher's crate name and version, and authenticate the archive using [Use a prepared release](receive-package.md) before extraction:

```sh
mkdir -p src vendor
tar -xzf ./cedar-api-2.0.0-rc.1.crate -C vendor
```

Save this as `Cargo.toml`:

```toml file=rust/ordinary/Cargo.toml
[package]
name = "lean-copied-docs"
version = "0.0.0"
edition = "2021"

[dependencies]
cedar-api = { path = "vendor/cedar-api-2.0.0-rc.1" }
```

Save this as `src/main.rs`:

```rust file=rust/ordinary/src/main.rs
use cedar_api::{array_u32, echo_nat, echo_text, echo_u32, BigUint};

fn main() -> Result<(), cedar_api::Error> {
    assert_eq!(echo_u32(42)?, 42);
    let large = (BigUint::from(1u8) << 4096usize) + BigUint::from(1u8);
    assert_eq!(echo_nat(&large)?, large);
    assert_eq!(echo_text("Lean λ\0")?, "Lean λ\0");
    assert_eq!(array_u32(&[0, u32::MAX])?, vec![0, u32::MAX]);
    println!("42; exact integers and copied arrays");
    Ok(())
}
```

Run `cargo run --release`. Cargo resolves the crate's normal Rust dependencies, `num-bigint` and `sha2`; it does not compile Lean or a C extension. For an offline build, cache or vendor the dependencies first and use `--offline`. For a registry release, replace the path dependency with your publisher's exact version and registry settings. See [Cargo publication and installation](../publish/cargo.md#verify-the-published-crate-and-consumer).

Ordinary packages support pure functions over 17 primitive types, arrays and acyclic records. Fixed-width integers use Rust's matching integer types, and Lean `Char` uses Rust `char`. `Nat` uses `BigUint`, and `Int` uses `BigInt`, both re-exported from `num-bigint`. Strings, slices, records and big integers are borrowed as inputs. Results own their `String`, `Vec` and generated struct values. Calls return `Result<T, Error>`; propagate failures with `?`.

Rust conversion and native copying each use a 16 MiB accounting budget. Array conversion counts at least eight bytes per element. These budgets do not bound every Rust allocation or Lean working memory. Native results and temporary buffers are released on errors and Rust unwinding. Process abort cannot run destructors.

Compiled libraries are embedded in your executable. The first call verifies their hashes and loads them through a private temporary directory; compatible crates share one runtime. You can move the executable without retaining the Cargo source tree. Each crate embeds its assets, so multi-crate executable size can grow even when loading is shared. Loading needs Linux `/proc` and writable `/tmp` that permits shared-library loading, not a `noexec` mount. Temporary library files are removed after loading, and a small process registry is removed at normal exit. The libraries stay loaded until process exit. Calls from multiple threads are supported; reuse after `fork` and composition with foreign runtime loaders are rejected. See the [installed-crate evidence](../evidence/native-rust-20260915.md).

### Alpha resource and callback example

The remaining example uses the separate Alpha fixture. Its resources, callbacks and returned closures are not part of the ordinary Rust source path. Alpha also uses an older loader that needs its installed native files to remain in place.

### Requirements and package

Use Cargo, a Rust compiler supporting edition 2021, and tar on Linux x86-64 with glibc 2.38 or newer. The [support contract](../consumer-support.v1.json) records the tested profile.

Request `lean_bridge_alpha-0.0.0.crate` and the authentication files in [Use a prepared release](receive-package.md). Authenticate the archive before extracting it.

## Create the project

In an empty project directory, place the archive and run:

```sh
mkdir -p src vendor
tar -xzf ./lean_bridge_alpha-0.0.0.crate -C vendor
```

Save this file as `Cargo.toml`:

```toml file=rust/Cargo.toml
[package]
name = "lean-alpha-docs"
version = "0.0.0"
edition = "2021"

[dependencies]
lean_bridge_alpha = { path = "vendor/lean_bridge_alpha-0.0.0" }
```

The local path dependency installs the exact archive you authenticated. This recipe does not require a crates.io publication or network access during the build.

## Call Lean

Save this file as `src/main.rs`:

```rust file=rust/src/main.rs
use lean_bridge_alpha::{make_adder, round_trip, with_callback, Box, Payload};

fn main() -> Result<(), std::boxed::Box<dyn std::error::Error>> {
    let boxed = Box::new(42)?;
    assert_eq!(boxed.read()?, 42);
    assert!(std::ptr::eq(boxed.identity()?, &boxed));

    let value = round_trip(Payload {
        enabled: true,
        count: 41,
        label: "Lean λ".into(),
        bytes: vec![0, 255],
        values: vec![0, u32::MAX],
    })?;
    assert!(!value.enabled);
    assert_eq!(value.count, 42);
    assert_eq!(value.label, "Lean λ");
    assert_eq!(value.bytes, vec![0, 255]);
    assert_eq!(value.values, vec![0, u32::MAX]);
    assert_eq!(with_callback(40, |current| Ok(current + 2))?, 44);
    let add_two = make_adder(2)?;
    assert_eq!(add_two.call(40)?, 42);

    drop(add_two);
    drop(boxed);
    println!("Box: 42; payload: 42; callback: 44; closure: 42");
    Ok(())
}
```

Build and execute it:

```sh
cargo run --release --offline --quiet
```

Expected output:

```text
Box: 42; payload: 42; callback: 44; closure: 42
```

## Values and cleanup

### Type conversions

Profiles: Rust. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `()` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Unit uses () in every position. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `bool` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Rust bool accepts no numeric coercion. Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `u8` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `u16` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `u32` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `u64` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `i8` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Required: -128..127; reject overflow before narrowing. |
| `Int16` | `i16` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `i32` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `i64` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `&BigUint` (input); `BigUint` (result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generation rejected | Exact num-bigint BigUint magnitude, borrowed input and owned output. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `&BigInt` (input); `BigInt` (result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generation rejected | Exact num-bigint BigInt sign and magnitude, borrowed input and owned output. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `f32` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Rust f32 preserves NaN classification, infinities and signed zero; NaN payload identity is not claimed. Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `f64` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Rust f64 preserves NaN classification, infinities and signed zero; NaN payload identity is not claimed. Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `&str` (input); `String` (result, field, input, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Borrowed UTF-8 str input and owned String output preserve embedded NUL. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `&[u8]` (input); `Vec<u8>` (result, field, input, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Borrowed byte slice input and owned `Vec<u8>` output. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `&[T]` (input); `Vec<T>` (result, field, input, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Borrowed slices become scoped native arrays; returned nested Vec values own independent copies. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `Option<T>` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | `Result<T, E>` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | The inner Result<T, E> represents Except; an outer Result<..., Error> can report bridge failures. Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `(T, U, ...)` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `&Generated struct` (input); `Generated struct` (result, field); `Generated owned struct (Alpha: Payload)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Named typed structs use borrowed inputs and owned outputs, including empty and scalar-represented records. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | `Resolved target type` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | `Generated enum` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `Box / generated owned wrapper` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `FnMut with bridge Result` (input) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input); Not audited (result, field, callback input, callback result) | Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve order and elements without exposing list constructors; choose and test a lossless IR lowering. |
| `Char` | `char` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Exactly one Unicode scalar, 0..0x10FFFF excluding surrogates. NUL, supplementary characters, combining scalars, noncharacters and line endings are preserved without normalization. Multi-scalar grapheme clusters require String. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
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
| `Lean function returned to the host` | `Transform with call/close` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve captured state, call signature, errors and deterministic disposal. |
| `Cancellation protocol` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specify acknowledgement and late completion; release pending work exactly once. |
| `Synchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Preserve values, end-of-sequence, failure, early return and cleanup. |
| `Asynchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Preserve backpressure, pending-pull cancellation and terminal cleanup. |

### Alpha example API

These are the public types in the prepared Alpha crate. Fallible calls return `Result<T, lean_bridge_alpha::Error>`; use `?` to propagate a call failure.

| Lean type | Rust type | Conversion rules |
| --- | --- | --- |
| `Bool` | `bool` | Native Boolean value. |
| `UInt32` | `u32` | Full unsigned 32-bit range. Use checked conversion such as `u32::try_from` for wider application integers. |
| `String` | `String` | Owned UTF-8 text. |
| `ByteArray` | `Vec<u8>` | Owned byte buffer copied across the native boundary. |
| `Array UInt32` | `Vec<u32>` | Owned vector; each element retains its unsigned 32-bit width. |
| `Payload` | `Payload` | Owned struct; `round_trip` takes it by value and returns a new value. |
| `Box` | `Box` | Resource released by `Drop`; `identity()` returns a borrowed `&Box` inside `Result`. |
| `UInt32 → UInt32` callback | `FnMut(u32) -> Result<u32, Error>` | Synchronous borrowed closure; return `Ok(value)` on success. |
| Returned Lean closure | `Transform` | Owned resource with `.call(value)` and `Drop`, not a Rust `Fn` implementation. |

The current Rust generator rejects arbitrary-precision `Nat` and `Int` rather than narrowing them to machine integers.

## Types, errors, and cleanup

Alpha uses `u32` for its unsigned 32-bit values. `Payload` owns its `String`, `Vec<u8>`, and `Vec<u32>` fields. `round_trip` toggles the boolean, increments the count, and preserves the other fields.

Calls return `Result<T, lean_bridge_alpha::Error>`; the example's `?` propagates failures from `main`. Host callbacks return `Result<u32, Error>` too. Alpha adds two to their result, so the callback example returns 44.

`Box` and the returned `Transform` own Lean resource leases. `Drop` releases them on normal scope exit and unwinding. Explicit `drop` releases them early. `identity()` returns a borrow of the same `Box`; Rust prevents the owner from being dropped while that borrow remains in use. Invoke a returned Lean closure with `.call(value)`.

### Deploy and troubleshoot

The current crate locates its shared libraries using its build-time `CARGO_MANIFEST_DIR`. Keep `vendor/lean_bridge_alpha-0.0.0` at that absolute location when running the executable. Copying only `target/release/lean-alpha-docs` to another machine does not produce a self-contained deployment.

- If Cargo cannot find the dependency, check the extracted directory name against `Cargo.toml`.
- If native loading fails, retain the crate's packaged libraries and the vendor directory at its build-time location.
- If the loader reports a missing glibc version, run on Linux x86-64 with glibc 2.38 or newer.

## Start from a raw Lean package

Follow [the Rust build-and-publish guide](../publish/cargo.md) for source inputs and package preparation. For an existing library, start with [Adapt an existing library](../lean/existing-package.md).

### Package authors and acceptance

Repository checks live in [Contributing](../contributing/testing.md#consumer-acceptance).

### Publish this package

Continue in the [build-and-publish workflow](../publish/cargo.md).
