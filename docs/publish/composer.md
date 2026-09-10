# Publish PHP packages with Composer

Publish the native PHP package's generated sources through a Composer repository, and distribute its matching Zend extension and Lean runtime alongside them. PHP-Wasm uses an [npm package](npm.md), even though it installs Composer files inside PHP's virtual filesystem.

The native Alpha example has Composer coordinate `poc/lean-alpha@0.0.0`. Its build manifest uses `poc/lean-alpha-php-native@0.0.0`. Neither PHP profile is a target of the universal registry publisher. The commands below describe an operator-managed distribution after the [release review](production-release.md), not a `lean-bridge publish --target composer` command.

## Choose the package identity and host

Use a package namespace and repository you control. The `poc/lean-alpha` name below identifies the generated example; do not register it publicly without ownership. Set the intended component name and version in the producer inputs before generating a public release. Renaming a completed archive does not change its package identity.

For a private test, keep the generated example name and use a team-controlled HTTPS repository. Replace `packages.example.org`, the SSH account, and the webroot in this guide with reviewed deployment values. Have the server administrator configure HTTPS, access controls, and an SSH host key you can verify before deploying files.

## Build and check the native package

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

## Prepare the Composer distribution

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

## Publish to the private HTTPS repository

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

## Confirm a downstream installation

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

Expected output is `41`. Retain the application lockfile and this installation result with the release review. Composer installs the PHP sources; the deployment loads the separately distributed extension. The [native PHP guide](../consume/php-native.md) covers the complete API example and platform checks.

## Publish a public package through Packagist

Packagist indexes a public VCS repository. It discovers versions from tags; it does not accept an arbitrary ZIP upload as a package submission. [Packagist submission and versioning](https://packagist.org/about).

1. Prepare a publisher-owned package repository with the reviewed Composer export at its root. Include `composer.json`, generated sources and stubs, licensing information, and instructions locating the matching native release. Do not use the whole Lean Bridge repository as the package root.
2. Verify ownership of the intended vendor/package name. Generate and review that identity before publication; do not submit the example's `poc/lean-alpha` name as your own package.
3. After approval, push the reviewed export and a matching version tag. If the exported `composer.json` retains its generated `version`, the tag must agree with it. Packagist also supports omitting that field and deriving versions from tags; treat that export metadata change as part of the reviewed candidate.
4. Sign in to Packagist, submit the public repository URL, and enable its update hook. For later releases, push a new reviewed tag and confirm Packagist has indexed the intended version.
5. Install the exact package version in a clean application, verify the separately distributed native libraries, and run the check above.

Neither this VCS workflow nor the private index writes a Lean Bridge `registry-transaction.json` or signed `release-receipt.json`. If another reviewed release integration supplies a signed receipt for the exact distribution bytes, verify it through [Use a prepared release](../consume/receive-package.md). Do not manufacture one from an unsigned inventory or claim that the built-in publisher issued it.

## Recover an interrupted publication

If an upload stops before `packages.json` is visible, inspect the version directory and compare every existing archive with the reviewed hashes. Upload only missing files from the original release output, then publish the index. The initial deployment command refuses an existing directory; do not remove that check and rerun the whole upload blindly.

Once the index or Packagist tag is public, keep the published bytes unchanged. A package correction needs a new reviewed version. If Packagist has not discovered an approved tag, inspect its update status or use the maintainer's update action before creating another tag. Record the final download hashes and clean-install result after recovery.
