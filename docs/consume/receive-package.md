# Use a prepared release

Obtain the prepared release for your language and platform from its publisher. A prepared release already contains the compiled code; verification and installation do not require a Lean source checkout.

## Check the release files

### Identify the release type

| Package | Files to request | Next step |
| --- | --- | --- |
| Signed release | Exact archive, release receipt and its `.sha256` sidecar, signer policy, signed subject path, and coordinate | Authenticate each archive before installation. |
| Ordinary-source package set, including mixed targets | `package-set-receipt.json`, `package-set-receipt.json.sha256`, and every archive named in the receipt, preserving relative paths | Verify the package set, then use your language's package manager. |
| Local `onboarding-small` npm release | Runtime archive, component archive, and component receipt | Verify the local receipt and install both archives in one command. |
| Earlier native Perl handoff without a package-set receipt | Runtime and component CPAN archives, native release inventory, and authenticated checksums | Follow the [Perl installation](perl.md). Its native receipt is not a universal signed transaction receipt. |
| Local Alpha package | The language-specific archive from a trusted distributor, with its identity and tested platform | Follow that language's installation recipe. A local archive alone has no signed release identity. |

Get the expected signer-policy hash from reviewed configuration or a separate trusted channel. A policy file and a hash delivered beside an untrusted archive cannot establish the signer's identity.

### Install the verifier CLI

If your installed CLI lists verification options in `lean-bridge verify --help`, continue below. Otherwise, obtain a prepared CLI archive and its reviewed SHA-256 from the maintainer's trusted release channel. The CLI candidate is currently supplied as an archive, not a public npm release.

Set the archive's absolute path and compare its checksum with the reviewed value before installing it:

```sh
export LEAN_BRIDGE_CLI_ARCHIVE=/absolute/path/to/lean-bridge-0.1.0-rc.1.tgz
sha256sum "$LEAN_BRIDGE_CLI_ARCHIVE"
```

After that comparison succeeds, install the CLI in a separate tools directory:

```sh
export LEAN_BRIDGE_VERIFY_TOOLS=$(mktemp -d)
npm install --prefix "$LEAN_BRIDGE_VERIFY_TOOLS" --offline --ignore-scripts \
  --no-audit --no-fund "$LEAN_BRIDGE_CLI_ARCHIVE"
export PATH="$LEAN_BRIDGE_VERIFY_TOOLS/node_modules/.bin:$PATH"
lean-bridge verify --help
```

Verification needs Node 22 and the downloaded files. A runtime-free CLI archive is sufficient; do not install Lean, Git, Nix, Docker, or a shared runtime for this command. The command does not read a Lean project or its configuration, install packages, or contact a registry. Ordinary registry consumers can use their package manager without this separate archive-verification workflow.

### Verify a local package set

Use this receipt for ordinary-source npm, PyPI, Cargo, C, C++, NuGet, Maven, RubyGems, CPAN, native PHP, PHP-Wasm, and WIT/WASI builds, including combined releases. Keep `package-set-receipt.json` and its mandatory `package-set-receipt.json.sha256` sidecar together. Keep every named archive at its recorded relative path:

```sh
lean-bridge verify --receipt ./release/package-set-receipt.json
```

The command checks the receipt's sidecar, each archive's SHA-256 and byte count, unique package names, exact in-set dependencies, and runtime compatibility within each compiled profile. Missing files, changed bytes, symlinks, unsafe paths, conflicting names, and incompatible dependencies fail verification. It does not unpack or execute package contents.

Successful output lists the component and package identities. With `--json`, it reports `verificationType: "local-package-set"` and `authenticated: false`. The receipt checks declared metadata and archive consistency. It does not authenticate a publisher, inspect package-manager metadata inside archives, or rerun Lean proofs. Obtain the receipt and archives through a trusted release channel; use the signed procedure below when the publisher supplies signed records.

