# Build and publish PHP packages

Build an ordinary Lake project with `--target php-native` for native PHP, or `--target php-wasm` for PHP hosted by Node or Chromium. The Alpha recipes below retain their separate Zend and loading profiles.

For ordinary-source builds, declare the library's [description, authors and URLs](../publishing.md#declare-package-metadata) once in `lean-bridge.exports.json`.

| Host | Build inputs | Package manager |
| --- | --- | --- |
| Ordinary PHP 8.2+ NTS CLI | Ordinary Lean source, the C author toolchain and PHP for syntax checks | Composer ZIP with bundled native libraries and automatic FFI loading |
| Ordinary PHP 8.4 Wasm in Node or Chromium | Ordinary Lean source and the pinned PHP-Wasm compiler inputs | npm component and shared-runtime archives, plus a companion Composer ZIP |
| Native PHP 8.2 NTS | Reviewed PHP package manifest, generated bindings, Zend extension and native Lean toolchain | Composer, plus the matching native extension/runtime |
| Node-hosted PHP 8.4 Wasm | Reviewed profile manifest, pinned PHP source and Emscripten toolchain | npm, with Composer files installed inside PHP's virtual filesystem |

Select a PHP target explicitly. `--target npm` alone produces JavaScript packages. Neither PHP target has a CLI registry-upload adapter.

Generated copied-value Composer packages declare `brick/math: 1.0.0`; the 32-bit Alpha package declares it too. Consumers receive `Brick\Math\BigInteger` directly. Publish the generated dependency declaration unchanged. Composer resolves Brick Math through the application's repositories and records it in the application lockfile. For an offline release, supply that dependency through the same local repository or a prepared cache.

PHP-Wasm npm packages bundle the pinned Brick Math sources and MIT license for hosts without Composer. The CLI includes those sources, so authors need no network access to assemble them. The bundled version and the Composer dependency are identical. No GMP or BCMath extension is required.

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

