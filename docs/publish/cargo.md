# Build and publish Rust packages

Build an ordinary Lake project with `--target cargo` to produce a typed Rust crate with compiled native libraries. Consumers use Cargo without Lean or handwritten FFI. The separate Alpha recipe below exercises resource and callback APIs.

For ordinary-source builds, declare the library's [description, authors and URLs](../publishing.md#declare-package-metadata) once in `lean-bridge.exports.json`.

Lean Bridge creates a deterministic `.crate` for direct installation. Cargo's publishing command creates another archive from a source directory before uploading it. It has no option that uploads an existing `.crate` unchanged. A Cargo CLI publication therefore needs its own reviewed archive and verification record. [cargo publish](https://doc.rust-lang.org/cargo/commands/cargo-publish.html).

## Build an ordinary Lean project

Install the [C author toolchain](c.md#build-an-ordinary-lean-project), Rust 1.90 or newer, and Cargo. Set `LEAN_BRIDGE_RUSTC` and `LEAN_BRIDGE_CARGO` only if the tools are not on `PATH`. The production target is Linux x86-64 with glibc 2.38 or newer.

Configure the source exports and Cargo coordinates in the project's `lean-bridge.exports.json`:

```json
{
  "schemaVersion": 1,
  "modules": ["Cedar"],
  "exports": ["Cedar.echo_u32", "Cedar.echo_nat", "Cedar.echo_text", "Cedar.array_u32"],
  "targets": { "cargo": { "name": "cedar-api", "version": "2.0.0-rc.1" } }
}
```

Use your own modules, exports and package coordinate. Build into a new directory:

```sh
lean-bridge build --project ./cedar --target cargo --output ./release-cargo
```

The build compiles Lean and its C adapter, checks the generated Rust with a pinned dependency lock, then archives those files without further compiler access. `release-cargo/archives/cedar-api-2.0.0-rc.1.crate` contains Rust sources, native libraries, licenses, source identities and package receipts. Repeat `--target c`, `--target nuget` or another supported ordinary target to share the native compilation. Name and version come from the export configuration, not an archive rename.

The crate retains the library's and captured Lake dependencies' [source notices](../publishing.md#retain-library-and-dependency-licenses). Set [shared license terms](../publishing.md#declare-license-terms) in `package.license` to populate Cargo's `license` field. Without a declaration, the field remains unset; it never borrows Lean Bridge's MIT license.

This path supports pure copied primitives, nested arrays and Lists, acyclic records, tagged variants, options, results, binary products and synchronous primitive callbacks and returned closures. Rust receives typed `FnMut` callbacks returning `Result` and owned `LeanClosure` values with automatic `Drop` cleanup. All 19 primitives are tested on ordinary-source and reviewed-IR callable paths. Compound callables, resources and asynchronous operations remain separate work. The crate pins `num-bigint` and `sha2`; Cargo resolves them normally, so author checks need network access or a populated Cargo cache. The native libraries are embedded in downstream executables. See [ordinary Rust consumption](../consume/rust.md#ordinary-project-packages), [copied-value acceptance](../evidence/native-rust-20260915.md) and [callable acceptance](../evidence/rust-callables-20260919.md).

Authenticate and distribute the original archive through your controlled release channel. For a registry upload, follow the separate Cargo review below with your crate's coordinates. The preparation commands preserve the supplied lockfile and handle Alpha's optional `.cargo_vcs_info.json`. The unsigned native receipts are not universal transaction authorizations. Check the registry's package size limit before selecting this delivery method: the crate includes a full Lean runtime.

## Export options, results and products

Ordinary-source and reviewed-IR builds compile `Option`, `Except` and nested binary `Prod` values, including mixtures with all nineteen primitives, arrays, Lists and acyclic record fields. Consumers use Rust `Option<T>`, `Result<T, E>` and `(A, B)` without native declarations. Inputs borrow the container; results own their copied data. The function's outer `Result<_, Error>` reports bridge failures separately from a Lean `Except` value.

Use concrete signatures and select the exports in `lean-bridge.exports.json`. A [reviewed contract](../lean/existing-package.md#compile-a-reviewed-contract) receives the same fresh compiler checks. See the [consumer example](../consume/rust.md#options-results-and-products) and [installed crate evidence](../evidence/rust-compounds-20260920.md). Copied compounds cannot contain resources or callbacks; compound callable signatures require separate support.

## Export copied Lists

Export concrete `List` parameters, results and record fields through the shared
configuration. No Cargo-specific type annotation is needed. Rust inputs borrow
slices; outputs and record fields use owned vectors. Lists can nest with the
other supported copied types within the existing 32-level and 16 MiB limits.
They retain a distinct contract identity from Arrays. The generated adapter
handles native cleanup on conversion failure and panic unwinding.

See the [consumer example](../consume/rust.md#lists) and
[installed crate checks](../evidence/rust-lists-20260920.md). List payloads in
callbacks remain unsupported. Combined packages require every selected target
to accept the same API.

## Export named copied aliases

Use concrete `abbrev` declarations or type-valued `def` declarations in your
selected signatures. The compiler preserves their names and targets, and a
reviewed contract must match them. Cargo packages export `pub type` declarations
for supported copied primitives, containers and records, including alias chains.
Generated names cannot collide with Rust types, public exports or runtime
helpers. Alias inputs keep the target's borrowing rules; results own their data.

No Cargo-specific alias configuration is needed. See the
[consumer example](../consume/rust.md#named-aliases) and
[installed crate checks](../evidence/rust-aliases-20260921.md). Recursive targets,
compound callables and identity-bearing aggregates remain
separate work. All selected targets must accept an alias's complete type graph.

## Export copied tagged variants

Select functions over concrete, non-recursive Lean inductives in your ordinary
export configuration or independently reviewed contract. No numeric tag mapping
or Rust-specific variant configuration is needed. The compiler records the
constructors and payload types; generated Lean helpers construct and inspect
values without exposing compiler object layouts.

Cargo packages export named Rust enums with unit cases or named payload fields.
Generated constructor names use PascalCase and fields use snake_case. Reserved
words gain a trailing underscore; collisions fail before native compilation.
Inputs borrow their enum; returned values own independent copies. Use the
[consumer example](../consume/rust.md#tagged-variants) and
[installed acceptance record](../evidence/rust-variants-20260921.md).

Payloads may contain all nineteen primitives and supported copied containers,
records and other non-recursive variants. Generic, indexed, recursive,
proof-bearing, callable and identity-bearing payloads are not admitted by this
profile. Native multi-target variant builds currently admit C, C++, Python,
Rust, .NET, Java and Kotlin when every selected target accepts the complete API.
Other targets retain their own admission checks.

## Export callbacks and closures

Add concrete callable exports to your Lean module:

```lean
namespace Callables
def callUInt32 (value : UInt32) (callback : UInt32 → UInt32) := callback value
def makeString (captured : String) : Bool → String → String :=
  fun useCaptured value => if useCaptured then captured else value
end Callables
```

Select those exports in `lean-bridge.exports.json`, set `"arities": { "Callables.makeString": 1 }`, and choose your package's `targets.cargo.name` and `version`. The arity leaves the final two arguments in the returned closure. Build with `--target cargo`. The [consumer example](../consume/rust.md#callbacks-and-returned-lean-closures) uses these two functions.

For a [reviewed contract](../lean/existing-package.md#compile-a-reviewed-contract), the outer signature determines the arity; omit configuration `arities`. Primitive callbacks require repeated invocation, same-agent re-entry, deferred self-disposal, synchronous value delivery and the native callback failure policy. Host arguments borrow the call, while returned closures own explicit leases. Both source paths receive fresh Lean compiler checks before linking.

You can combine Cargo with other native targets when every selected target accepts the API and export configuration. All native profiles support primitive callables; compound values have a narrower target set. Consumers need no native declarations or Lean toolchain; Cargo compiles only Rust and links the packaged libraries.

## Package identity and publisher prerequisites

The Alpha fixture uses crate `lean_bridge_alpha@0.0.0` and Rust edition 2021. Its native libraries target Linux x86-64 with glibc 2.38 or newer. Build and run consumer checks on that platform.

Use the fixture coordinate only in a registry you control. For crates.io, establish ownership of the intended name and select an unused version. Ordinary source builds set these in `targets.cargo`. For Alpha, regenerate the canonical package mapping and artifacts through a reviewed build change. Changing only the tarball filename does not change the crate identity.

Choose either an operator-controlled Cargo registry with a publishing API or crates.io. A static crate download directory alone is not a Cargo registry. Cargo needs an index and its associated API and download configuration. [Alternate registries](https://doc.rust-lang.org/cargo/reference/registries.html), [registry index format](https://doc.rust-lang.org/cargo/reference/registry-index.html).

## Build and verify the Lean Bridge archive

For the separate Alpha fixture, prepare the native universal bundle using the [example artifact build instructions](../consume/receive-package.md#build-the-example-artifacts-as-a-maintainer), then create the Cargo projection in a new directory:

```sh
node scripts/build-cargo-package.mjs \
  --bundle build/consumer-universal-bundle --output build/publish-cargo-package
```

For a reproducible universal candidate, use a clean committed checkout:

```sh
node scripts/lean-bridge.mjs publish --project . --target cargo --dry-run \
  --output build/cargo-release-gate
npm run verify:release-authorization -- \
  --authorization build/cargo-release-gate \
  --candidate build/cargo-release-gate/release
```

The stock CLI has no Cargo registry adapter. Its universal manifest authorizes the original Lean Bridge archive, not a later Cargo repack. A maintained adapter would need to implement the registry's [publish API](https://doc.rust-lang.org/cargo/reference/registry-web-api.html), preserve the authorized archive bytes, and verify the resulting registry checksum through the transaction layer. That integration is not supplied here.

If you need to distribute the original approved archive now, give consumers the exact file through a [local handoff](local-handoff.md) or controlled artifact store and use the [Rust vendor-install recipe](../consume/rust.md).

## Prepare a separate Cargo publisher source

For an operator-approved Cargo CLI release, authenticate the original archive first, then extract a copy into a new review directory. Set the path and exact coordinates from your prepared release:

```sh
export LEAN_BRIDGE_CARGO_ARCHIVE=/absolute/path/to/cedar-api-2.0.0-rc.1.crate
export LEAN_BRIDGE_CARGO_NAME=cedar-api
export LEAN_BRIDGE_CARGO_VERSION=2.0.0-rc.1
export LEAN_BRIDGE_CARGO_REGISTRY=lean_sandbox
export LEAN_BRIDGE_CARGO_REVIEW="$(pwd)/build/cargo-publisher-review"
```

For the Alpha fixture, use its archive path, `lean_bridge_alpha` and `0.0.0` instead. Run the remaining snippets in the same Bash session:

```sh
set -euo pipefail
mkdir -p build
mkdir "$LEAN_BRIDGE_CARGO_REVIEW"
tar -xzf "$LEAN_BRIDGE_CARGO_ARCHIVE" -C "$LEAN_BRIDGE_CARGO_REVIEW"
cd "$LEAN_BRIDGE_CARGO_REVIEW/$LEAN_BRIDGE_CARGO_NAME-$LEAN_BRIDGE_CARGO_VERSION"
if [ -f .cargo_vcs_info.json ]; then
  mv .cargo_vcs_info.json ../original-cargo-vcs-info.json
fi
mkdir .cargo
```

Alpha includes `.cargo_vcs_info.json`; ordinary-source crates do not. Cargo rejects that reserved filename when it appears in the source it is about to package. When present, retain the original beside the extracted source, as above, and let Cargo manage its own archive metadata. Do not alter the approved input archive. This preparation starts a new packaging review.

Create `.cargo/config.toml` in this publisher source, replacing the deliberately invalid example URL with your registry's approved sparse-index URL:

```toml
[registry]
global-credential-providers = ["cargo:token"]

[registries.lean_sandbox]
index = "sparse+https://registry.example.invalid/index/"
credential-provider = "cargo:token"
```

Have the secret provider supply `CARGO_REGISTRIES_LEAN_SANDBOX_TOKEN`. The `cargo:token` provider reads this environment variable; it can also store tokens unencrypted if used with `cargo login`, so keep token files outside the source and release records. An organization can substitute its approved secure credential provider. [Cargo registry authentication](https://doc.rust-lang.org/cargo/reference/registry-authentication.html).

## Package, test, and approve Cargo's output

Run from the extracted publisher source:

```sh
if [ ! -f Cargo.lock ]; then
  cargo generate-lockfile --offline
fi
cargo package --locked --offline --registry "$LEAN_BRIDGE_CARGO_REGISTRY"
cargo publish --dry-run --locked --registry "$LEAN_BRIDGE_CARGO_REGISTRY"
sha256sum "$LEAN_BRIDGE_CARGO_ARCHIVE" \
  "target/package/$LEAN_BRIDGE_CARGO_NAME-$LEAN_BRIDGE_CARGO_VERSION.crate"
cp "target/package/$LEAN_BRIDGE_CARGO_NAME-$LEAN_BRIDGE_CARGO_VERSION.crate" \
  "$LEAN_BRIDGE_CARGO_REVIEW/reviewed-cargo-archive.crate"
```

Ordinary crates keep their supplied lockfile and need its dependencies in the local Cargo cache for this offline check. Alpha has no external Rust dependencies, so its missing lockfile can be generated offline. The publishing dry run may inspect the registry, but does not upload. Keep Cargo's build verification enabled. `--locked` checks dependency resolution; it does not promise equality with Lean Bridge's original archive. Cargo normalizes packaging metadata and includes its lockfile. [cargo package](https://doc.rust-lang.org/cargo/commands/cargo-package.html), [cargo publish options](https://doc.rust-lang.org/cargo/commands/cargo-publish.html).

Install `reviewed-cargo-archive.crate` into a fresh vendor directory and run the complete [Rust consumer](../consume/rust.md). Review the new archive contents, platform requirements, version, and SHA-256. Preserve both the original Lean Bridge hash and the newly approved Cargo hash. The original signed receipt cannot authenticate these changed archive bytes.

## Upload to the sandbox or crates.io

After the operator approves Cargo's archive for the selected sandbox, publish from the unchanged publisher source:

```sh
cargo publish --locked --registry "$LEAN_BRIDGE_CARGO_REGISTRY"
```

This command packages again, so the post-upload byte check remains required. Do not use `--no-verify` or `--allow-dirty` to hide a packaging failure. A successful upload is a manual registry result, not a Lean Bridge signed transaction receipt.

For crates.io, first complete package ownership and [production review](../publishing.md#build-and-approve-the-same-artifacts), including the applicable publisher integration. Supply the authorized production token as `CARGO_REGISTRY_TOKEN`, select the production registry, and repeat the package, consumer, and archive-approval steps in a new review directory for that registry before the write:

```sh
export LEAN_BRIDGE_CARGO_REGISTRY=crates-io
cargo publish --dry-run --locked --registry crates-io
```

Once the crates.io candidate is approved:

```sh
cargo publish --locked --registry crates-io
```

An organization may instead use Cargo's approved credential-provider integration. Verify that the native libraries fit the registry's package limits and that the package metadata describes its Linux platform. The existing repository production approval block cannot be bypassed by switching clients. [Publishing on crates.io](https://doc.rust-lang.org/cargo/reference/publishing.html).

## Verify the published crate and consumer

For crates.io, download the exact published version into a new directory:

```sh
LEAN_BRIDGE_CARGO_CHECK_DIR=$(mktemp -d "$LEAN_BRIDGE_CARGO_REVIEW/download.XXXXXX")
curl --fail --location \
  "https://crates.io/api/v1/crates/$LEAN_BRIDGE_CARGO_NAME/$LEAN_BRIDGE_CARGO_VERSION/download" \
  --output "$LEAN_BRIDGE_CARGO_CHECK_DIR/published.crate"
cmp "$LEAN_BRIDGE_CARGO_REVIEW/reviewed-cargo-archive.crate" \
  "$LEAN_BRIDGE_CARGO_CHECK_DIR/published.crate"
sha256sum "$LEAN_BRIDGE_CARGO_CHECK_DIR/published.crate"
```

For a private registry, use its documented authenticated download mechanism and the exact URL derived from its index's `dl` configuration. Do not assume every registry uses crates.io's path. Compare the download against `reviewed-cargo-archive.crate`, and compare its SHA-256 with the index entry's `cksum`. The [registry index specification](https://doc.rust-lang.org/cargo/reference/registry-index.html) defines these fields.

Then run the [Rust example](../consume/rust.md) in a fresh project with a pinned registry dependency instead of the local path. For the sandbox fixture, use this dependency and the same registry configuration:

```toml
[dependencies]
lean_bridge_alpha = { version = "=0.0.0", registry = "lean_sandbox" }
```

Use the actual approved crate name and version. For crates.io, omit the `registry` field. Resolve the lockfile, then run `cargo run --release --locked`. Alpha's loader requires its installed native files at their build-time location; ordinary crates embed them in the executable. Record the consumer result and registry checksum with the manual publication record.

## Recover an interrupted release

A Cargo publishing timeout may happen while the client waits for the index after an accepted upload. Inspect the registry before repeating the write. Matching downloaded bytes establish success; an occupied coordinate with different bytes requires a new version and review. [Cargo publication sequence](https://doc.rust-lang.org/cargo/commands/cargo-publish.html).

The release owner may approve yanking a broken version after arranging a corrective release. Yanking changes dependency selection; it does not erase downloads or remove the version from existing lockfiles. [cargo yank](https://doc.rust-lang.org/cargo/commands/cargo-yank.html).

Keep any universal candidate record separate from this repackaged release. [Sandbox release](../contributing/sandbox-release.md#rehearse-a-registry-release) and [Publishing](../publishing.md) describe the signed transaction integration needed for the original exact-archive workflow.

### Publish Rust crates

The package-manager recipe above remains available at this address. Return to [target selection](../publishing.md) or [consumer installation](../consume.md).