Only the receipt, sidecar, and named archives are needed. Compiler staging, unpacked package directories and Lean sources can remain with the author. If the archives are stored separately, pass `--artifacts /absolute/path/to/archive-root`; paths inside that directory must still match the receipt. Do not rename or flatten the archive tree.

Single-target npm builds put this receipt under `release/packages/npm/`. Native and PHP-Wasm builds put it at the release root. Combined builds add a release-root receipt covering all selected profiles. The older npm receipt below remains supported without a sidecar.

After verification, follow your [language guide](../consume.md#choose-your-language) to install the exact archives. Keep the generated runtime dependencies. A Maven package includes both its JAR and POM; a PHP-Wasm handoff includes its npm runtime, npm component, and Composer companion. The receipt's `requires` field records exact dependencies within the handoff, not external requirements such as PHP or the .NET runtime.

### Authenticate a signed archive

Keep `release-receipt.json` and its matching `release-receipt.sha256` sidecar together. The handoff also supplies `publication-signer-policy.json`. Run the installed CLI before installing, extracting, or loading the archive:

```sh
lean-bridge verify \
  --archive ./downloaded-package \
  --receipt ./release-receipt.json \
  --policy ./publication-signer-policy.json \
  --policy-sha256 <trusted-policy-sha256> \
  --subject <signed-subject-path> \
  --coordinate <expected-coordinate>
```

Replace the angle-bracket placeholders with the reviewed handoff values. Use the actual archive filename instead of `downloaded-package`. The verifier checks both Ed25519-signed decisions, the policy identity, coordinate, filename, byte length, and SHA-256. Repeat this check for each archive you install, including a separately packaged runtime.

Use `--json` for a machine-readable result: successful signed verification reports `result.verificationType: "signed-archive"` and `result.authenticated: true`. Supplying any signed-verification option requires the complete signed option set. Failed authentication never falls back to an unsigned check.

For an offline handoff without the installed CLI, the copied `verify-release-archive.mjs` remains supported. Use a script from a trusted release channel and replace `lean-bridge verify` with `node ./verify-release-archive.mjs`, retaining all six file and identity arguments above.

An archive hash failure requires the matching archive and receipt from the author. Do not edit a receipt, rename another version, or recalculate a policy hash to make verification pass.

Use this procedure only when the publisher supplies an actual signed handoff. An ordinary registry upload does not create those records. The PHP and native Perl builders are outside the universal publication pipeline; their current handoff needs a trusted distribution channel and the publisher's recorded package hashes. See [publishing by ecosystem](../publishing.md#choose-the-package-ecosystem) for the available flows.

### Verify the local npm receipt

Use the completed npm handoff directory containing both archives and `component-package-receipt.json`. Set its absolute path:

```sh
export LEAN_BRIDGE_RELEASE=/absolute/path/to/release/packages/npm
lean-bridge verify \
  --receipt "$LEAN_BRIDGE_RELEASE/component-package-receipt.json"
```

The CLI prints `verified: true`, the component identity, and the runtime version after checking both archive hashes. With `--json`, the result reports `verificationType: "local-npm"` and `authenticated: false`. This unsigned receipt checks consistency; it does not authenticate a release signer. Use `--artifacts /path/to/archives` if both archives are stored outside the receipt's directory.

The copied verifier remains an offline fallback when no CLI is installed. Use a script from an author or release channel you trust:

```sh
node "$LEAN_BRIDGE_RELEASE/verify-component-package-receipt.mjs" \
  --receipt "$LEAN_BRIDGE_RELEASE/component-package-receipt.json"
```

Select the exact archive names from that receipt:

```sh
export LEAN_BRIDGE_RUNTIME_ARCHIVE="$LEAN_BRIDGE_RELEASE/$(node -p \
  'require(process.argv[1]).runtime.archive' \
  "$LEAN_BRIDGE_RELEASE/component-package-receipt.json")"
export LEAN_BRIDGE_COMPONENT_ARCHIVE="$LEAN_BRIDGE_RELEASE/$(node -p \
  'require(process.argv[1]).package.archive' \
  "$LEAN_BRIDGE_RELEASE/component-package-receipt.json")"
```

Keep these variables when following the [JavaScript and TypeScript guide](../javascript-typescript.md), including its browser, React, and worker sections. Installing both archives together satisfies the component's exact runtime dependency without fetching a substitute.

The separate runtime archive is an installation dependency. The component loads it automatically when imported. If the publisher distributes both packages through your configured registry, npm resolves that dependency from the component's metadata.

To install flake outputs from a binary cache, follow [signed Nix package consumption](#install-from-a-signed-nix-cache). Obtain the cache's public key through a trusted channel and check substitution before relying on the installed output. A Nix cache signature and a Lean Bridge archive receipt authenticate different records.

## Install from a signed Nix cache

These steps consume a publisher's already-built output. They verify the cache and require substitution; missing artifacts fail instead of compiling a replacement. Authors use [signed Nix publication](../publish/nix.md).

### Configure consumer trust

Give consumers the approved cache URL, full source revision, explicit flake attribute, expected store paths, and public key. They must authenticate that key through the trusted release channel before accepting it. A cache operator whose key is trusted can supply executable store contents. [Configure a custom binary cache](https://nix.dev/guides/recipes/add-binary-cache).

For persistent configuration, the Nix administrator adds these entries to the appropriate `nix.conf`, replacing the example URL and the entire public-key value:

```ini
extra-substituters = https://cache.example.org/REPLACE_WITH_PUBLISHED_CACHE_RELEASE
extra-trusted-public-keys = cache.example.org-1:REPLACE_WITH_AUTHENTICATED_PUBLIC_KEY
```

The `extra-` settings preserve existing substituters and public keys. On NixOS, merge the equivalent entries into the existing configuration:

```nix
{
  nix.settings.extra-substituters = [
    "https://cache.example.org/REPLACE_WITH_PUBLISHED_CACHE_RELEASE"
  ];
  nix.settings.extra-trusted-public-keys = [
    "cache.example.org-1:REPLACE_WITH_AUTHENTICATED_PUBLIC_KEY"
  ];
}
```

The administrator applies the configuration through the system's normal deployment process. Multi-user installations can reject or ignore unapproved user-supplied cache settings; ask the administrator to configure the daemon. Do not broaden `trusted-users` to make a download work. The following command examples use temporary `extra-` flags and do not edit configuration files.

### Verify without installing, then test a clean fetch

On the consumer, set these values from the authenticated release record. The public-key file contains only public bytes:

```sh
LEAN_BRIDGE_CACHE_URL=https://cache.example.org/REPLACE_WITH_PUBLISHED_CACHE_RELEASE
LEAN_BRIDGE_CACHE_PUBLIC_KEY=$(< ./trusted-cache.public)
LEAN_BRIDGE_PACKAGES_STORE=/nix/store/REPLACE_WITH_APPROVED_RELEASE_REHEARSAL_PATH
nix --extra-experimental-features nix-command store verify \
  --store "$LEAN_BRIDGE_CACHE_URL" --recursive --sigs-needed 1 \
  --option trusted-public-keys "$LEAN_BRIDGE_CACHE_PUBLIC_KEY" \
  --option secret-key-files '' \
  "$LEAN_BRIDGE_PACKAGES_STORE"
```

This reads the remote cache and verifies NAR contents and trust without installing the package in the active store. Success exits `0`; a nonzero result identifies corruption, untrusted content, or a verification error. These audit commands temporarily accept only the selected public key and clear implicit trust from configured secret-key files; they do not edit system settings. Keep `--sigs-needed 1`: the default verification mode also accepts locally built paths without requiring signatures. Nix can authenticate content-addressed dependencies through their content addresses. Listing signatures with `path-info --sigs` alone does not verify them. [Store verification](https://nix.dev/manual/nix/2.24/command-ref/new-cli/nix3-store-verify), [Nix trusted-key loading](https://raw.githubusercontent.com/NixOS/nix/2.24.11/src/libstore/keys.cc).

A fresh temporary store proves that the closure can be fetched without using an already installed copy. It leaves the machine's active store intact:

```sh
LEAN_BRIDGE_FETCH_ROOT=$(mktemp -d /tmp/lean-bridge-nix-fetch.XXXXXX)
LEAN_BRIDGE_FETCH_STORE="local?root=$LEAN_BRIDGE_FETCH_ROOT&require-sigs=true"
nix --extra-experimental-features nix-command copy \
  --from "$LEAN_BRIDGE_CACHE_URL" --to "$LEAN_BRIDGE_FETCH_STORE" \
  --option trusted-public-keys "$LEAN_BRIDGE_CACHE_PUBLIC_KEY" \
  --option secret-key-files '' \
  "$LEAN_BRIDGE_PACKAGES_STORE"
nix --extra-experimental-features nix-command store verify \
  --store "$LEAN_BRIDGE_FETCH_STORE" --recursive --sigs-needed 1 \
  --option trusted-public-keys "$LEAN_BRIDGE_CACHE_PUBLIC_KEY" \
  --option secret-key-files '' \
  "$LEAN_BRIDGE_PACKAGES_STORE"
printf 'Verified fetched closure in %s\n' "$LEAN_BRIDGE_FETCH_ROOT"
```

`nix copy` downloads from the named cache and performs no compilation. The fresh store retains the logical `/nix/store` paths under its temporary root and requires trusted signatures. Do not add `--no-check-sigs`, `trusted=true`, or `require-sigs=false`. This is a download check; executables in a relocated store need its chroot environment. Retain the verification result, then remove only the printed temporary directory through your normal scratch cleanup process. [Local Nix stores](https://nix.dev/manual/nix/2.24/store/types/local-store).

### Consume the pinned flake revision

Use the reviewed 40-character commit from the release record, not a moving branch or an assumed published version. On a clean x86-64 Linux consumer configured for the cache:

```sh
LEAN_BRIDGE_SOURCE_REVISION=REPLACE_WITH_REVIEWED_40_CHARACTER_COMMIT
LEAN_BRIDGE_CONSUMED_STORE=$(nix --extra-experimental-features 'nix-command flakes' build \
  "github:seanmorris/lean-bridge/$LEAN_BRIDGE_SOURCE_REVISION#packages.x86_64-linux.release-rehearsal" \
  --no-update-lock-file --no-write-lock-file --print-out-paths \
  --out-link result-lean-bridge-packages \
  --extra-substituters "$LEAN_BRIDGE_CACHE_URL" \
  --extra-trusted-public-keys "$LEAN_BRIDGE_CACHE_PUBLIC_KEY" \
  --max-jobs 0 --builders '')
test "$LEAN_BRIDGE_CONSUMED_STORE" = "$LEAN_BRIDGE_PACKAGES_STORE"
```

`--max-jobs 0 --builders ''` prevents local and remote compilation of these release outputs for this substitution check. An absent or rejected output therefore fails instead of compiling a replacement. Nix still needs access to the pinned flake and its locked inputs for evaluation. Keep the printed store path equal to the approved record, then select its archive using [Use a prepared release](#check-the-release-files) and run the matching [consumer example](../consume.md). The output link protects the downloaded package from garbage collection. [Nix build options](https://nix.dev/manual/nix/2.24/command-ref/new-cli/nix3-build.html), [Nix build and substituter settings](https://nix.dev/manual/nix/2.24/command-ref/conf-file).


## Continue with your language

Choose a guide from [Use a Lean package](../consume.md). Each one starts with prepared-release installation and a complete application example.

## Start from a raw Lean package

Follow [Adapt an existing library](../lean/existing-package.md) to prepare an installable release.

### Build the example artifacts as a maintainer

Use the [contributor testing guide](../contributing/testing.md#build-the-example-artifacts-as-a-maintainer) for the repository's example packages.
