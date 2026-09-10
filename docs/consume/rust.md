# Use a Lean package from Rust

The Alpha crate exposes Rust values, resource types with `Drop`, and fallible calls returning `Result`. Its packaged native libraries execute the compiled Lean component.

## Use a prepared release

### Requirements and package

Use Cargo, a Rust compiler supporting edition 2021, and tar on Linux x86-64 with glibc 2.38 or newer. The [support contract](../consumer-support.v1.json) records the tested profile.

Request `lean_bridge_alpha-0.0.0.crate` and the authentication files in [Receive a package](receive-package.md). Authenticate the archive before extracting it.

### Create the project

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

### Call Lean

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

### Type conversions

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

This Alpha release exposes no `Nat`, `Int`, floating-point, optional, or asynchronous operations. The current Rust generator rejects arbitrary-precision `Nat` and `Int` rather than narrowing them to machine integers.

### Types, errors, and cleanup

Alpha uses `u32` for its unsigned 32-bit values. `Payload` owns its `String`, `Vec<u8>`, and `Vec<u32>` fields. `round_trip` toggles the boolean, increments the count, and preserves the other fields.

Calls return `Result<T, lean_bridge_alpha::Error>`; the example's `?` propagates failures from `main`. Host callbacks return `Result<u32, Error>` too. Alpha adds two to their result, so the callback example returns 44.

`Box` and the returned `Transform` own Lean resource leases. `Drop` releases them on normal scope exit and unwinding. Explicit `drop` releases them early. `identity()` returns a borrow of the same `Box`; Rust prevents the owner from being dropped while that borrow remains in use. Invoke a returned Lean closure with `.call(value)`.

### Deploy and troubleshoot

The current crate locates its shared libraries using its build-time `CARGO_MANIFEST_DIR`. Keep `vendor/lean_bridge_alpha-0.0.0` at that absolute location when running the executable. Copying only `target/release/lean-alpha-docs` to another machine does not produce a self-contained deployment.

- If Cargo cannot find the dependency, check the extracted directory name against `Cargo.toml`.
- If native loading fails, retain the crate's packaged libraries and the vendor directory at its build-time location.
- If the loader reports a missing glibc version, run on Linux x86-64 with glibc 2.38 or newer.

## Start from a raw Lean package

For Alpha, [build the native bundle and Cargo projection](../contributing/testing.md#build-the-example-artifacts-as-a-maintainer) to produce `lean_bridge_alpha-0.0.0.crate`. Extract that completed archive and use the [prepared release steps](#use-a-prepared-release) above.

For another Lean library, check the [source workflow and supported targets](../consume.md#start-from-a-raw-lean-package). These Alpha builds use the repository's target-specific inputs.

### Package authors and acceptance

Contributors can [build the Alpha examples](../contributing/testing.md#build-the-example-artifacts-as-a-maintainer) and run the [installed consumer checks](../contributing/testing.md#consumer-acceptance). See [native consumer evidence](../evidence/native-consumer-acceptance.md).

### Publish this package

See [Publish Rust crates](../publish/cargo.md) for package preparation, distribution, and verification after upload.
