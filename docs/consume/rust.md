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

Ordinary packages support pure functions over 19 primitive types, arrays, Lists, copied records, tagged variants, options, results, nested binary products and finite recursive values. Fixed-width integers use Rust's matching integer types, and Lean `Char` uses Rust `char`. Native Lean `USize` and `ISize` use `u64` and `i64`, matching the compiled core rather than Rust's pointer-sized types. `Nat` uses `BigUint`, and `Int` uses `BigInt`, both re-exported from `num-bigint`. Strings, slices, records, compounds and big integers are borrowed as inputs. Results own their `String`, `Vec` and generated struct values. Calls return `Result<T, Error>`; propagate bridge failures with `?`.

Rust conversion and native copying each use a 16 MiB accounting budget. Non-recursive adapters count at least eight bytes per Array or List element. Recursive adapters also limit depth and visited nodes, as described below. These budgets do not bound every Rust allocation or Lean working memory. Native results and temporary buffers are released on errors and Rust unwinding. Process abort cannot run destructors.

Compiled libraries are embedded in your executable. The first call verifies their hashes and loads them through a private temporary directory; compatible crates share one runtime. You can move the executable without retaining the Cargo source tree. Each crate embeds its assets, so multi-crate executable size can grow even when loading is shared. Loading needs Linux `/proc` and writable `/tmp` that permits shared-library loading, not a `noexec` mount. Temporary library files are removed after loading, and a small process registry is removed at normal exit. The libraries stay loaded until process exit. Calls from multiple threads are supported; reuse after `fork` and composition with foreign runtime loaders are rejected. See the [installed-crate evidence](../evidence/native-rust-20260915.md).

### Arrays and records

Lean `Array T` inputs borrow `&[T]`; results and record fields use owned `Vec<T>`
values. Arrays can contain every primitive, nested arrays and copied records.
Lean records become named structs with typed fields and derived `Clone`, `Debug`
and `PartialEq`. Empty and single-field records retain their own types.

For the `collections-api` acceptance package, use its prepared crate as the
Cargo dependency and save this as `src/main.rs`:

```rust
use collections_api::{array_reverse_uint32, record_make, Error, Pair};

fn main() -> Result<(), Error> {
    let input = vec![vec![1, 2, 3], vec![]];
    let mut output = array_reverse_uint32(&input)?;
    assert_eq!(output, vec![vec![], vec![3, 2, 1]]);
    output[1][0] = 99;
    assert_eq!(input[0], vec![1, 2, 3]);

    let pair = record_make()?;
    assert_eq!(pair, Pair { first: 42, second: "\u{feff}🌱\0".into() });
    println!("{:?}", input[0]); // [1, 2, 3]
    println!("{}", pair.first); // 42
    Ok(())
}
```

Returned vectors and their nested contents own independent storage. Structs and
vectors compare contents using Rust equality, including its floating-point rules:
NaN is unequal to itself; positive and negative zero compare equal. Copies
retain the separate 32-level type bound and 16 MiB accounting budgets. Rust drops
temporary owners when conversion returns an error or unwinds after a panic.
The [installed collection checks](../evidence/rust-collections-20260922.md)
cover both source paths, all nineteen primitives, seven record types, 24 nested
array levels, compiler rejection cases and allocation/panic cleanup.

### Options, results and products

Lean `Option T` uses Rust `Option<T>`, `Except E T` uses `Result<T, E>`, and `A × B` uses `(A, B)`. Products keep their binary nesting. Inputs borrow these containers; returned values own their payloads, including nested arrays, Lists and record fields.

For the `compounds-api` acceptance package, use its prepared crate in your Cargo dependency and save this as `src/main.rs`:

```rust
use compounds_api::{classify, flip, tuple_uint32, Error};

fn main() -> Result<(), Error> {
    assert_eq!(classify(&None)?, 0);
    assert_eq!(classify(&Some(None))?, 1);
    assert_eq!(classify(&Some(Some(())))?, 2);
    assert_eq!(tuple_uint32(&(1, 2))?, (2, 1));

    // The outer Result reports bridge failures. The inner one is Lean's value.
    let domain_result = flip(&Ok((42, Some(()))))?;
    assert_eq!(domain_result, Err((42, Some(()))));
    Ok(())
}
```

