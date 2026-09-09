# Publish C, C++, and WIT/WASI archives

Distribute the generated C, C++, and WIT/WASI tarballs through an artifact server or GitHub Release. Their universal publication targets are `c`, `cpp`, and `wit-wasi`, with operation `retain`. Lean Bridge keeps the archives and their identities; it does not upload them to a C package registry, OCI registry, or GitHub Release.

External distribution is a separate operator action after the [release review](production-release.md). The commands below show that action without replacing the registry transaction or issuing a new Lean Bridge receipt.

## Prepare the package archives

From a Lean Bridge checkout, build the pinned universal Alpha bundle and select the required packages:

```sh
nix --extra-experimental-features 'nix-command flakes' \
  build .#universal-release-bundle --out-link build/publish-universal-bundle
node scripts/build-c-family-package.mjs --ecosystem c \
  --bundle build/publish-universal-bundle --output build/publish-c
node scripts/build-c-family-package.mjs --ecosystem cpp \
  --bundle build/publish-universal-bundle --output build/publish-cpp
node scripts/build-wasi-package.mjs \
  --bundle build/publish-universal-bundle --output build/publish-wasi
```

Use new output directories. Each builder verifies its canonical input and copies the package's approved artifacts. A bundle missing the native component or the WIT/WASI adapter cannot produce those packages.

| Target | Alpha archive | What the consumer receives |
| --- | --- | --- |
| `c` | `lean-bridge-alpha-0.0.0-c.tar.gz` | C11 headers, native libraries, CMake and pkg-config metadata |
| `cpp` | `lean-bridge-alpha-0.0.0-cpp.tar.gz` | C++20 wrappers, C binding, native libraries, CMake metadata |
| `wit-wasi` | `lean-bridge-alpha-wasi-0.0.0.tar.gz` | WIT declarations, Component Model adapter, Wasmtime host, native libraries |

The package version comes from the canonical bundle. Choose release names and coordinates you own before producing the candidate. Keep generated filenames and archive bytes unchanged after approval.

