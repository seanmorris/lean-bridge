# Build and publish Rust packages

This target currently packages the repository's prepared Alpha bundle and target metadata. For another library, first check [source preparation and target inputs](../lean/existing-package.md). Your language's package manager installs the completed output without compiling Lean.

Lean Bridge creates a deterministic `.crate` for direct installation. Cargo's publishing command creates another archive from a source directory before uploading it. It has no option that uploads an existing `.crate` unchanged. A Cargo CLI publication therefore needs its own reviewed archive and verification record. [cargo publish](https://doc.rust-lang.org/cargo/commands/cargo-publish.html).

## Package identity and publisher prerequisites

The Alpha fixture uses crate `lean_bridge_alpha@0.0.0` and Rust edition 2021. Its native libraries target Linux x86-64 with glibc 2.38 or newer. Build and run consumer checks on that platform.

Use the fixture coordinate only in a registry you control. For crates.io, establish ownership of the intended name, select an unused version, and regenerate the canonical package mapping and artifacts through a reviewed build change. The package builder has no `--name` override. Changing only the tarball filename does not change the crate identity.

Choose either an operator-controlled Cargo registry with a publishing API or crates.io. A static crate download directory alone is not a Cargo registry. Cargo needs an index and its associated API and download configuration. [Alternate registries](https://doc.rust-lang.org/cargo/reference/registries.html), [registry index format](https://doc.rust-lang.org/cargo/reference/registry-index.html).

## Build and verify the Lean Bridge archive

Prepare the native universal bundle using the [example artifact build instructions](../consume/receive-package.md#build-the-example-artifacts-as-a-maintainer), then create the Cargo projection in a new directory:

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

For an operator-approved Cargo CLI release, authenticate the original archive first, then extract a copy into a new review directory. These example coordinates match the fixture and are suitable only for an owned sandbox:

```sh
export LEAN_BRIDGE_CARGO_ARCHIVE=/absolute/path/to/lean_bridge_alpha-0.0.0.crate
export LEAN_BRIDGE_CARGO_NAME=lean_bridge_alpha
export LEAN_BRIDGE_CARGO_VERSION=0.0.0
export LEAN_BRIDGE_CARGO_REGISTRY=lean_sandbox
export LEAN_BRIDGE_CARGO_REVIEW="$(pwd)/build/cargo-publisher-review"
mkdir -p build
mkdir "$LEAN_BRIDGE_CARGO_REVIEW"
tar -xzf "$LEAN_BRIDGE_CARGO_ARCHIVE" -C "$LEAN_BRIDGE_CARGO_REVIEW"
cd "$LEAN_BRIDGE_CARGO_REVIEW/$LEAN_BRIDGE_CARGO_NAME-$LEAN_BRIDGE_CARGO_VERSION"
mv .cargo_vcs_info.json ../original-cargo-vcs-info.json
mkdir .cargo
```

The generated archive includes `.cargo_vcs_info.json`. Cargo rejects that reserved filename when it appears in the source it is about to package. Retain the original beside the extracted source, as above, and let Cargo manage its own archive metadata. Do not alter the approved input archive. This preparation starts a new packaging review.

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
cargo generate-lockfile --offline
cargo package --locked --offline --registry "$LEAN_BRIDGE_CARGO_REGISTRY"
cargo publish --dry-run --locked --registry "$LEAN_BRIDGE_CARGO_REGISTRY"
sha256sum "$LEAN_BRIDGE_CARGO_ARCHIVE" \
  "target/package/$LEAN_BRIDGE_CARGO_NAME-$LEAN_BRIDGE_CARGO_VERSION.crate"
cp "target/package/$LEAN_BRIDGE_CARGO_NAME-$LEAN_BRIDGE_CARGO_VERSION.crate" \
  "$LEAN_BRIDGE_CARGO_REVIEW/reviewed-cargo-archive.crate"
```

Alpha has no external Rust dependencies, so its lockfile and local package check can run offline. The publishing dry run may inspect the registry, but does not upload. Keep Cargo's build verification enabled. `--locked` checks dependency resolution; it does not promise equality with Lean Bridge's original archive. Cargo normalizes packaging metadata and includes its lockfile. [cargo package](https://doc.rust-lang.org/cargo/commands/cargo-package.html), [cargo publish options](https://doc.rust-lang.org/cargo/commands/cargo-publish.html).

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

Use the actual approved crate name and version. For crates.io, omit the `registry` field. Resolve the lockfile, then run `cargo run --release --locked`. Keep the installed crate's native files at its build-time location as required by the current Rust loader. Record the consumer result and registry checksum with the manual publication record.

## Recover an interrupted release

A Cargo publishing timeout may happen while the client waits for the index after an accepted upload. Inspect the registry before repeating the write. Matching downloaded bytes establish success; an occupied coordinate with different bytes requires a new version and review. [Cargo publication sequence](https://doc.rust-lang.org/cargo/commands/cargo-publish.html).

The release owner may approve yanking a broken version after arranging a corrective release. Yanking changes dependency selection; it does not erase downloads or remove the version from existing lockfiles. [cargo yank](https://doc.rust-lang.org/cargo/commands/cargo-yank.html).

Keep any universal candidate record separate from this repackaged release. [Sandbox release](../contributing/sandbox-release.md#rehearse-a-registry-release) and [Publishing](../publishing.md) describe the signed transaction integration needed for the original exact-archive workflow.

### Publish Rust crates

The package-manager recipe above remains available at this address. Return to [target selection](../publishing.md) or [consumer installation](../consume.md).
