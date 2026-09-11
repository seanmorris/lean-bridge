# Publish signed Nix packages

Build a named flake output, sign its Nix store closure, and publish that closure through a binary cache. Consumers select the same source revision and trust the cache's public signing key before downloading the result.

This repository has no configured public binary cache, project cache key, or universal `publish --target nix`. The commands below belong to an operator-managed cache workflow. Apply the [publishing approvals](../publishing.md) and [production review](../publishing.md#build-and-approve-the-same-artifacts) to its source revision, store paths, signer, and destination before distribution.

## Choose a declared output

The repository's [flake](../../flake.nix) declares these useful distribution outputs:

| Flake attribute under `packages.x86_64-linux` | Contents |
| --- | --- |
| `universal-release-bundle` | Compiled Alpha artifacts and their universal bundle metadata. |
| `release-rehearsal` | Prepared ecosystem archives and local release records. |
| `npm-package`, `nuget-package`, `maven-package`, `rubygems-package`, `wasi-package` | Individual package projections. |
| `php-native-package` | The separately built native PHP package. |
| `component-build-engine` | The component builder executable and its runtime dependencies. |
| `perl-build-engine` | The native Perl package builder and its pinned compiler environment. |

The default package is `capsule-graph`, which validates capsule graph profiles. Specify the release output explicitly. The flake also declares `aarch64-linux`, but that system exposes the capsule graph package and its default alias, not the compiled release outputs above. Python, Rust, C, and C++ archives are included in `release-rehearsal`; they have no standalone `pypi-package`, `cargo-package`, `c-package`, or `cpp-package` attributes.

Use an x86-64 Linux publisher with Nix, Bash, Git, curl, SSH, rsync, and enough disk space for the build and copied closure. These commands use the `nix-command` and `flakes` features and match the repository builder's Nix 2.24 CLI. Run the publisher snippets in one Bash session from a clean, reviewed checkout. Keep the committed `flake.lock` unchanged.

## Build and record the candidate

Create a new records directory. The two output links keep the store paths reachable by Nix's garbage collector while you prepare publication:

```sh
set -euo pipefail
mkdir -p build
LEAN_BRIDGE_NIX_RECORDS=$(mktemp -d "$PWD/build/nix-publication.XXXXXX")
git diff --quiet
git diff --cached --quiet
git rev-parse HEAD > "$LEAN_BRIDGE_NIX_RECORDS/source-revision.txt"
sha256sum flake.lock > "$LEAN_BRIDGE_NIX_RECORDS/flake-lock.sha256"

LEAN_BRIDGE_BUNDLE_STORE=$(nix --extra-experimental-features 'nix-command flakes' build \
  --no-update-lock-file --no-write-lock-file --print-out-paths \
  --out-link "$LEAN_BRIDGE_NIX_RECORDS/bundle" \
  '.#packages.x86_64-linux.universal-release-bundle')
LEAN_BRIDGE_PACKAGES_STORE=$(nix --extra-experimental-features 'nix-command flakes' build \
  --no-update-lock-file --no-write-lock-file --print-out-paths \
  --out-link "$LEAN_BRIDGE_NIX_RECORDS/packages" \
  '.#packages.x86_64-linux.release-rehearsal')
printf '%s\n' "$LEAN_BRIDGE_BUNDLE_STORE" "$LEAN_BRIDGE_PACKAGES_STORE" \
  > "$LEAN_BRIDGE_NIX_RECORDS/store-paths.txt"
nix --extra-experimental-features nix-command path-info --recursive --json \
  "$LEAN_BRIDGE_BUNDLE_STORE" "$LEAN_BRIDGE_PACKAGES_STORE" \
  > "$LEAN_BRIDGE_NIX_RECORDS/closure-before-signing.json"
```

Both variables must contain actual `/nix/store/...` paths from this Nix store. A copied `build/` bundle is a payload directory, not a registered store path. Paths reported inside a discarded Docker builder also cannot be signed from the host store. Run the signing and copying steps against the store that retains the build outputs.

Review the source revision, locked inputs, original store paths, closure hashes, archive inventory, and [consumer checks](../consume/receive-package.md). `release-rehearsal` packages artifacts; its name does not imply a registry upload or production approval. Nix's build command creates the selected outputs and output links. [Nix build](https://nix.dev/manual/nix/2.24/command-ref/new-cli/nix3-build.html).

## Create and protect the signing key

Have the cache administrator provide a private parent directory outside the checkout, build inputs, Nix store, and web root. Replace the example directory and cache hostname below. Run key generation once under the publisher account; the command writes private bytes directly to a protected file:

```sh
LEAN_BRIDGE_SIGNING_DIR=/absolute/private/lean-bridge-cache-keys
LEAN_BRIDGE_CACHE_KEY_NAME=cache.example.org-1
(
  umask 077
  mkdir "$LEAN_BRIDGE_SIGNING_DIR"
  nix-store --generate-binary-cache-key "$LEAN_BRIDGE_CACHE_KEY_NAME" \
    "$LEAN_BRIDGE_SIGNING_DIR/cache.secret" \
    "$LEAN_BRIDGE_SIGNING_DIR/cache.public"
)
LEAN_BRIDGE_CACHE_PUBLIC_KEY=$(< "$LEAN_BRIDGE_SIGNING_DIR/cache.public")
sha256sum "$LEAN_BRIDGE_SIGNING_DIR/cache.public"
```

`mkdir` deliberately fails if that key directory already exists. For later releases, load the existing key through the approved secret provider. Keep its file readable only by the signing account, retain an encrypted recovery copy, and disable shell tracing around secret-provider operations. Do not place a private key in a Nix expression, derivation, CI artifact, command argument, or cache directory. Distribute the public key and its authenticated fingerprint through the release team's trusted channel. [Nix binary-cache key generation](https://nix.dev/manual/nix/2.33/command-ref/nix-store/generate-binary-cache-key).

## Sign the closure and publish a file cache

The publisher needs permission to add signatures to its source Nix store. Sign both reviewed outputs and their referenced store paths. Preserve the public key and signed inventory with the release records:

```sh
nix --extra-experimental-features nix-command store sign --recursive \
  --key-file "$LEAN_BRIDGE_SIGNING_DIR/cache.secret" \
  "$LEAN_BRIDGE_BUNDLE_STORE" "$LEAN_BRIDGE_PACKAGES_STORE"
cp "$LEAN_BRIDGE_SIGNING_DIR/cache.public" "$LEAN_BRIDGE_NIX_RECORDS/cache.public"
nix --extra-experimental-features nix-command path-info --recursive --json --sigs \
  "$LEAN_BRIDGE_BUNDLE_STORE" "$LEAN_BRIDGE_PACKAGES_STORE" \
  > "$LEAN_BRIDGE_NIX_RECORDS/closure-signed.json"

LEAN_BRIDGE_CACHE_DIR=$(mktemp -d "$PWD/build/nix-binary-cache.XXXXXX")
nix --extra-experimental-features nix-command copy \
  --to "file://$LEAN_BRIDGE_CACHE_DIR" \
  "$LEAN_BRIDGE_BUNDLE_STORE" "$LEAN_BRIDGE_PACKAGES_STORE"
nix --extra-experimental-features nix-command store verify \
  --store "file://$LEAN_BRIDGE_CACHE_DIR" --recursive --sigs-needed 1 \
  --option trusted-public-keys "$LEAN_BRIDGE_CACHE_PUBLIC_KEY" \
  --option secret-key-files '' \
  "$LEAN_BRIDGE_BUNDLE_STORE" "$LEAN_BRIDGE_PACKAGES_STORE"
```

`nix store sign --recursive` attaches signatures to the closure. `nix copy` already copies the closure, including its signatures; it does not take `--recursive`. The `file://` prefix selects a binary cache, while a bare directory selects a local Nix store. [Store signing](https://nix.dev/manual/nix/2.24/command-ref/new-cli/nix3-store-sign), [Nix copy](https://nix.dev/manual/nix/2.24/command-ref/new-cli/nix3-copy).

The file cache contains `nix-cache-info`, `.narinfo` metadata, and compressed NAR files. The administrator must configure the HTTPS host to serve `/srv/www/nix-cache` read-only, and permit the publisher account to create release subdirectories there. Keep signing keys and private publication records outside that root.

After approval, deploy to a fresh versioned directory. This example uses SSH and rsync; replace the host with your controlled server. Permit only one publisher for each release name. The web server must deny access to names ending in `.staging` until the final atomic rename:

```sh
LEAN_BRIDGE_CACHE_HOST=cache-publisher@cache.example.org
LEAN_BRIDGE_CACHE_REMOTE_ROOT=/srv/www/nix-cache
LEAN_BRIDGE_SOURCE_REVISION=$(< "$LEAN_BRIDGE_NIX_RECORDS/source-revision.txt")
[[ "$LEAN_BRIDGE_SOURCE_REVISION" =~ ^[0-9a-f]{40}$ ]]
[[ "$LEAN_BRIDGE_CACHE_KEY_NAME" =~ ^[A-Za-z0-9._-]+$ ]]
LEAN_BRIDGE_CACHE_RELEASE="$LEAN_BRIDGE_SOURCE_REVISION-$LEAN_BRIDGE_CACHE_KEY_NAME"
ssh "$LEAN_BRIDGE_CACHE_HOST" \
  "mkdir '$LEAN_BRIDGE_CACHE_REMOTE_ROOT/$LEAN_BRIDGE_CACHE_RELEASE.staging'"
rsync -rpt --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
  "$LEAN_BRIDGE_CACHE_DIR/" \
  "$LEAN_BRIDGE_CACHE_HOST:$LEAN_BRIDGE_CACHE_REMOTE_ROOT/$LEAN_BRIDGE_CACHE_RELEASE.staging/"
ssh "$LEAN_BRIDGE_CACHE_HOST" \
  "test ! -e '$LEAN_BRIDGE_CACHE_REMOTE_ROOT/$LEAN_BRIDGE_CACHE_RELEASE' && mv '$LEAN_BRIDGE_CACHE_REMOTE_ROOT/$LEAN_BRIDGE_CACHE_RELEASE.staging' '$LEAN_BRIDGE_CACHE_REMOTE_ROOT/$LEAN_BRIDGE_CACHE_RELEASE'"
LEAN_BRIDGE_CACHE_URL="https://cache.example.org/$LEAN_BRIDGE_CACHE_RELEASE"
```

Only the cache directory enters the upload. The new endpoint contains a complete cache tree; existing release endpoints remain unchanged. The rsync flags preserve the copied permissions while granting the web server read access. [rsync remote copying and permissions](https://download.samba.org/pub/rsync/rsync.1). For a local sandbox, consumers can use `file://$LEAN_BRIDGE_CACHE_DIR`. Verify the actual deployed endpoint before announcing it:

```sh
curl --fail --show-error "$LEAN_BRIDGE_CACHE_URL/nix-cache-info"
nix --extra-experimental-features nix-command store verify \
  --store "$LEAN_BRIDGE_CACHE_URL" --recursive --sigs-needed 1 \
  --option trusted-public-keys "$LEAN_BRIDGE_CACHE_PUBLIC_KEY" \
  --option secret-key-files '' \
  "$LEAN_BRIDGE_BUNDLE_STORE" "$LEAN_BRIDGE_PACKAGES_STORE"
```

Keep the cache directory or object storage under retention policy after publication. This file/HTTPS workflow does not upload npm, PyPI, or other ecosystem packages to their registries. Those archives still use their [ecosystem publishing flows](../publishing.md#choose-the-package-ecosystem).

## Configure consumer trust

Consumer instructions now live in [configure consumer trust](../consume/receive-package.md#configure-consumer-trust). Supply the authenticated cache URL, public key, revision, and expected store paths with the release.

## Verify without installing, then test a clean fetch

Consumer instructions now live in [verify without installing, then test a clean fetch](../consume/receive-package.md#verify-without-installing-then-test-a-clean-fetch). Supply the authenticated cache URL, public key, revision, and expected store paths with the release.

## Consume the pinned flake revision

Consumer instructions now live in [consume the pinned flake revision](../consume/receive-package.md#consume-the-pinned-flake-revision). Supply the authenticated cache URL, public key, revision, and expected store paths with the release.

## Rotate keys and recover publication

For planned rotation, generate a new protected pair with a new key name such as `cache.example.org-2`. Distribute and authenticate its public key before switching publishers. Sign retained approved closures with the new key, publish them to a fresh cache root, and verify that root with the new key. Deploy the updated root and consumer trust settings, test clean substitution, then retire the old key after the agreed overlap period. An ordinary copy can skip paths already present at its destination; do not assume it refreshes signatures in existing `.narinfo` files.

If a private key is compromised, stop using it and remove its public key from consumer trust through the incident response process. Review the affected cache and rebuild or restore approved contents from trusted evidence before signing them with the replacement key. Removing a trusted key does not remove packages that consumers have already installed.

For an interrupted cache deployment, retain the original store paths, signed inventory, and destination. Check missing NARs and metadata, resume copying unchanged closure contents, and repeat remote verification and the clean fetch. Never repair a signature failure by disabling signature checks. Preserve older approved closures for rollback and keep the current output links until cache retention is confirmed.

## What the signature establishes

A Nix cache signature authenticates store metadata, including the store path, NAR hash and size, and references. Nix checks downloaded contents against that metadata. It does not sign a Git commit, authenticate a source repository owner, or replace Lean's proof checking. The source revision and proof/build evidence remain separate release records. This cache workflow also does not create Lean Bridge's signed publication attestation or completion receipt. [Nix signing and verification implementation](https://raw.githubusercontent.com/NixOS/nix/2.24.11/src/libstore/path-info.cc), [Lean Bridge release records](../publishing.md#know-which-record-you-have).