Check the archives with the [C](../consume/c.md), [C++](../consume/cpp.md), and [WIT/WASI](../consume/wit-wasi.md) consumer examples. Repository-wide [native and WASI acceptance checks](../contributing/testing.md#consumer-acceptance) belong to Contributing. For a universal reproducibility candidate selecting only retained archives, use:

```sh
node scripts/lean-bridge.mjs publish --project . --dry-run \
  --target c --target cpp --target wit-wasi \
  --output build/release-native-archives
```

That command produces the candidate, authorization, and universal manifest. It does not publish a GitHub Release. Completing a signed retention transaction still requires the reviewed signer and handler integration described in the [sandbox guide](sandbox-release.md#configure-the-publisher-integration).

## Freeze the handoff

For a signed release, use the exact archives under the approved candidate's `release/packages/` directory, together with its existing receipt, public policy, and archive verifier. For a locally reviewed handoff, use the package-builder outputs and record their hashes through the approved release channel. An unsigned checksum file cannot authenticate itself.

The following example uses the local builder outputs. Set these variables to the approved candidate paths instead when distributing a signed release:

```sh
export LEAN_ALPHA_C_ARCHIVE="$PWD/build/publish-c/lean-bridge-alpha-0.0.0-c.tar.gz"
export LEAN_ALPHA_CPP_ARCHIVE="$PWD/build/publish-cpp/lean-bridge-alpha-0.0.0-cpp.tar.gz"
export LEAN_ALPHA_WASI_ARCHIVE="$PWD/build/publish-wasi/lean-bridge-alpha-wasi-0.0.0.tar.gz"
sha256sum "$LEAN_ALPHA_C_ARCHIVE" "$LEAN_ALPHA_CPP_ARCHIVE" "$LEAN_ALPHA_WASI_ARCHIVE"
```

Record the output, source revision, platform requirements, approvals, and consumer results before the first upload. These native packages require x86-64 Linux with glibc 2.38 or newer. Include the WIT/WASI adapter's native-host requirement in the release notes.

## Publish a GitHub Release

Use a repository you control and an already reviewed, pushed tag. Have the release owner approve the repository, tag, commit, filenames, and hashes. Authenticate GitHub CLI through your organization's approved account or secret provider. The commands below write release state and upload assets.

Create a draft against the existing tag:

```sh
export LEAN_ALPHA_RELEASE_REPO=YOUR_ORGANIZATION/YOUR_RELEASE_REPOSITORY
export LEAN_ALPHA_RELEASE_TAG=v0.0.0
export LEAN_ALPHA_RELEASE_NOTES=/absolute/path/to/reviewed-release-notes.md
gh release create "$LEAN_ALPHA_RELEASE_TAG" \
  --repo "$LEAN_ALPHA_RELEASE_REPO" --verify-tag --draft \
  --title "Lean Alpha $LEAN_ALPHA_RELEASE_TAG" \
  --notes-file "$LEAN_ALPHA_RELEASE_NOTES"
```

`--verify-tag` prevents the CLI from creating a new tag from the repository's current default branch. [GitHub release creation](https://cli.github.com/manual/gh_release_create).

Upload the original archives:

```sh
gh release upload "$LEAN_ALPHA_RELEASE_TAG" \
  "$LEAN_ALPHA_C_ARCHIVE" "$LEAN_ALPHA_CPP_ARCHIVE" "$LEAN_ALPHA_WASI_ARCHIVE" \
  --repo "$LEAN_ALPHA_RELEASE_REPO"
```

If the approved handoff includes an existing signed receipt, upload its matching `release-receipt.json`, `publication-signer-policy.json`, and `verify-release-archive.mjs` as additional assets before publishing. Upload reviewed checksum and platform documentation as well. Use one copy of shared receipt files when all archives belong to the same transaction.

Do not use `--clobber`: that option deletes an existing asset before replacing it. A filename collision needs inspection of the existing release and its bytes. [GitHub asset upload](https://cli.github.com/manual/gh_release_upload).

Inspect the draft and download its archives to a new directory for byte comparison:

```sh
gh release view "$LEAN_ALPHA_RELEASE_TAG" --repo "$LEAN_ALPHA_RELEASE_REPO"
mkdir build/release-download-check
gh release download "$LEAN_ALPHA_RELEASE_TAG" --repo "$LEAN_ALPHA_RELEASE_REPO" \
  --pattern lean-bridge-alpha-0.0.0-c.tar.gz \
  --pattern lean-bridge-alpha-0.0.0-cpp.tar.gz \
  --pattern lean-bridge-alpha-wasi-0.0.0.tar.gz \
  --dir build/release-download-check
cmp "$LEAN_ALPHA_C_ARCHIVE" build/release-download-check/lean-bridge-alpha-0.0.0-c.tar.gz
cmp "$LEAN_ALPHA_CPP_ARCHIVE" build/release-download-check/lean-bridge-alpha-0.0.0-cpp.tar.gz
cmp "$LEAN_ALPHA_WASI_ARCHIVE" build/release-download-check/lean-bridge-alpha-wasi-0.0.0.tar.gz
```

Use an authenticated maintainer account to inspect a draft. Exact filenames make the download select only the approved archives. [GitHub release downloads](https://cli.github.com/manual/gh_release_download).

After the release owner accepts the downloaded-byte checks, publish the draft:

```sh
gh release edit "$LEAN_ALPHA_RELEASE_TAG" \
  --repo "$LEAN_ALPHA_RELEASE_REPO" --draft=false
```

This changes the draft's publication state. [GitHub release editing](https://cli.github.com/manual/gh_release_edit).

If immutable releases are enabled for the repository, upload every asset before this step. GitHub locks the tag and assets after publication and produces its own release attestation. [GitHub immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases).

For an immutable release, verify a downloaded asset against GitHub's attestation:

```sh
gh release verify-asset "$LEAN_ALPHA_RELEASE_TAG" \
  build/release-download-check/lean-bridge-alpha-0.0.0-c.tar.gz \
  --repo "$LEAN_ALPHA_RELEASE_REPO"
```

Repeat for the other assets. GitHub's attestation establishes association with that GitHub release; it does not create a Lean Bridge signed transaction receipt. [GitHub asset verification](https://cli.github.com/manual/gh_release_verify-asset).

## Use an artifact server instead

An organization can host the same original tarballs on an HTTPS artifact server. The following example assumes an approved SSH account and a configured webroot at `/srv/www/lean-alpha/0.0.0`. It creates a new version directory and uploads only the three selected archives:

```sh
set -euo pipefail
export LEAN_ALPHA_ARCHIVE_SSH=release@artifacts.example.org
ssh "$LEAN_ALPHA_ARCHIVE_SSH" \
  'test ! -e /srv/www/lean-alpha/0.0.0 && mkdir -p /srv/www/lean-alpha/0.0.0'
scp "$LEAN_ALPHA_C_ARCHIVE" "$LEAN_ALPHA_CPP_ARCHIVE" "$LEAN_ALPHA_WASI_ARCHIVE" \
  "$LEAN_ALPHA_ARCHIVE_SSH:/srv/www/lean-alpha/0.0.0/"
```

Replace the host and directory with the approved deployment values. OpenSSH transfers files using the account's authentication and server host-key verification. [OpenSSH file transfer](https://man.openbsd.org/scp).

Publish the matching verification files and reviewed installation instructions at the same versioned location. Download each archive over the configured HTTPS endpoint and compare it with the approved SHA-256 before announcing the release. Use storage permissions or object locking to prevent overwriting published versions. No Conan, vcpkg, or OCI integration is implied by these tarballs.

## Verify the consumer handoff

When an existing signed receipt covers the exact archives, give consumers the policy hash through a separate trusted channel and follow [Receive a package](../consume/receive-package.md#authenticate-a-signed-archive). Distribution must preserve each signed filename, byte length, and SHA-256.

For an unsigned local handoff, name the trusted sender and transfer channel, retain the reviewed hashes, and do not label it a signed release. Direct consumers to the [C](../consume/c.md), [C++](../consume/cpp.md), or [WIT/WASI](../consume/wit-wasi.md) installation guide.

## Recover an interrupted upload

If an upload stops halfway through, inspect the destination and compare existing assets before resuming. Do not replace completed assets with a rebuilt archive under the same version. A changed package needs a new reviewed candidate and release identity.
