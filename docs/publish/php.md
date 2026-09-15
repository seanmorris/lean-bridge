# Build and publish PHP packages

Build an ordinary Lake project with `--target php-native` for a self-contained Composer package. The separate Alpha recipes below build a Zend extension or Node-hosted PHP-Wasm package.

| Host | Build inputs | Package manager |
| --- | --- | --- |
| Ordinary PHP 8.2+ NTS CLI | Ordinary Lean source, the C author toolchain and PHP for syntax checks | Composer ZIP with bundled native libraries and automatic FFI loading |
| Native PHP 8.2 NTS | Reviewed PHP package manifest, generated bindings, Zend extension and native Lean toolchain | Composer, plus the matching native extension/runtime |
| Node-hosted PHP 8.4 Wasm | Reviewed profile manifest, pinned PHP source and Emscripten toolchain | npm, with Composer files installed inside PHP's virtual filesystem |

The Alpha recipes use repository-specific inputs. An ordinary Lake project's npm build does not produce a PHP package unless you also select `--target php-native`. Check the [source preparation and target boundaries](../lean/existing-package.md). Neither PHP profile is a universal registry-publisher target.

## Build an ordinary Lean project

Install the [C author toolchain](c.md#build-an-ordinary-lean-project) and PHP 8.2 or newer. Set `LEAN_BRIDGE_PHP` only if PHP is not on `PATH`. The package targets NTS CLI on Linux x86-64 with glibc 2.38 or newer and FFI enabled. PHP headers, `phpize` and a package-specific Zend extension are not required for this path.

Configure the project in `lean-bridge.exports.json`, using your own modules, exports and Composer coordinate:

```json
{
  "schemaVersion": 1,
  "modules": ["Clover"],
  "exports": ["Clover.echo_u32", "Clover.echo_nat", "Clover.echo_text", "Clover.array_u32"],
  "targets": { "php-native": { "name": "example/clover-api", "version": "2.0.0-RC.1" } }
}
```

Build into a new directory:

```sh
lean-bridge build --project ./clover --target php-native --output ./release-php
```

The build compiles Lean and the shared C adapter, generates and syntax-checks PHP, verifies the native artifacts, then produces `release-php/archives/example-clover-api-2.0.0-RC.1-linux-x86_64.zip`. The ZIP includes `composer.json`, PHP sources, compiled libraries, license notices, source identities and `lean-bridge/package-receipt.json`. Repeat another supported `--target` to share compilation. Every requested target must succeed before the release directory appears.

Use the [ordinary PHP consumer](../php.md#ordinary-project-packages) to install the ZIP with Composer and execute it outside the source tree. This path accepts pure copied primitives, arrays and acyclic records. It does not add FPM, ZTS, ordinary resources, callbacks or PHP-Wasm support. The [acceptance record](../evidence/native-php-copied-20260915.md) records the installed checks and hashes.

Distribute the original ZIP through a controlled release channel or a Composer repository. For a static Composer repository, use the generated `composer.json` as the version's package metadata and set `dist.type` to `zip` and `dist.url` to the immutable archive URL. Preserve the SHA-256 inventory and supply it through your authenticated handoff. This package needs no second native archive or extension configuration. Composer repository metadata and authentication use the same [publication procedure](#publish-to-the-private-https-repository).

Review the source library's license and bundled notices before publication; generated metadata does not grant redistribution rights. Native package receipts are unsigned build inventories, not universal transaction authorizations. The stock CLI has no Composer registry-upload adapter.

## Native PHP with Composer

The example Composer coordinate is `poc/lean-alpha@0.0.0`; its native build manifest uses `poc/lean-alpha-php-native@0.0.0`. Choose names and versions you own before producing a release.

### Choose the package identity and host

Use a package namespace and repository you control. The `poc/lean-alpha` name below identifies the generated example; do not register it publicly without ownership. Set the intended component name and version in the producer inputs before generating a public release. Renaming a completed archive does not change its package identity.

For a private test, keep the generated example name and use a team-controlled HTTPS repository. Replace `packages.example.org`, the SSH account, and the webroot in this guide with reviewed deployment values. Have the server administrator configure HTTPS, access controls, and an SSH host key you can verify before deploying files.

### Build and check the native package

Run from the Lean Bridge checkout with its pinned Nix environment:

```sh
nix --extra-experimental-features 'nix-command flakes' \
  build .#php-native-package --out-link build/publish-php-native
export LEAN_ALPHA_NATIVE_ROOT=$(readlink -f build/publish-php-native)
nix --extra-experimental-features 'nix-command flakes' develop . --command \
  node scripts/test-php-native-package-consumer.mjs \
  --package "$LEAN_ALPHA_NATIVE_ROOT"
```

The result contains `share/php/component/composer.json`, the generated PHP sources, `lib/php/lean_alpha.so`, and `lib/liblean_bridge_native.so`. The tested native profile is PHP 8.2 NTS on x86-64 Linux with glibc 2.38 or newer. Composer's PHP version constraint does not replace those native ABI requirements.

Inside an already configured pinned development environment, invoke the package builder directly instead of the Nix output:

```sh
node scripts/build-php-native-package.mjs \
  --manifest poc/lean-link-spike/bindings/php-native.package.json \
  --output build/publish-php-native-local
export LEAN_ALPHA_NATIVE_ROOT=$(realpath build/publish-php-native-local)
```

This compiles the extension and runtime from the PHP package manifest; it does not consume a universal `--bundle`.

Keep the package's `share/lean-bridge/release-manifest.json` and `sha256.txt`. Contributors reviewing changes across native and both PHP-Wasm profiles can run the [PHP release regression checks](../contributing/testing.md#consumer-acceptance). The [native release record](../evidence/native-php-release-package.md) describes the original package inventory.

### Prepare the Composer distribution

Use Composer 2 with ZIP support, Node 22, and GNU tar. Create a new output directory. Composer's `archive` command supports an explicit format, filename, and destination. [Composer archive reference](https://getcomposer.org/doc/03-cli.md#archive).

```sh
set -euo pipefail
export LEAN_ALPHA_COMPOSER_RELEASE="$PWD/build/publish-composer-0.0.0"
export LEAN_ALPHA_COMPOSER_URL=https://packages.example.org/lean-alpha/0.0.0
mkdir "$LEAN_ALPHA_COMPOSER_RELEASE"
mkdir "$LEAN_ALPHA_COMPOSER_RELEASE/dist"
composer --no-plugins --no-scripts archive \
  --working-dir "$LEAN_ALPHA_NATIVE_ROOT/share/php/component" \
  --format zip --file poc-lean-alpha-0.0.0 \
  --dir "$LEAN_ALPHA_COMPOSER_RELEASE/dist"
tar -C "$LEAN_ALPHA_NATIVE_ROOT" -czf \
  "$LEAN_ALPHA_COMPOSER_RELEASE/dist/lean-alpha-php-native-0.0.0.tar.gz" .
```

The ZIP contains the Composer package. The tarball preserves the complete native package, including the extension's relative library layout. These are new distribution archives; review their final hashes before uploading them. Their names do not establish a signed release identity.

Create `packages.json` from the generated Composer metadata, including its autoload declarations:

```sh
node --input-type=module <<'NODE'
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const output = process.env.LEAN_ALPHA_COMPOSER_RELEASE;
const root = process.env.LEAN_ALPHA_NATIVE_ROOT;
const base = process.env.LEAN_ALPHA_COMPOSER_URL;
if (!output || !root || !base?.startsWith('https://')) {
  throw new Error('Set the package root, release directory, and HTTPS repository URL');
}
const pkg = JSON.parse(await readFile(join(root, 'share/php/component/composer.json'), 'utf8'));
if (pkg.name !== 'poc/lean-alpha' || pkg.version !== '0.0.0') {
  throw new Error('Update the reviewed example filenames for this package identity');
}
const archive = 'poc-lean-alpha-0.0.0.zip';
const bytes = await readFile(join(output, 'dist', archive));
pkg.dist = {
  type: 'zip',
  url: `${base}/dist/${archive}`,
  shasum: createHash('sha1').update(bytes).digest('hex'),
};
await writeFile(join(output, 'packages.json'), JSON.stringify({
  packages: { [pkg.name]: { [pkg.version]: pkg } },
}, null, 2) + '\n', { flag: 'wx' });
NODE
(
  cd "$LEAN_ALPHA_COMPOSER_RELEASE/dist"
  sha256sum poc-lean-alpha-0.0.0.zip lean-alpha-php-native-0.0.0.tar.gz > SHA256SUMS
)
```

A static Composer repository lists package versions in `packages.json`, each with its generated metadata and a distribution URL. [Composer repository format](https://getcomposer.org/doc/05-repositories.md#composer).

The optional `dist.shasum` field supplies Composer's SHA-1 download check; retain the separately reviewed SHA-256 inventory as well. [Composer distribution schema](https://getcomposer.org/doc/04-schema.md#dist), [Composer download verification](https://github.com/composer/composer/blob/main/src/Composer/Downloader/FileDownloader.php).

### Publish to the private HTTPS repository

The following commands write to the remote server. Run them only after the owner approves the package names, platform, archive hashes, destination, and access policy. This example deploys one version into a new directory; it does not replace an existing repository index.

```sh
set -euo pipefail
export LEAN_ALPHA_PACKAGE_SSH=release@packages.example.org
ssh "$LEAN_ALPHA_PACKAGE_SSH" \
  'test ! -e /srv/www/packages/lean-alpha/0.0.0 && mkdir -p /srv/www/packages/lean-alpha/0.0.0/dist'
scp "$LEAN_ALPHA_COMPOSER_RELEASE/dist/poc-lean-alpha-0.0.0.zip" \
  "$LEAN_ALPHA_COMPOSER_RELEASE/dist/lean-alpha-php-native-0.0.0.tar.gz" \
  "$LEAN_ALPHA_COMPOSER_RELEASE/dist/SHA256SUMS" \
  "$LEAN_ALPHA_PACKAGE_SSH:/srv/www/packages/lean-alpha/0.0.0/dist/"
scp "$LEAN_ALPHA_COMPOSER_RELEASE/packages.json" \
  "$LEAN_ALPHA_PACKAGE_SSH:/srv/www/packages/lean-alpha/0.0.0/packages.json"
```

The server must map that directory to `https://packages.example.org/lean-alpha/0.0.0/`. Uploading the index last prevents Composer from seeing a package before its archive is present. OpenSSH documents the remote-path form used by [`scp`](https://man.openbsd.org/scp).

For a growing catalog, use [Satis or Private Packagist](https://getcomposer.org/doc/articles/handling-private-packages.md) to manage the index. Keep versioned archive URLs immutable. Configure consumer credentials through an ignored `auth.json` or secret-injected `COMPOSER_AUTH`; do not embed credentials in the repository URL or commit them in `composer.json`. [Composer authentication](https://getcomposer.org/doc/articles/authentication-for-private-packages.md).

### Confirm a downstream installation

Create a clean application with this `composer.json`, replacing the repository URL:

```json
{
  "name": "example/lean-php-consumer",
  "repositories": [
    { "type": "composer", "url": "https://packages.example.org/lean-alpha/0.0.0" }
  ],
  "require": { "poc/lean-alpha": "0.0.0" }
}
```

Install the PHP sources:

```sh
composer install --no-plugins --no-scripts --prefer-dist --no-interaction
```

Download the matching native tarball through the approved channel, compare it with the reviewed SHA-256, then extract it into a new directory. Set `LEAN_ALPHA_NATIVE_INSTALL` to that directory and test the installed Composer package:

```sh
export LEAN_ALPHA_NATIVE_INSTALL=/absolute/path/to/extracted-native-package
php -n -d "extension=$LEAN_ALPHA_NATIVE_INSTALL/lib/php/lean_alpha.so" -r '
require "vendor/autoload.php";
$box = new LeanAlpha\Box(41);
try {
    if ($box->read() !== 41) throw new RuntimeException("Unexpected Lean result");
    echo $box->read(), PHP_EOL;
} finally {
    $box->close();
}
'
```

Expected output is `41`. Retain the application lockfile and this installation result with the release review. Composer installs the PHP sources; the deployment loads the separately distributed extension. The [native PHP guide](../php.md#native-php) covers the complete API example and platform checks.

### Publish a public package through Packagist

Packagist indexes a public VCS repository. It discovers versions from tags; it does not accept an arbitrary ZIP upload as a package submission. [Packagist submission and versioning](https://packagist.org/about).

1. Prepare a publisher-owned package repository with the reviewed Composer export at its root. Include `composer.json`, generated sources and stubs, licensing information, and instructions locating the matching native release. Do not use the whole Lean Bridge repository as the package root.
2. Verify ownership of the intended vendor/package name. Generate and review that identity before publication; do not submit the example's `poc/lean-alpha` name as your own package.
3. After approval, push the reviewed export and a matching version tag. If the exported `composer.json` retains its generated `version`, the tag must agree with it. Packagist also supports omitting that field and deriving versions from tags; treat that export metadata change as part of the reviewed candidate.
4. Sign in to Packagist, submit the public repository URL, and enable its update hook. For later releases, push a new reviewed tag and confirm Packagist has indexed the intended version.
5. Install the exact package version in a clean application, verify the separately distributed native libraries, and run the check above.

Neither this VCS workflow nor the private index writes a Lean Bridge `registry-transaction.json` or signed `release-receipt.json`. If another reviewed release integration supplies a signed receipt for the exact distribution bytes, verify it through [Use a prepared release](../consume/receive-package.md). Do not manufacture one from an unsigned inventory or claim that the built-in publisher issued it.

### Recover an interrupted publication

If an upload stops before `packages.json` is visible, inspect the version directory and compare every existing archive with the reviewed hashes. Upload only missing files from the original release output, then publish the index. The initial deployment command refuses an existing directory; do not remove that check and rerun the whole upload blindly.

Once the index or Packagist tag is public, keep the published bytes unchanged. A package correction needs a new reviewed version. If Packagist has not discovered an approved tag, inspect its update status or use the maintainer's update action before creating another tag. Record the final download hashes and clean-install result after recovery.

## PHP-Wasm with npm

### Publish the PHP-Wasm profile


PHP-Wasm produces an npm package separately from the universal `npm` target. With the PHP sources and Emscripten environment prepared as in its [consumer and package guide](../php.md#php-wasm), build and pack one profile:

```sh
node scripts/build-php-wasm-package.mjs \
  --manifest poc/lean-link-spike/bindings/php-wasm.package.json \
  --php-source build/php-wasm-sdk/php8.4-src \
  --emsdk .toolchains/emsdk-php-wasm --output build/publish-php-wasm
mkdir build/publish-php-wasm-archives
npm pack ./build/publish-php-wasm --ignore-scripts \
  --pack-destination build/publish-php-wasm-archives
```

Use new output directories. The manifest's `graphLock.profile` selects lazy or startup loading. Both fixture profiles currently use `php-wasm-lean-alpha@0.0.0`; they cannot be uploaded as different bytes under that same coordinate. Select one profile, or regenerate distinct reviewed package identities before packaging. Contributors can check both profiles with the [PHP release regression checks](../contributing/testing.md#consumer-acceptance).

Freeze the resulting `.tgz`, record its profile and hash, then use the sandbox upload and download checks above. There is no universal `--target php-wasm`, and the universal `npm` target identifies `@lean-bridge/alpha`, not this package.


### Publish and verify the npm archive

Use the [npm package-manager instructions](npm.md#upload-to-your-sandbox) to authenticate, publish the exact approved archive, download it, and compare its bytes. Follow the same steps against your production registry only after your release owner approves that destination and version. A direct npm upload does not create a Lean Bridge signed transaction receipt.

Run the [PHP-Wasm consumer](../php.md#php-wasm) against the downloaded package. Keep the loader metadata, shared runtime, side modules, and Composer files together. The Node host and PHP virtual filesystem have separate paths.

### Recover a PHP-Wasm publication

Inspect an uncertain upload before retrying. Reuse the approved archive only when the registry coordinate is empty or holds identical bytes. Different bytes require a corrected version and release review. Keep the selected lazy or startup profile attached to its original identity. See [npm recovery](npm.md#recover-a-failed-upload).

## Verify the consumer handoff

Supply the package identity, PHP/runtime version, native platform or Wasm loading profile, and authenticated archive hashes. The [PHP consumer guide](../php.md) contains both installation paths and their complete programs. Maintainers can run the shared [PHP acceptance checks](../contributing/testing.md#consumer-acceptance).
