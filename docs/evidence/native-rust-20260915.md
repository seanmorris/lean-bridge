# Ordinary-source Rust copied values

VO1216 adds ordinary Rust/Cargo packages from elaborated Lean projects. This milestone is based on `787bc203888d58a47c00c29561a5482bab68a7f7`; the type inventory binds the implementation and acceptance to source hashes.

## Acceptance

```sh
source scripts/env.sh
export LEAN_BRIDGE_RUSTC="$PWD/.toolchains/rust-1.90.0/bin/rustc"
export LEAN_BRIDGE_CARGO="$PWD/.toolchains/rust-1.90.0/bin/cargo"
LEAN_BRIDGE_NATIVE_RUST_TEST=1 \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
node --test --test-reporter=spec tests/native-rust.test.mjs
```

All four checks pass. They cover generation, admission, installed execution and atomic compiler failure. Admission rejects names that collide with Rust keywords, primitive types or private runtime helpers. The local profile uses Rust and Cargo 1.90.0, GCC 12 and glibc 2.36 on Linux x86-64. Lean 4.32.2 is pinned to commit `f3b06c705e6c85f5314019d5d3baab0fec5b580c`. The production native floor remains glibc 2.38. The explicit local floor override does not establish production-platform execution.

Cedar and Hazel each expose 42 functions and build from two relocated source trees. Each pair produces byte-identical Rust and C archives. Consumers extract the original crates, compile through Cargo offline, move their executables and hide the vendor directories. Execution has no Lean or C compiler paths. Cargo uses the dependency cache populated during author checks; ordinary Rust dependencies are not bundled in the crate.

Installed calls cover all sixteen primitive parameters, results, array elements and record fields. Cases include nested arrays, acyclic records, empty records and their arrays, scalar-represented records, multiple arguments and nullary functions. Hazel reverses the leaf record's field order and uses UInt64 where Cedar's single-field record uses UInt32.

Values include unsigned maxima, signed minima, 4,097-bit magnitudes, zero, Unicode with embedded NUL, arbitrary bytes, NaN classification, infinities and signed zero. Returned records and nested vectors remain independent after the input is changed. Compile-negative consumers reject numeric Boolean inputs, non-unit Unit inputs, overflowing literals, negative Nat and wrong record types.

Private test hooks visit every conversion checkpoint on a nested record call, injecting both fallible allocation errors and Rust panics. Every attempt releases scratch owners and invokes native output cleanup, including partially converted outputs. Returning 1,750,000 bytes fits the native budget but exceeds Rust's conversion budget; the call returns `Error::Limit`. Larger native results return `Error::Native`, and subsequent valid calls still work. Four threads execute repeated native calls.

Three fresh processes initialize Cedar and Hazel concurrently. Native snapshots report one runtime initialization, two component initializations and two attached components. The moved binaries work without their Cargo source trees. Post-fork calls are rejected. Temporary native directories and normal-exit registry files are absent after execution.

Modified embedded library bytes fail verification before loading. Modified compile-checked Rust sources fail package assembly. A missing Cargo executable leaves neither a release directory nor private build staging. The loader checks for a foreign Lean library as well as the native broker before resolving symbols; an installed consumer preloads the actual Lean library to exercise rejection. The documentation's ordinary Rust project executes against the installed Cedar crate. The separate Alpha Rust generator and Cargo archive checks remain green.

The combined Shop/Telemetry suite passes all seven checks. Shop builds and executes ten targets: npm, CPAN, C, C++, NuGet, Maven, RubyGems, WIT/WASI, PyPI and Cargo. It uses one native and one Wasm compilation per captured API, and relocated builds agree. This local test replaces only Nix transport and uses real compilers; actual Nix execution acceptance remains CI-owned. C/C++ primitive and copied-value regressions pass all seven checks with unchanged archive hashes.

| Artifact | SHA-256 |
| --- | --- |
| `cedar-api-2.0.0-rc.1.crate` | `e9fe4420be288cf4aba57776a059b8e5b64f8bf8fc5b533f77700c602c17d0b4` |
| `hazel-api-2.0.0-rc.1.crate` | `25e6025cb8de5e9753c0ade18bdcba76b00ed926564beec081a66daa844755ba` |

## Contract

Unit is `()`, Bool is `bool`, and fixed-width integers use their matching Rust types. Nat and Int use re-exported `num-bigint` `BigUint` and `BigInt`. Strings are UTF-8 `String` values, bytes are `Vec<u8>`, arrays are `Vec<T>`, and records are named structs. Aggregate inputs are borrowed; outputs own independent values. Calls return `Result<T, Error>`.

Types must be pure, acyclic and at most 32 levels deep. Rust conversions and native input/output copying each have a 16 MiB accounting budget. Arrays count at least eight bytes per element. The budget does not bound all Rust allocation overhead or Lean working memory. RAII releases native results on errors and unwinding, not process abort or an allocator failure that aborts the process.

Rust 1.90+ on Linux x86-64 GNU is required. The crate embeds its native libraries with `include_bytes!`; it verifies SHA-256 before loading. A per-process, owner-only registry is locked across independently generated crates. It binds runtime identity and library hashes, rejects conflicts and failed initialization, and reuses existing native handles. Extraction uses an owner-only directory with the library basenames required by the ELF loader. Files are unlinked after loading; the handles stay alive until process exit. Linux `/proc` and writable `/tmp` that permits shared-library loading are required; a `noexec` mount is not supported. Normal exit removes the registry; forced termination can leave the small registry directory behind. Its process-start identity prevents reuse by a later process with the same PID. Forked calls and foreign runtime loaders are rejected.

The build checks Rust against a pinned Cargo lock before compiler-free archive assembly. Package assembly rechecks the Rust sources, dependency lock, compiled inventories and embedded library hashes. Cargo compiles the generated Rust in a downstream project, not Lean or a C extension. `num-bigint` and `sha2` remain normal Cargo dependencies. Each crate embeds its native assets, so multi-crate executable size can grow even though runtime loading is shared. No registry upload was tested; publishers must check registry size limits for crates containing a full Lean runtime.

The inventory advances exactly 54 ordinary-source Rust cells: parameters, results and fields for sixteen primitives, arrays and copied records. Resources, callbacks, Option, variants, effects and reviewed-IR observations are not promoted. The shared corpus and generic package-set verification remain separate work.
