# Use the generated PHP package

The native package supports PHP 8.2 NTS on x86-64 Linux. It contains one generated Composer package, one Zend extension, and one process-owned Lean runtime library. PHP-Wasm provides an alternate transport for PHP 8.4 behind the same `LeanAlpha` classes and functions.

## Build the pinned native package

From the Lean Bridge checkout, build the Nix output:

```sh
nix --extra-experimental-features 'nix-command flakes' \
  build .#php-native-package \
  --out-link result-php-native
```

The flake pins Lean 4.32.2, PHP 8.2, Clang 17, libuv, OpenSSL, and the package manifest. The result contains:

```text
lib/liblean_bridge_native.so
lib/php/lean_alpha.so
share/php/component/composer.json
share/php/component/src/
share/php/component/stubs/
share/lean-bridge/release-manifest.json
share/lean-bridge/sha256.txt
```

The package targets the PHP non-thread-safe ABI. It does not support ZTS, AArch64, macOS, or Windows.

## Install Composer autoloading

Copy the generated Composer package into a writable clean consumer, then generate its autoloader without scripts:

```sh
export LEAN_BRIDGE_PHP_RESULT=$(readlink -f result-php-native)
export LEAN_BRIDGE_PHP_CONSUMER=$(mktemp -d)

cp -R "$LEAN_BRIDGE_PHP_RESULT/share/php/component" \
  "$LEAN_BRIDGE_PHP_CONSUMER/component"
chmod -R u+w "$LEAN_BRIDGE_PHP_CONSUMER/component"
composer dump-autoload \
  --working-dir "$LEAN_BRIDGE_PHP_CONSUMER/component" \
  --no-interaction \
  --no-scripts \
  --quiet
```

Create `$LEAN_BRIDGE_PHP_CONSUMER/index.php`:

```php
<?php
declare(strict_types=1);

require __DIR__ . '/component/vendor/autoload.php';

use LeanAlpha\Box;
use LeanAlpha\Bytes;
use LeanAlpha\Payload;
use function LeanAlpha\makeAdder;
use function LeanAlpha\roundTrip;
use function LeanAlpha\withCallback;

$box = new Box(41);
$same = $box->identity();
$payload = roundTrip(new Payload(
    false,
    8,
    'consumer',
    Bytes::fromString("\x00\x7f\xff"),
    [1, 5, 13],
));

$callbackResult = withCallback(40, static fn(int $value): int => $value);
$addTwo = makeAdder(2);
$closureResult = $addTwo(40);

assert($box->read() === 41);
assert($same === $box);
assert($payload->enabled === true);
assert($payload->count === 9);
assert($callbackResult === 42);
assert($closureResult === 42);

$addTwo->close();
$box->close();
```

Load only the packaged extension and execute the consumer:

```sh
php -n \
  -d "extension=$LEAN_BRIDGE_PHP_RESULT/lib/php/lean_alpha.so" \
  "$LEAN_BRIDGE_PHP_CONSUMER/index.php"
```

`Box` is an identity-bearing Lean resource. `identity()` returns its canonical PHP wrapper. `withCallback` invokes a PHP closure from Lean. `makeAdder` returns a Lean closure as an invokable PHP object. Call `close()` on both resources at a deterministic point. Garbage collection is fallback cleanup, not the resource lifecycle contract.

## Verify the native release

The release manifest and sorted SHA-256 inventory cover the Composer package, generated C sources, extension, runtime, reflection, and assurance metadata. The clean release test builds the package twice and compares every byte:

```sh
npm run test:php-native-package
```

The [native PHP release record](evidence/native-php-release-package.md) lists the observed ABI, package layout, execution checks, and limitations.

## PHP-Wasm alternate transport

PHP-Wasm uses the same public PHP source. The generated npm artifact supplies the shared Lean runtime, three Lean side modules, the PHP extension, Composer files, and loader metadata for the pinned PHP-Wasm 0.1.0 host.

After preparing the pinned Emscripten 3.1.68 and PHP 8.4 source inputs recorded in `poc/lean-link-spike/bindings/php-wasm.package.json`, build the artifact:

```sh
npm run build:php-wasm-package
```

Install it into a clean Node consumer with lifecycle scripts disabled:

```sh
export LEAN_BRIDGE_PHP_WASM_PACKAGE="$PWD/build/php-wasm-package"
export LEAN_BRIDGE_PHP_WASM_CONSUMER=$(mktemp -d)
cd "$LEAN_BRIDGE_PHP_WASM_CONSUMER"
npm init --yes
npm pkg set type=module
npm install --ignore-scripts --no-audit --no-fund \
  php-wasm@0.1.0 \
  "$LEAN_BRIDGE_PHP_WASM_PACKAGE"
```

A host selects the transport while PHP keeps the same generated API:

```js
import { PhpNode } from "php-wasm/PhpNode";
import leanAlpha from "php-wasm-lean-alpha";

const php = new PhpNode({ version: "8.4", sharedLibs: [leanAlpha] });
await php.binary;

const status = await php.run(`<?php
require_once '/vendor/autoload.php';
$box = new LeanAlpha\\Box(41);
$addTwo = LeanAlpha\\makeAdder(2);
assert($box->read() === 41);
assert(LeanAlpha\\withCallback(40, static fn(int $value): int => $value) === 42);
assert($addTwo(40) === 42);
$addTwo->close();
$box->close();
`);

if (status !== 0) throw new Error(`PHP exited with status ${status}`);
```

The lazy and startup profiles execute the same conformance corpus. The current host is Node-based PHP-Wasm. Browser PHP, broader libuv effects, other PHP versions, and ZTS remain outside the supported scope. Run the full two-build and two-profile check with:

```sh
npm run test:php-release
```

The [PHP release gate](evidence/php-release-gate.md) records package installation, real Lean execution, callback and closure behavior, shared runtime identity, and cleanup for native Zend and both PHP-Wasm profiles.