Use the [ordinary PHP consumer](../php.md#ordinary-project-packages) to install the ZIP with Composer and execute it outside the source tree. This path accepts copied primitives, arrays, Lists, records, concrete copied variants, options, results, nested binary products and synchronous callables with those payloads, including [finite recursive values](#export-recursive-callbacks). FPM, ZTS, resources and asynchronous delivery remain separate work. The [copied-value record](../evidence/native-php-copied-20260915.md), [compound record](../evidence/php-native-compounds-20260920.md) and [structured callback record](../evidence/php-structured-callables-20260925.md) record installed checks and archive identities.

Native PHP maps `Option` to `null` or a generated `Some`, `Except` to `Ok` or
`Err`, and each `Prod` to exactly two consecutive array elements. Branch classes
are final readonly, with one `$value` property. The generated API checks concrete
payload types without weak-mode coercion and copies nested values. Both ordinary
source and [reviewed contracts](../lean/existing-package.md#compile-a-reviewed-contract)
support these shapes. See the [consumer mappings](../php.md#options-results-and-products).
PHP-Wasm also supports these constructors with its 32-bit payload mappings.
Every selected target must admit the whole API in a combined build.

Native and PHP-Wasm builds also accept `List` parameters, results and record fields, including
combinations with the other copied types. Consumers use consecutive-key PHP
arrays with `list<T>` PHPDoc. Typed Lean helpers convert Lists without depending
on cons-cell layouts. [Installed List checks](../evidence/php-native-lists-20260921.md)
cover ordinary source and reviewed contracts. The [PHP-Wasm List checks](../evidence/php-wasm-lists-20260921.md)
cover the same shapes in Node and Chromium, including startup/lazy loading and
embedded/Composer PHP files. A List API can target both PHP transports; each
uses its own integer mappings. Both transports also accept Lists in callbacks
and returned functions.

Distribute the original ZIP through a controlled release channel or a Composer repository. For a static Composer repository, use the generated `composer.json` as the version's package metadata and set `dist.type` to `zip` and `dist.url` to the immutable archive URL. Supply the release-root `package-set-receipt.json`, its `.json.sha256` sidecar, and the original `archives/` paths for [Node-only verification](../consume/receive-package.md#verify-a-local-package-set). This package needs no second native archive or extension configuration. Composer repository metadata and authentication use the same [publication procedure](#publish-to-the-private-https-repository).

Review the source library's license and bundled notices before publication; generated metadata does not grant redistribution rights. Native package receipts are unsigned build inventories, not universal transaction authorizations. The stock CLI has no Composer registry-upload adapter.

### Export named copied aliases

Native Composer and PHP-Wasm builds preserve concrete copied alias names, targets and chains
from ordinary source or a compiler-checked reviewed contract:

```lean
namespace Scores
abbrev Count := UInt32
abbrev Counts := List Count
def increment (value : Count) : Count := value + 1
def reverse (values : Counts) : Counts := values.reverse
end Scores
```

Select `Scores.increment` and `Scores.reverse` in `exports`, then build with
`--target php-native` or `--target php-wasm`. Distribute the generated archives
unchanged. Their manifests contain both aliases, and the installed PHP source documents the original
parameter, result and record-field contracts. PHPDoc uses PHP target types;
the aliases create no wrapper classes. Consumers use the
[ordinary PHP values](../php.md#named-copied-aliases).

The PHP-Wasm handoff contains the component/runtime npm archives and a companion
Composer ZIP. The npm component contains `php/lean-bridge/aliases.json`; Composer
installs the same catalog at `lean-bridge/aliases.json`. The npm descriptor mounts
it beside its PHP files. UInt32-based aliases use
`Brick\Math\BigInteger` on wasm32, including inside Lists and record fields.
No extra publisher settings or consumer wrappers are needed.

A reviewed Binding IR contract must preserve alias definitions and references,
not replace them with flattened primitives. The builder compares them with
fresh Lean metadata before packaging. Targets must remain concrete, immutable
copied values. Acyclic packages use a 32-level depth bound; native recursive
packages use the [graph conversion bounds](../php.md#recursive-callback-values).
Both PHP transports accept concrete copied aliases in structured callbacks.
PHP-Wasm recursive callbacks and identity-bearing alias targets need separate support.

### Export copied variants

Native PHP and PHP-Wasm builds accept concrete, non-recursive copied variants from
ordinary Lean source or a compiler-checked reviewed contract:

```lean
namespace Variants
inductive Signal where
  | idle
  | stopped
  | data (count : UInt32) (label : String)
  | marker (value : Unit)
def echo_signal (value : Signal) : Signal := value
end Variants
```

Select `Variants.echo_signal` in `exports`, then build with
`--target php-native` or `--target php-wasm`. Native builds produce a Composer
ZIP. PHP-Wasm builds produce npm component/runtime archives and a companion
Composer ZIP. Distribute the original archives and their receipts.
Generated PHP contains an abstract readonly `Signal` family and final readonly
`SignalIdle`, `SignalStopped`, `SignalData` and `SignalMarker` classes. Payload
names remain `count`, `label` and `value`. Consumers construct these classes
without native tags or FFI declarations. The
[consumer example](../php.md#named-copied-variants) shows the installed API.

Payloads may mix primitives, admitted copied containers, records and variants.
Selected signatures must fit the existing schema-depth and conversion budgets.
PHP reserved names and case-insensitive class/function collisions reject before
generation. Use a Lean wrapper such as `echo_signal` for a function named
`echo`, which PHP reserves. Reviewed contracts must select that real wrapper;
changing only the reviewed metadata is not sufficient.

The same Lean API can target both PHP transports. PHP-Wasm uses `BigInteger`
for `UInt32` and `Int64` payloads as well as `UInt64`, `Nat`, `Int` and `USize`;
its `ISize` uses a signed 32-bit PHP integer. Constructor names and field names
remain the same. Generic, indexed, proof-bearing, recursive, callable and
identity-bearing payloads remain separate work. The
[native variant record](../evidence/php-native-variants-20260921.md) and
[PHP-Wasm variant record](../evidence/php-wasm-variants-20260921.md) cover both
source paths, weak and strict callers, relocation and conversion cleanup.

### Export native callbacks and returned functions

Select the callable exports alongside the other functions in `lean-bridge.exports.json`:

```lean
namespace Clover
def call_word (value : UInt32) (callback : UInt32 → UInt32) : UInt32 :=
  callback (callback value)
def make_word (captured value : UInt32) : UInt32 := captured + value
end Clover
```

Add `Clover.call_word` and `Clover.make_word` to `exports`. Set `"arities": { "Clover.make_word": 1 }` so `make_word` accepts the captured value and returns the remaining function. A reviewed Binding IR contract records that choice through its outer parameter count; do not also configure `arities` for that path.

The native FFI adapter supports one to sixteen arguments and a result using primitive or finite copied types, including recursive records and variants. Its PHP API accepts callables and returns invokable `LeanClosure` objects with `close()` and `isClosed()`. Composer installs the same pinned Brick Math dependency used by copied values. The private C callable ABI handles borrowing and owned closures. See the [consumer example](../php.md#native-callbacks-and-returned-functions) for lifetime, exception and execution-context rules.

The PHP-Wasm Zend adapter accepts the same primitive and acyclic copied signatures and `arities` settings. It uses the 32-bit mappings in the [PHP conversion table](../php.md#type-conversions), including `BigInteger` for UInt32 and Int64. Both targets preserve the original callback `Throwable` after Lean cleanup. A combined build rejects signatures that any selected target cannot implement.

### Export structured callbacks

For native PHP and PHP-Wasm, use concrete copied types directly in the callback signature:

```lean
namespace Structured
def callArray (value : Array (Option String))
    (callback : Array (Option String) → Array (Option String)) :
    Array (Option String) := callback value

def makeOption (captured : Option (Option Unit)) (useCaptured : Bool)
    (value : Option (Option Unit)) : Option (Option Unit) :=
  if useCaptured then captured else value
end Structured
```

Select `Structured.callArray` and `Structured.makeOption`, and set
`"arities": { "Structured.makeOption": 1 }`. Build with `--target php-native`
or `--target php-wasm` after configuring that target's package coordinates.
Consumers call `call_array` and `make_option` through the generated public API;
the [PHP example](../php.md#structured-callback-values) preserves `Some None`
separately from `None`.

Arrays, Lists, options, results, products, acyclic records, variants and aliases
compose in these signatures. Callbacks borrow their PHP callable for one
synchronous call and copy its values. Returned functions own a lease and captured
copies. Consumers need no C declarations, manual marshalling or JSON transport.
Identity-bearing fields, async callbacks and retained host callbacks remain
unsupported. Native recursive payloads use the graph adapter below. PHP-Wasm
recursive callbacks remain unsupported. PHP-Wasm copies every nested reply buffer
before PHP releases the reply and Lean finishes copying it.

### Export recursive callbacks

Native Composer builds accept finite recursive callback values from ordinary
source and compiler-checked reviewed contracts. Save this as `Structured.lean`:

```lean
namespace Structured
inductive Tree where
  | leaf (value : Nat)
  | branch (children : Array Tree)

def callRecursive (value : Tree) (callback : Tree → Tree) := callback value
def makeRecursive (captured : Tree) : Bool → Tree → Tree :=
  fun selected value => if selected then captured else value
end Structured
```

Select the two exports and the capture arity in `lean-bridge.exports.json`:

```json
{
  "schemaVersion": 1,
  "modules": ["Structured"],
  "exports": ["Structured.callRecursive", "Structured.makeRecursive"],
  "arities": { "Structured.makeRecursive": 1 },
  "targets": { "php-native": { "name": "lean-bridge/structured", "version": "1.0.0" } }
}
```

Use your own Composer coordinate for publication. Build with
`lean-bridge build --project ./structured --target php-native --output ./release-php`.
Consumers install the resulting ZIP with Composer and use
[`call_recursive` and `make_recursive`](../php.md#recursive-callback-values).
The package includes native libraries; consumers need no Lean compiler, C
headers, FFI declarations or manual runtime setup.

Recursive records, variants and copied aliases compose with the existing
primitive and acyclic callback types. Returned functions own their captured
values. Validation rejects cycles and preserves nominal classes and Option
presence. Conversion uses the [documented graph bounds](../php.md#recursive-callback-values).
PHP-Wasm recursive callbacks and identity-bearing aggregate fields remain
separate work. The Composer distribution and package-manager instructions below
apply unchanged.

## Build an ordinary PHP-Wasm package

PHP-Wasm compiles concrete copied variants, Lists, options, results and nested binary products on ordinary-source and reviewed-IR paths. These compose with primitives, arrays and acyclic records, including in synchronous callbacks and captured closures. Generated `Some`, `Ok` and `Err` classes preserve branch identity; products use two-element arrays. The [PHP consumer guide](../php.md#options-results-and-products) documents payload validation and 32-bit integer mappings.

Install a [prepared CLI](../lean/setup.md#install-a-prepared-cli) whose inventory has `phpWasmInputsIncluded: true`. It contains the prebuilt PHP-Wasm runtime and configured PHP 8.4.1 headers. Leave `LEAN_BRIDGE_PHP_INPUTS` unset to use those bundled inputs.

Callable exports require compiler inputs containing the callback registry. The builder rejects older inputs with a rebuild diagnostic; the ordinary copied-only profile can still use them. Contributors can rebuild the bundle using the [PHP-Wasm toolchain instructions](../contributing/author-toolchain.md#php-wasm). Distribute the matching runtime archive with the new component.

Authors still need Lean 4.32.2 and the bundle's pinned Emscripten 3.1.68 installation:

```sh
export LEAN_BRIDGE_LEAN_PREFIX=/absolute/path/to/lean-4.32.2
export LEAN_BRIDGE_PHP_EMSDK=/absolute/path/to/emsdk-3.1.68
```

The Emsdk checkout must match the commit in `runtime/runtime.json`; the builder also checks compiler-file hashes. These inputs have been exercised on Linux x86-64. No Lean Bridge checkout, PHP configure tools or Lean target archives are needed for this prepared path. Consumers need none of these author tools.

If the CLI does not include PHP-Wasm inputs, obtain the separate compiler-input archive and its expected SHA-256 through your trusted release channel. Compare `sha256sum /absolute/path/to/inputs.tgz` with that expected hash before extracting it into a new directory:

```sh
export LEAN_BRIDGE_PHP_INPUT_WORK=$(mktemp -d)
tar -xzf /absolute/path/to/inputs.tgz -C "$LEAN_BRIDGE_PHP_INPUT_WORK"
export LEAN_BRIDGE_PHP_INPUTS="$LEAN_BRIDGE_PHP_INPUT_WORK/php-wasm-compiler-inputs"
```

`lean-bridge build` checks the bundle manifest, its hash sidecar, every file, runtime compatibility and configured header identity before compilation. The sidecar alone does not authenticate a publisher. Do not combine `LEAN_BRIDGE_PHP_INPUTS` with `LEAN_BRIDGE_PHP_SOURCE`, `LEAN_BRIDGE_PHP_COPIED_RUNTIME` or `LEAN_BRIDGE_PHP_LEAN_RUNTIME`. Explicit raw-input overrides select the [checkout-based contributor setup](../contributing/author-toolchain.md#php-wasm) when no bundle override is set.

The [compiler-input acceptance record](../evidence/php-wasm-inputs-20260915.md) covers bundled and separate inputs, relocated builds and installed execution.

Give the npm component and Composer API separate coordinates in `lean-bridge.exports.json`:

```json
{
  "schemaVersion": 1,
  "modules": ["SharedApi"],
  "exports": ["SharedApi.echo_u32", "SharedApi.echo_nat"],
  "targets": {
    "php-wasm": {
      "npm": { "name": "@example/willow-php-wasm", "version": "2.0.0-RC.1" },
      "composer": { "name": "example/willow-php-wasm", "version": "2.0.0-RC.1" }
    }
  }
}
```

Use your own module and export names. Build into an absent directory:

```sh
lean-bridge build --project ./willow --target php-wasm --output ./release-php-wasm
```

The build checks fresh Lean metadata and wasm32 C layouts, compiles a PHP extension, and produces:

| Path under `release-php-wasm/` | Contents |
| --- | --- |
| `php-wasm-release.json` | Source, configuration, runtime and archive identities |
| `php-wasm/runtime/` and `php-wasm/component/` | Verified compiled inputs and their evidence |
| `packages/php-wasm/archives/` | npm runtime and component `.tgz` files, plus the Composer `.zip` |
| `packages/php-wasm/php-wasm-package-set.json` | Exact package files and archive hashes |
| `package-set-receipt.json` and `package-set-receipt.json.sha256` | Node-only CLI receipt covering all three archives and their exact in-set dependencies |

The npm component declares its exact shared-runtime dependency. Its default descriptor registers the extension and bundled PHP sources before startup. Its named `lazy` descriptor defers the extension and Lean runtime until the first valid API call. Consumers choose the loading mode from the same archive; no second build or author setting is needed. Composer applications use the companion ZIP with `extensions` or `lazy.extensions`. Follow the [installed consumer example](../php.md#ordinary-php-wasm-packages).

`runtime/package/runtime-identity.json` binds the shared-runtime version to its compiled file bytes, loaders, package generator, notices and packing environment. The packing record includes the archive implementation, fixed timestamp, Node/zlib/ICU versions, platform, architecture and default collation locale. Keep that environment when reproducing the archives. Changing it, or even reformatting the packaged runtime manifest, produces a new runtime version and component dependency. Consumer installation and `lean-bridge verify` on the portable `package-set-receipt.json` need no matching producer environment. See the [runtime packing audit](../evidence/runtime-packing-identities-20260916.md).

Pure copied primitives, arrays and acyclic records are supported. On this 32-bit PHP host, `UInt32` and `Int64` use `BigInteger`, as do `UInt64`, `Nat` and `Int`. Startup and first-call loading execute in Node 22 and Chromium with `php-wasm` 0.1.0. The [browser example](../php.md#run-in-a-browser) bundles Lean assets with Vite and serves the PHP host unchanged. The [acceptance record](../evidence/php-wasm-lazy-20260915.md) covers deferred downloads, runtime sharing and loading failures.

Both native PHP and PHP-Wasm can compile an [explicit reviewed copied-value contract](../lean/existing-package.md#compile-a-reviewed-contract). Keep one `.binding-ir.json` file, select its source `modules`, and remove `exports` from the shared configuration. The builder compares the reviewed API with fresh Lean metadata before generating PHP. Receipts retain the review alongside the compiler evidence. The prepared Composer/npm packages and consumer loading steps remain the same.

### Combine PHP-Wasm with other targets

For an API accepted by every selected target:

```sh
lean-bridge build --project ./telemetry --output ./release-all \
  --target npm --target php-native --target php-wasm
```

Lean compiles once for JavaScript-Wasm, once for native code, and once for PHP-Wasm. The builder compares their source API and captures one source/dependency snapshot. It exposes the release only after every requested target succeeds. Arrays and records can combine native targets with PHP-Wasm; adding npm currently requires the ordinary scalar API.

`multi-profile-release.json` lists every profile, archive and receipt. Releases containing PHP-Wasm use manifest version 2. PHP-Wasm files live under `profiles/php-wasm/`; native files remain under `profiles/native/`, and JavaScript archives remain under `packages/npm/`. The three ABIs retain separate runtimes. The root `package-set-receipt.json` covers the combined archive tree; verify it with `lean-bridge verify --receipt ./release-all/package-set-receipt.json`. Give JavaScript and PHP-Wasm distinct npm names, and native PHP and PHP-Wasm distinct Composer names. A collision stops the build before exposing the release.

### Distribute the ordinary packages

Choose package names you control before building. Publish the approved npm runtime archive first if its exact version is absent, then the component archive, using the [npm ownership and upload procedure](npm.md#publish-to-the-public-npm-registry). Publishing the `@lean-bridge` runtime requires that scope's publisher; application authors use its approved runtime release. Keep the generated runtime name and content-bound version. Do not overwrite an existing version with different bytes.

Publish the Composer ZIP through your authenticated artifact channel or a Composer repository, using its generated `composer.json` and immutable ZIP URL as described for [native packages](#build-an-ordinary-lean-project). Supply the root `package-set-receipt.json`, its `.json.sha256` sidecar, and all named archives with their original relative paths. Recipients run `lean-bridge verify --receipt ./release-php-wasm/package-set-receipt.json` using only Node. The existing `php-wasm-package-set.json` remains a producer inventory; the CLI accepts the new ecosystem-neutral receipt. Both records are unsigned.

Download and install the exact uploaded archives in a separate application, then run the consumer example. The [public CLI acceptance record](../evidence/php-wasm-cli-20260915.md) covers installed packages and combined builds.

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

Freeze the resulting `.tgz`, record its profile and hash, then use the sandbox upload and download checks above. The ordinary `--target php-wasm` command builds the copied startup profile. This Alpha recipe uses separate manifests, and the universal `npm` target identifies `@lean-bridge/alpha`, not this package.


### Publish and verify the npm archive

Use the [npm package-manager instructions](npm.md#upload-to-your-sandbox) to authenticate, publish the exact approved archive, download it, and compare its bytes. Follow the same steps against your production registry only after your release owner approves that destination and version. A direct npm upload does not create a Lean Bridge signed transaction receipt.

Run the [PHP-Wasm consumer](../php.md#php-wasm) against the downloaded package. Keep the loader metadata, shared runtime, side modules, and Composer files together. The Node host and PHP virtual filesystem have separate paths.

### Recover a PHP-Wasm publication

Inspect an uncertain upload before retrying. Reuse the approved archive only when the registry coordinate is empty or holds identical bytes. Different bytes require a corrected version and release review. Keep the selected lazy or startup profile attached to its original identity. See [npm recovery](npm.md#recover-a-failed-upload).

## Verify the consumer handoff

Supply the package identity, PHP/runtime version, native platform or Wasm loading profile, and authenticated archive hashes. The [PHP consumer guide](../php.md) contains both installation paths and their complete programs. Maintainers can run the shared [PHP acceptance checks](../contributing/testing.md#consumer-acceptance).
