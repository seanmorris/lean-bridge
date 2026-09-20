# Build and publish WIT / WASI packages

Prepare WIT declarations, a Component Model adapter, a Wasmtime host, and native Lean libraries, then distribute the original archive through a release page or artifact server.

For ordinary-source builds, declare the library's [description, authors and URLs](../publishing.md#declare-package-metadata) once in `lean-bridge.exports.json`.

## Build an ordinary Lean project

The `wit-wasi` target accepts copied primitives, arrays, acyclic records, options, results and binary products, plus synchronous primitive callbacks and returned Lean functions. Consumers receive the compiled component, a generated Wasmtime embedding library, headers, shared native runtime, compiler evidence and dependency licenses. The target builds for Linux x86-64 with glibc 2.38 or newer.

Callable signatures support all nineteen primitives and one through sixteen arguments. Use an [arity decision](../lean/export-decisions.md) when an export returns a partially applied function. Host callbacks are call-borrowed; returned Lean functions have explicit leases. Arrays, records, options, results, products and nested callbacks inside callable signatures, retained host borrows and asynchronous results remain unsupported. The [consumer guide](../consume/wit-wasi.md#callbacks-and-returned-lean-functions) describes the owning session API and cleanup.

Use Lean 4.32.2, a native C compiler, wasm-tools 1.245.1 and the [Wasmtime 42.0.1 x86-64 Linux C API archive](https://github.com/bytecodealliance/wasmtime/releases/download/v42.0.1/wasmtime-v42.0.1-x86_64-linux-c-api.tar.xz). Its SHA-256 is `2097a47351918a446b26c7e65f487278f63bc947591b71897db547cd90c05082`. Extract it and set `LEAN_BRIDGE_WASMTIME_C_API` to that directory. The builder checks the library, headers and license against the pinned archive before compilation. Wasmtime is an author-side build dependency and is included in the consumer package.

For a Lake package named `cobalt`, select its exports in `lean-bridge.exports.json`:

```json
{
  "schemaVersion": 1,
  "modules": ["Cobalt"],
  "exports": ["Cobalt.echo_u32"],
  "targets": {
    "wit-wasi": { "name": "cobalt-api", "version": "2.0.0-rc.1" }
  }
}
```

Build into a new directory:

```sh
export LEAN_BRIDGE_WASMTIME_C_API=/absolute/path/to/wasmtime-c-api
lean-bridge build --project /absolute/path/to/cobalt \
  --target wit-wasi --output /absolute/path/to/cobalt-release
```

The archive is `archives/cobalt-api-2.0.0-rc.1-wit-wasi.tar.gz`. Its WIT world imports `lean-bridge:cobalt-api/native@2.0.0-rc.1` and exports `lean-bridge:cobalt-api/api@2.0.0-rc.1`. The supplied host implements the native import with compiled Lean code. The component is not a standalone WASI command.

Repeat `--target` to add C, C++, CPAN, NuGet, Maven, RubyGems or npm. Native targets reuse one Lean compilation; npm adds one Wasm compilation. No release directory appears unless every selected target succeeds. Unsupported signatures fail with the source declaration instead of being omitted.

Run `lean-bridge verify --receipt /absolute/path/to/cobalt-release/package-set-receipt.json`, then the [ordinary prepared-package example](../consume/wit-wasi.md#ordinary-project-packages) against the original archive. Distribute the receipt, its `.json.sha256` sidecar and the original `archives/` paths for [Node-only verification](../consume/receive-package.md#verify-a-local-package-set). The receipt checks unsigned local consistency, not publisher identity. The [acceptance evidence](../evidence/native-wit-20260914.md) records relocated builds, installed calls and cleanup checks.

## Check the build inputs

The separate Alpha example uses a reviewed universal bundle containing its compiled native component and target metadata plus the executable WASI adapter. The following bundle commands retain that example's `read-box` API. Use the ordinary-project workflow above for a new package.

## Build the target package

From a Lean Bridge checkout, [build the example bundle](../contributing/testing.md#build-the-example-artifacts-as-a-maintainer). With that bundle at `build/consumer-universal-bundle`, use a new output directory:

```sh
node scripts/build-wasi-package.mjs \
  --bundle build/consumer-universal-bundle --output build/publish-wit-wasi
```

The builder emits `lean-bridge-alpha-wasi-0.0.0.tar.gz`. The package identity and version come from the bundle; change them upstream before generating a public candidate. The tested native runtime is x86-64 Linux with glibc 2.38 or newer.

## Verify installation

Run the complete [WIT / WASI consumer example](../consume/wit-wasi.md) against the produced archive. It installs or links the generated public API without compiling Lean. Keep the platform requirements and verification result with the package.

## Distribute and recover

Use [archive distribution](archives.md#freeze-the-handoff) for checksum records, GitHub Releases, HTTPS hosting, download verification, and interrupted-upload recovery. A universal `wit-wasi` target retains an archive; it does not upload it. Your release owner chooses the destination and approves the exact bytes.

The archive supplies its documented host integration. It does not register a package with Conan, vcpkg, an OCI registry, or another unimplemented package manager. [Signed Nix caches](nix.md) provide an additional channel for declared flake outputs.