Run `cargo run --release`. `None`, `Some(())` and `Some(None)` retain their declared option structure. `Ok` and `Err` stay distinct even when their payload types match. A function returning Lean `Except E T` has Rust return type `Result<Result<T, E>, Error>`: one `?` handles loading or conversion failure and leaves the domain result for your application.

Rust rejects wrong payload types, tuple arities and missing borrows at compile time. The existing 16 MiB conversion budgets also cover compounds; type nesting stops at 32 levels. [Installed compound checks](../evidence/rust-compounds-20260920.md) cover both source paths, compiler rejections, allocation failures, panic cleanup and source-free executables. Acyclic compounds can also be [callback and closure payloads](#structured-callback-values). Copied values cannot contain resource identities.

### Lists

Lean `List T` inputs borrow Rust slices, `&[T]`. Results and record fields use
owned `Vec<T>` values. Lists preserve empty values, order, duplicates and nesting
with arrays, options, results, binary products and copied records. List and Array
remain distinct contract types even though both use Rust slices and vectors.

For the `lists-api` acceptance package, use its prepared crate as your dependency
and save this as `src/main.rs`:

```rust
use lists_api::{mix, reverse_uint32, Error};

fn main() -> Result<(), Error> {
    assert_eq!(reverse_uint32(&[1, 2, 2, 3])?, vec![3, 2, 2, 1]);
    assert!(reverse_uint32(&[])?.is_empty());
    assert_eq!(mix(&[vec![1, 2], vec![], vec![3]])?,
               vec![vec![3], vec![], vec![2, 1]]);
    Ok(())
}
```

Run `cargo run --release`. The compiler rejects wrong element types or nesting.
The generated adapter checks copy budgets and releases native results on errors
and unwinding. [Installed List checks](../evidence/rust-lists-20260920.md) cover
both source paths, including executables moved away from their crate sources.
List callback payloads use owned vectors, as shown under [structured callback values](#structured-callback-values).

### Named aliases

Concrete copied Lean aliases become public Rust `type` declarations. `Count`
can name a `u32`, `ANat` a `BigUint`, and `Rows` a `Vec<Vec<Count>>`. Alias chains
and record fields retain their names. Rust aliases share their target's type;
they do not introduce a newtype, constructor or runtime wrapper.

For the `aliases-api` acceptance package, use its prepared crate as your
dependency and save this as `src/main.rs`:

```rust
use aliases_api::{echo_maybe, increment, make, reverse_rows, Count, Error, Maybe, OtherCount, Rows};

fn main() -> Result<(), Error> {
    let count: Count = make()?;
    let next: OtherCount = increment(count)?;
    assert_eq!(next, 42);

    let rows: Rows = vec![vec![1, 2, 3], vec![]];
    assert_eq!(reverse_rows(&rows)?, vec![vec![3, 2, 1], vec![]]);
    let present: Maybe = Some(Some(()));
    assert_eq!(echo_maybe(&present)?, present);
    Ok(())
}
```

Run `cargo run --release`. String aliases still accept `&str`; byte, Array and
List aliases accept slices. Other aggregate inputs borrow their named type.
Results own independent copies. An alias of `Nat` uses `BigUint`, so Rust rejects
negative integers before the call. The [installed alias checks](../evidence/rust-aliases-20260921.md)
cover both source paths, compile-time rejections, cleanup after errors and
panics, and executables moved away from their crate sources.

### Tagged variants

Concrete copied Lean inductives become Rust enums. Empty constructors are unit
variants; constructors with payloads have named fields. Inputs borrow the enum,
and results own independent copies. Rust checks constructor names, payload types
and exhaustive matches before your program runs.

For the `variants-api` acceptance package, use its prepared crate as your
dependency and save this as `src/main.rs`:

```rust
use variants_api::{echo, next, Error, Signal};

fn main() -> Result<(), Error> {
    let value = Signal::Data { count: 42, label: "ready".into() };
    assert_eq!(echo(&value)?, value);
    assert_eq!(next(&Signal::Idle)?, Signal::Stopped);

    match next(&value)? {
        Signal::Idle => println!("Idle"),
        Signal::Stopped => println!("Stopped"),
        Signal::Data { count, label } => println!("{count}: {label}"),
        Signal::Marker { value: () } => println!("Marker"),
    }
    Ok(())
}
```

Run `cargo run --release`. Payloads can contain the nineteen supported primitives,
copied records, arrays, Lists, options, results, products and other admitted
variants. Only the active payload is converted. Empty constructors and a
constructor carrying `Unit` remain distinct. Constructor names use PascalCase;
fields use snake_case, with reserved words gaining a trailing underscore.

The existing 32-level type bound and separate Rust/native 16 MiB conversion
budgets apply. Conversion failures and unwinding release temporary buffers and
native outputs. See the [installed variant checks](../evidence/rust-variants-20260921.md).
Recursive packages use the bounded graph adapter described below. Acyclic
variants can be callback and closure payloads. Their copied fields cannot contain
callback identities or resources.

### Recursive values

Finite recursive Lean values become owned Rust structs and enums. Recursive
fields use `Box<T>` where needed; arrays and Lists use `Vec<T>`. A recursive
optional child can use `Option<Box<T>>`. Concrete aliases keep their public
names. Inputs are borrowed, and returned values own independent copies.

For the `recursive-api` acceptance package, add its prepared crate as your
Cargo dependency and save this as `src/main.rs`:

```rust
use recursive_api::{grow, spine, Error, Spine};

fn main() -> Result<(), Error> {
    let leaf = Spine::Leaf { value: 7 };
    let nested = Spine::Next { value: Box::new(leaf.clone()) };
    assert_eq!(spine(&nested)?, nested);
    assert_eq!(grow(&leaf)?, nested);
    Ok(())
}
```

Run `cargo run --release`. No constructor numbers, native declarations or manual
runtime initialization are needed. Rust drops returned values normally.

Each call permits depth 128 and 262,144 visited nodes. Inputs and the result
share a 16 MiB native-copy budget and a separate 16 MiB accounted Rust storage
budget. Over-limit values return `Error::Limit`. Recoverable conversion
allocation failures return `Error::Allocation`; aborting allocations cannot be
recovered. Malformed native output returns `Error::InvalidNative` and retires
the shared runtime. Previously returned Rust values remain usable and droppable.
Callbacks, closures and resources cannot be carried inside recursive copies.

The [installed recursive checks](../evidence/rust-recursive-packages-20260923.md)
cover ordinary source and independently reviewed contracts, offline Cargo
installation, compiler-negative callers, allocation/unwind cleanup and execution
after removing the author and installed source trees.

### Callbacks and returned Lean closures

Ordinary-source and reviewed-IR Cargo packages support synchronous callbacks and returned closures over all 19 primitives. Pass a Rust closure or function that returns `Result<T, Error>`. Callback arguments are owned Rust values, including `String`, `Vec<u8>`, `BigUint` and `BigInt`. The callback may borrow local state; Lean borrows the callback only for that call.

For the `callables-api` acceptance package, save this as `src/main.rs` and use its prepared crate in your Cargo dependency:

```rust
use callables_api::{call_uint32, make_string, Error};

fn main() -> Result<(), Error> {
    let mut seen = Vec::new();
    assert_eq!(call_uint32(40, |value| {
        seen.push(value);
        Ok(value + 2)
    })?, 42);
    assert_eq!(seen, vec![40]);

    let choose = make_string("captured λ")?;
    assert_eq!(choose.call(true, "other")?, "captured λ");
    assert_eq!(choose.call(false, "other")?, "other");
    choose.close()?;
    assert!(choose.is_closed());
    Ok(())
}
```

A returned `LeanClosure<fn(...) -> T>` provides typed `.call(...)`, idempotent `.close()` and `.is_closed()`. `Drop` releases the closure automatically. It is neither `Send`, `Sync` nor `Clone`; Rust rejects moving it between threads, sharing it across threads or copying its ownership. Independent threads may each create and use their own closures.

A callback can call another Lean export or an owned closure on the same thread. Its first `Err` stops further callback execution and returns the original error. With unwinding enabled, a panic is caught inside the callback, then resumed on the Rust side after the native call returns. `panic=abort`, out-of-memory aborts and a panic hook that terminates the process cannot be recovered. Rust's normal panic-hook and destructor behavior still applies. Conversion limits cover all callbacks in one call, including retained result buffers. A callback that Lean stores beyond the call becomes invalid; later invocation returns an error instead of accessing expired Rust state.

The [Rust callable acceptance record](../evidence/rust-callables-20260919.md) covers both package paths, compile-time rejections, error and panic cleanup, exhausted closure registries, nested calls and source-free execution. Recursive callback values use the graph adapter described below. Resource-containing aggregates and asynchronous callbacks remain separate work.

### Structured callback values

Callbacks and returned closures also accept acyclic arrays, Lists, options,
results, products, records, variants and aliases. Callbacks receive owned values
and return `Result<T, Error>`; returned closures borrow their call inputs and
return independent copies.

For the `structured-api` acceptance package, add its prepared crate as your
Cargo dependency and save this as `src/main.rs`:

```rust
use structured_api::{call_array, call_option, call_result, make_array, Error};

fn main() -> Result<(), Error> {
    let rows = vec![Some("first".into()), None, Some("last".into())];
    let reversed = call_array(&rows, |mut values| {
        values.reverse();
        Ok(values)
    })?;
    assert_eq!(reversed, vec![Some("last".into()), None, Some("first".into())]);
    assert_eq!(call_option(&Some(None), Ok)?, Some(None));
    assert_eq!(call_option(&Some(Some(())), Ok)?, Some(Some(())));

    // Ok delivers a Lean Except value; the inner Err is a domain error.
    assert_eq!(call_result(&Ok(Some(42)), |_| Ok(Err(vec!["missing".into()])))?,
               Err(vec!["missing".into()]));

    let choose = make_array(&rows)?;
    assert_eq!(choose.call(true, &[])?, rows);
    assert!(choose.call(false, &[])?.is_empty());
    Ok(())
}
```

Run `cargo run --release`. Nested text and byte buffers stay owned until Lean
finishes copying a callback result. The 32-level type bound and separate 16 MiB
Rust/native conversion budgets still apply. A callback failure or unwinding
panic releases temporary storage before returning to Rust. Copied fields cannot
hide callbacks or resources. Recursive callable values use the graph limits below.

The [installed structured callable checks](../evidence/rust-structured-callables-20260924.md)
cover both package paths, nested ownership, errors and panics, compiler
rejections and execution after removing all source trees.

### Recursive callback values

Callbacks can receive and return finite recursive values. They own each argument
and return `Result<T, Error>`; an owned Lean closure borrows its call inputs and
returns an independent copy. Use the generated enums and structs directly.

For the recursive `structured-api` acceptance package, add its prepared crate
as your Cargo dependency and save this as `src/main.rs`:

```rust
use structured_api::{call_recursive, make_recursive, BigUint, Error, Tree};

fn main() -> Result<(), Error> {
    let leaf = Tree::Leaf { value: BigUint::from(7u8) };
    let tree = Tree::Branch { children: vec![leaf] };
    let wrapped = call_recursive(&tree, |value| {
        Ok(Tree::Branch { children: vec![value] })
    })?;
    assert_eq!(wrapped, Tree::Branch { children: vec![tree.clone()] });

    let empty = Tree::Branch { children: vec![] };
    let choose = make_recursive(&tree)?;
    assert_eq!(choose.call(true, &empty)?, tree);
    assert_eq!(choose.call(false, &empty)?, empty);
    choose.close()?;
    assert!(matches!(choose.call(true, &empty), Err(Error::Closed)));
    Ok(())
}
```

Run `cargo run --release`. Recursive callbacks and closures share the value
limits of 128 levels and 262,144 visited nodes. Each native call has a 16 MiB
copy budget across its inputs, callbacks and result, plus a separate 16 MiB
Rust conversion-storage budget. Same-thread reentry permits at most 64 active
native calls. Owned closures share the runtime's 4,096-identity capacity.

Returned closures are neither `Send`, `Sync` nor `Clone`. Use `close()` or `Drop`
to release captures. Closing during a reentrant invocation defers disposal until
the active call finishes. A host callback expires when its exporting call returns.
Errors and unwinding panics reach the original Rust caller after native cleanup;
recoverable failures leave the runtime usable. Malformed native output retires
the runtime. Copied fields cannot contain resources or callable identities.

The [recursive callable acceptance record](../evidence/rust-recursive-callables-20260925.md)
covers both authoring paths, offline installation, recursive equality, closure
capacity, compile-time misuse, allocation failures, panic cleanup and execution
after deleting the author and installed source trees.

### Alpha resource and callback example

The remaining example uses the separate Alpha fixture. Its resource identities are not part of the ordinary Rust source path. Alpha also uses an older loader that needs its installed native files to remain in place.

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
| `Unit` | `()` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Unit uses () in every position. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `bool` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Rust bool accepts no numeric coercion. Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `u8` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Rust fixed-width integer types preserve exact values in direct calls and callable values. Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `u16` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Rust fixed-width integer types preserve exact values in direct calls and callable values. Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `u32` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Rust fixed-width integer types preserve exact values in direct calls and callable values. Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `u64` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Rust fixed-width integer types preserve exact values in direct calls and callable values. Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `i8` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Rust fixed-width integer types preserve exact values in direct calls and callable values. Required: -128..127; reject overflow before narrowing. |
| `Int16` | `i16` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Rust fixed-width integer types preserve exact values in direct calls and callable values. Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `i32` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Rust fixed-width integer types preserve exact values in direct calls and callable values. Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `i64` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Rust fixed-width integer types preserve exact values in direct calls and callable values. Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `&BigUint` (input); `BigUint` (result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact num-bigint BigUint magnitude, borrowed input and owned output. Callback arguments and results use owned `BigUint` values. Returned closures borrow aggregate inputs and return owned values. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `&BigInt` (input); `BigInt` (result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact num-bigint BigInt sign and magnitude, borrowed input and owned output. Callback arguments and results use owned `BigInt` values. Returned closures borrow aggregate inputs and return owned values. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `f32` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Rust f32 preserves NaN classification, infinities and signed zero; NaN payload identity is not claimed. Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `f64` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Rust f64 preserves NaN classification, infinities and signed zero; NaN payload identity is not claimed. Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `&str` (input); `String` (result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Borrowed UTF-8 str input and owned String output preserve embedded NUL. Callback arguments and results use owned `String` values. Returned closures borrow aggregate inputs and return owned values. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `&[u8]` (input); `Vec<u8>` (result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Borrowed byte slice input and owned `Vec<u8>` output. Callback arguments and results use owned `Vec<u8>` values. Returned closures borrow aggregate inputs and return owned values. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `&[T]` (input); `Vec<T>` (result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Borrowed slices become scoped native arrays; returned nested Vec values own independent copies. Owned containers and generated value types preserve nested presence, constructor identity and independent storage. Complete callback results retain nested string and byte owners through native copying. Errors and unwinding return after native cleanup; Drop releases partial values and closures. Expired callback borrows, post-fork use and over-budget values reject. Borrowed `&[T]` inputs and owned `Vec<T>` outputs preserve all nineteen primitives, element order, empty containers, nested arrays and records. Rust rejects wrong element types and borrowed-result assumptions at compile time. Returned storage is independent; invalid native buffers and copy-budget failures return checked errors. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `&Option<T>` (input); `Option<T>` (result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Standard Rust Option preserves None, Some(None) and Some(Some(())). Inputs borrow the container; results and fields own their copied payloads. Owned containers and generated value types preserve nested presence, constructor identity and independent storage. Complete callback results retain nested string and byte owners through native copying. Errors and unwinding return after native cleanup; Drop releases partial values and closures. Expired callback borrows, post-fork use and over-budget values reject. Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | `&Result<T, E>` (input); `Result<T, E>` (result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | The inner `Result<T, E>` carries Lean Except. The function returns `Result<Result<T, E>, Error>` to distinguish bridge failures. One `?` propagates only the bridge error. Owned containers and generated value types preserve nested presence, constructor identity and independent storage. Complete callback results retain nested string and byte owners through native copying. Errors and unwinding return after native cleanup; Drop releases partial values and closures. Expired callback borrows, post-fork use and over-budget values reject. Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `&(A, B) (nested binary products)` (input); `(A, B) (nested binary products)` (result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly two statically typed elements, preserving binary nesting. Inputs borrow the tuple; returned tuples own their payloads. Owned containers and generated value types preserve nested presence, constructor identity and independent storage. Complete callback results retain nested string and byte owners through native copying. Errors and unwinding return after native cleanup; Drop releases partial values and closures. Expired callback borrows, post-fork use and over-budget values reject. Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `&Generated struct` (input); `Generated struct` (result, field); `generated owned struct` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Named typed structs use borrowed inputs and owned outputs, including empty and scalar-represented records. Owned containers and generated value types preserve nested presence, constructor identity and independent storage. Complete callback results retain nested string and byte owners through native copying. Errors and unwinding return after native cleanup; Drop releases partial values and closures. Expired callback borrows, post-fork use and over-budget values reject. Generated nominal structs preserve declared typed public fields, empty and one-field records, changed field order and nested values. Clone and PartialEq operate through nested owned vectors. Wrong record types and missing or unknown fields fail compilation. Consumers need no unsafe code or private transport types. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | `Source-named pub type of the ordinary Rust target value` (input, result, field); `Source-named pub type for the owned Rust target type` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Public type declarations, signatures and fields preserve alias names without newtype wrappers. Strings and sequences retain str and slice borrows; other aggregates borrow their alias. Results own independent copies. Alias targets retain exact widths, BigUint/BigInt and 16 MiB copy budgets. Owned containers and generated value types preserve nested presence, constructor identity and independent storage. Complete callback results retain nested string and byte owners through native copying. Errors and unwinding return after native cleanup; Drop releases partial values and closures. Expired callback borrows, post-fork use and over-budget values reject. Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | `named Rust enum with owned payloads (borrowed input)` (input, result, field); `generated owned enum` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Construct and exhaustively match named enum cases without numeric tags or unsafe code. Empty cases and Unit payloads stay distinct. Inputs borrow values; outputs own independent copies. Only the active payload is converted. Invalid native tags reject before reading union storage. Scoped Rust ownership and native output guards release partial conversions on errors and unwinding. Owned containers and generated value types preserve nested presence, constructor identity and independent storage. Complete callback results retain nested string and byte owners through native copying. Errors and unwinding return after native cleanup; Drop releases partial values and closures. Expired callback borrows, post-fork use and over-budget values reject. Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `Box / generated owned wrapper` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `FnMut(owned primitives) -> Result<T, Error>` (input) | Ordinary source: Installed checks passed (input); Not audited (result, field, callback input, callback result). Reviewed IR: Installed checks passed (input); Not audited (result, field, callback input, callback result) | Call-scoped borrow; typed owned callback arguments; original errors and unwinding panic payloads return after native cleanup. Same-thread nested calls are supported. Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | `&[T]` (input); `Vec<T>` (result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Inputs borrow typed slices; outputs and record fields use owned `Vec<T>` values. Preserve order, duplicates and nesting; copies remain independent. Types reject invalid elements and shapes; runtime budgets reject oversized copies. RAII releases native output and scratch after errors or unwinding, but not process abort. Owned containers and generated value types preserve nested presence, constructor identity and independent storage. Complete callback results retain nested string and byte owners through native copying. Errors and unwinding return after native cleanup; Drop releases partial values and closures. Expired callback borrows, post-fork use and over-budget values reject. Required: Preserve order, duplicates and nesting with a distinct list constructor. Validate all elements and copying limits; never expose Lean cons cells. |
| `Char` | `char` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly one Unicode scalar, 0..0x10FFFF excluding surrogates. NUL, supplementary characters, combining scalars, noncharacters and line endings are preserved without normalization. Multi-scalar grapheme clusters require String. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | `u64` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, 0..18446744073709551615. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | `i64` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, -9223372036854775808..9223372036854775807. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Dependent parameters and results` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | `Owned named structs and enums, Box children, Vec/Option/Result/tuples and transparent aliases` (input, result, field); `Owned generated enums, structs, Vec and Box fields with named aliases; FnMut callbacks returning Result and thread-confined LeanClosure results` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Borrow aggregates, text and slices; pass fixed-width scalars by value. Results own independent Rust values. Box breaks recursive or oversized fields; Vec supplies sequence indirection. RAII clears native outputs and temporaries on errors or unwinding. Malformed native output retires the shared runtime; earlier owned Rust results remain usable. Recursive values and aliases retain their public types and independent owned storage. Conversion scopes keep callback replies alive until native copying finishes. Original callback errors and panic payloads return after cleanup; malformed native output retires the runtime. Closure identities release on close or Drop, with deferred release during an active invocation. Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
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
| `Lean function returned to the host` | `LeanClosure<fn(...) -> T> with call, close and Drop` (result) | Ordinary source: Not audited (input, field, callback input, callback result); Installed checks passed (result). Reviewed IR: Not audited (input, field, callback input, callback result); Installed checks passed (result) | Typed calls, automatic Drop and idempotent close. Creator-thread confined; neither Send, Sync nor Clone. Native identity and stale-borrow checks remain enforced. Required: Preserve captured state, call signature, errors and deterministic disposal. |
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

The Alpha resource projection rejects `Nat` and `Int`; ordinary packages use `BigUint` and `BigInt`.

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
