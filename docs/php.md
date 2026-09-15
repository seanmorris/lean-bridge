# PHP

Install the package for the PHP runtime that executes your application. Ordinary native packages load their bundled Lean runtime automatically. Ordinary PHP-Wasm packages register it with the host before startup. Consumers do not build Lean.

## Use a prepared release

| Application | Installation | Tested runtime |
| --- | --- | --- |
| Ordinary native PHP CLI package | [Composer archive](#ordinary-project-packages) | PHP 8.2+ NTS CLI, Linux x86-64, FFI enabled, glibc 2.38 or newer |
| Ordinary PHP-Wasm package | [npm and optional Composer archive](#ordinary-php-wasm-packages) | Node 22, PHP 8.4, `php-wasm` 0.1.0, startup loading |
| Native PHP CLI or deployment | [Native PHP](#native-php) | PHP 8.2 NTS, x86-64 Linux, glibc 2.38 or newer |
| PHP hosted by Node | [PHP-Wasm](#php-wasm) | Node 22, PHP 8.4, `php-wasm` 0.1.0 |

The Alpha native package includes an extension, Lean runtime, and Composer library. PHP-Wasm uses an npm archive containing side modules and loader metadata. The Wasm consumer profile covers Node hosting, not browser-hosted PHP.

### Ordinary project packages

Use PHP 8.2 or newer (below 9), NTS CLI on Linux x86-64 with glibc 2.38 or newer. PHP's FFI extension must be installed and enabled. The default `ffi.enable=preload` permits CLI use. This package path does not yet cover FPM, Apache, PHP's development server, ZTS or PHP-Wasm. [PHP FFI configuration](https://www.php.net/manual/en/ffi.configuration.php).

Authenticate your publisher's archive using [Use a prepared release](consume/receive-package.md). This example uses the Clover acceptance package. Put `example-clover-api-2.0.0-RC.1-linux-x86_64.zip` in a `releases/` directory. Use Composer 2 with its ZIP extension for the local artifact repository. Save this as `composer.json`:

```json file=php-native/ordinary/composer.json
{
  "name": "example/lean-php-consumer",
  "repositories": [
    { "packagist.org": false },
    { "type": "artifact", "url": "./releases" }
  ],
  "require": { "example/clover-api": "2.0.0-RC.1" }
}
```

Run `composer install --no-plugins --no-scripts --prefer-dist`. Composer reads the package metadata from the ZIP and installs the PHP files and native libraries together. A registry installation uses your publisher's repository and exact package version instead. [Composer artifact repositories](https://getcomposer.org/doc/05-repositories.md#artifact).

Save this as `main.php`:

```php file=php-native/ordinary/main.php
<?php
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use LeanClover\BigInteger;
use function LeanClover\{array_u32, echo_nat, echo_text, echo_u32};

$large = BigInteger::fromDecimal('184467440737095516160000000001');
if (echo_u32(42) !== 42
    || (string) echo_nat($large) !== (string) $large
    || echo_text("Lean λ\0") !== "Lean λ\0"
    || array_u32([0, 4294967295]) !== [0, 4294967295]) {
    throw new RuntimeException('Lean returned an unexpected result');
}
echo '42; exact integers and copied arrays', PHP_EOL;
```

Run `php main.php`. Expected output is `42; exact integers and copied arrays`. You do not need Lean, C headers, a package-specific extension or runtime paths. Keep the installed package directory intact; it can move with your application.

Ordinary packages support pure functions over 16 primitive types, arrays and acyclic records. `Unit` is `null`. Fixed-width integers use PHP `int`, except `UInt64`, which uses `BigInteger`; `Nat` and `Int` use it too. `BigInteger::fromDecimal` accepts canonical decimal text up to 16,384 digits. `Bytes::fromString` preserves arbitrary binary data. Arrays are consecutive-key lists, and records are final readonly classes. Results own independent copied values.

Parameters use `mixed` with precise PHPDoc so generated checks can reject numeric coercion even in weak caller mode. Invalid types raise `TypeError`; range and conversion limits raise `ValueError`; native failures raise the package's `LeanBridgeError`. `Float32` rounds PHP floats to binary32; floating-point conversions preserve NaN classification, infinities and signed zero.

Validation, PHP conversion and native copying each have a 16 MiB accounting limit. PHP lists count at least 32 bytes per element. These limits do not bound Lean working memory. `finally` releases native outputs after conversion errors. Compatible packages share one process runtime; post-fork calls and already loaded foreign Lean runtimes are rejected. Loading needs readable `/proc/self/maps` to detect foreign runtime mappings. See [installed PHP evidence](evidence/native-php-copied-20260915.md).

### Ordinary PHP-Wasm packages

Use Node 22 and `php-wasm` 0.1.0 with PHP 8.4's default variant. Authenticate the publisher's archives and `php-wasm-package-set.json` through your release channel. The package set contains two npm archives, one component and its shared runtime, plus a companion Composer ZIP. No Lean tools, PHP headers or Emscripten installation are needed.

Install the two npm `.tgz` files from your release directory along with the host:

```sh
npm install --ignore-scripts --no-audit --no-fund \
  ./releases/lean-bridge-php-wasm-copied-runtime-*.tgz \
  ./releases/example-willow-php-wasm-2.0.0-RC.1.tgz \
  php-wasm@0.1.0
```

Keep only the reviewed runtime archive in that directory. From a registry, install your publisher's exact component version and `php-wasm@0.1.0`; npm resolves the exact runtime dependency automatically.

For the Willow acceptance package, save this as `main.mjs`:

```js file=php-wasm/ordinary/main.mjs
/**
 * Execute an installed ordinary Lean API in PHP-Wasm.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { PhpNode } from 'php-wasm/PhpNode.mjs';
import api from '@example/willow-php-wasm';

const php = new PhpNode({ version: '8.4', sharedLibs: [api] });
php.addEventListener('output', event => {
  for(const part of event.detail) process.stdout.write(part);
});
php.addEventListener('error', event => {
  for(const part of event.detail) process.stderr.write(part);
});
const status = await php.run(String.raw`<?php
require_once '${api.autoload}';
use LeanWillow\BigInteger;
echo LeanWillow\echo_u32(BigInteger::fromDecimal('4294967295'));
`);
assert.equal(status, 0);
```

Run `node main.mjs`. Expected output is `4294967295`. Register every component in `sharedLibs` before accessing `php.binary` or running PHP. Compatible packages share one runtime; duplicate registration does not reload an extension. Different runtime identities fail before startup.

#### Copied type conversions

These mappings apply to ordinary copied packages. The Alpha tables later on this page retain their separate profile.

| Lean type | PHP-Wasm value | Rules |
| --- | --- | --- |
| `Unit` | `null` | Arguments, results and fields |
| `Bool` | `bool` | No integer coercion |
| `UInt8`, `UInt16`, `Int8`, `Int16`, `Int32` | `int` | Exact width and range checks |
| `UInt32`, `UInt64`, `Int64`, `Nat`, `Int` | Generated `BigInteger` | Canonical decimal input; exact values across the 32-bit host boundary |
| `Float32`, `Float` | `float` | Binary32 rounding for `Float32`; NaN, infinities and signed zero preserved |
| `String` | `string` | Valid UTF-8, including embedded NUL |
| `ByteArray` | Generated `Bytes` | Arbitrary binary data |
| `Array T` | PHP list | Consecutive keys; recursively checked copied elements |
| Acyclic Lean record | Generated readonly class | Named fields and independent copied results |

Invalid types raise `TypeError`; out-of-range values and conversion limits raise `ValueError`. Native conversion failures raise the package's `LeanBridgeError`. Converted input and output have separate 16 MiB accounting limits; those limits do not bound Lean's working memory.

#### Use the companion Composer API

Install the matching Composer ZIP using the [artifact-repository setup](#ordinary-project-packages), with its own coordinate, `example/willow-php-wasm:2.0.0-RC.1`. When Composer runs on a native host, set `config.platform.php` to `8.4.1` for this Wasm application. Use the npm descriptor's `extensions` export in `sharedLibs`, mount your installed `vendor/` directory into the PHP virtual filesystem, then require that mounted `vendor/autoload.php`. The default descriptor already supplies the PHP files and needs no Composer install; do not preload a second copy.

The [installed tests](evidence/php-wasm-cli-20260915.md) execute both arrangements and Vite-bundled assets in Node. Browser-engine execution and lazy loading are not yet covered for ordinary packages.

## Native PHP

### Native PHP prerequisites

Use PHP 8.2 NTS on x86-64 Linux with glibc 2.38 or newer, plus Composer 2. The extension targets PHP module API `20220829`. ZTS, other PHP versions, and other native platforms require a different build and are not covered by this package's acceptance tests.

Check the PHP executable that will run the application:

```sh
php -n -v
php -n -r 'echo PHP_VERSION, " NTS=", PHP_ZTS ? "no" : "yes", PHP_EOL;'
getconf GNU_LIBC_VERSION
```

### Obtain the package

Request the native Alpha package `poc/lean-alpha-php-native@0.0.0`. For a distributed archive, follow [Use a prepared release](consume/receive-package.md) before extracting it or loading native code. Set `LEAN_ALPHA_PHP_PACKAGE` to the extracted directory containing `lib/` and `share/`:

```sh
export LEAN_ALPHA_PHP_PACKAGE=/absolute/path/to/extracted-native-package
test -f "$LEAN_ALPHA_PHP_PACKAGE/lib/php/lean_alpha.so"
test -f "$LEAN_ALPHA_PHP_PACKAGE/share/php/component/composer.json"
```

### Install the Composer files

Create a new directory outside the extracted package:

```sh
mkdir lean-alpha-php-example
cd lean-alpha-php-example
cp -R "$LEAN_ALPHA_PHP_PACKAGE/share/php/component" ./component
chmod -R u+w ./component
composer dump-autoload \
  --working-dir ./component \
  --no-interaction --no-scripts --quiet
```

Composer generates the autoloader for the included sources. The shared runtime and extension remain in the package directory; keep its `lib/` layout intact.

### Run the program

Save this as `main.php` beside `component/`:

```php file=php-native/main.php
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
$addTwo = null;
try {
    $payload = roundTrip(new Payload(
        false, 8, 'consumer', Bytes::fromString("\x00\x7f\xff"), [1, 5, 13],
    ));
    $addTwo = makeAdder(2);
    $result = [
        'box' => $box->read(),
        'identity' => $box->identity() === $box,
        'payload' => [
            $payload->enabled, $payload->count, $payload->label,
            bin2hex($payload->bytes->toString()), $payload->values,
        ],
        'callback' => withCallback(40, static fn(int $value): int => $value),
        'closure' => $addTwo(40),
    ];
    $expected = [
        'box' => 41,
        'identity' => true,
        'payload' => [true, 9, 'consumer', '007fff', [1, 5, 13]],
        'callback' => 42,
        'closure' => 42,
    ];
    if ($result !== $expected) {
        throw new RuntimeException('Lean Alpha returned an unexpected result');
    }
    echo json_encode($result, JSON_THROW_ON_ERROR), PHP_EOL;
} finally {
    try {
        $addTwo?->close();
    } finally {
        $box->close();
    }
}
```

Load the extension and execute the file:

```sh
php -n -d "extension=$LEAN_ALPHA_PHP_PACKAGE/lib/php/lean_alpha.so" main.php
```

Expected output:

```json
{"box":41,"identity":true,"payload":[true,9,"consumer","007fff",[1,5,13]],"callback":42,"closure":42}
```

The program uses explicit checks, so it fails even when PHP assertions are disabled. Alpha's `roundTrip` flips the Boolean and increments the count. `withCallback(40, identity)` returns `42`; `makeAdder(2)` returns a callable that adds two.

### Native PHP ownership and errors

`Payload` is a copied PHP value. Its text remains UTF-8 text, `Bytes` preserves binary data, and `values` is a typed list. The transport does not encode the record as JSON; this example uses JSON only to print its result.

`Box` owns a Lean resource. `identity()` returns the same PHP wrapper, so closing either reference closes that resource. The returned callable also owns a Lean value. Close both in `finally`; their destructors provide fallback cleanup. Repeated `close()` calls are allowed, and using a closed wrapper raises `LeanAlpha\DisposedResource`.

Generated validators reject incorrect PHP types and out-of-range values. Callback exceptions cross back to the PHP caller. Catch errors at your application boundary and keep cleanup in `finally`.

### Native PHP troubleshooting

- **Unable to load the extension:** check the PHP version, NTS setting, CPU architecture, and glibc version. Keep `lib/php/lean_alpha.so` beside the packaged `lib/liblean_bridge_native.so` layout.
- **The `LeanAlpha` classes are missing:** run Composer in `component/` and require `component/vendor/autoload.php` from the application.
- **No output from an older example:** run the complete program above. It prints results and uses unconditional comparisons instead of PHP's configurable `assert()`.


## PHP-Wasm

### PHP-Wasm prerequisites

Use Node 22 and npm with `php-wasm` version `0.1.0`. This guide selects PHP `8.4`, the version covered by the PHP-Wasm consumer profile. Browser-hosted PHP and other PHP versions need separate acceptance work.

The application uses a completed package and needs no Emscripten or PHP compiler.

### Obtain and install the package

Request the Alpha npm archive `php-wasm-lean-alpha@0.0.0`. [Authenticate the archive](consume/receive-package.md) before installation. The lazy and startup builds share the npm coordinate but have distinct archive subjects and graph profiles in their release receipts. Choose one profile and verify its exact archive.

The following commands expect an authenticated archive at an absolute path:

```sh
export LEAN_ALPHA_PHP_WASM_ARCHIVE=/absolute/path/to/php-wasm-lean-alpha-0.0.0.tgz
mkdir lean-alpha-php-wasm-example
cd lean-alpha-php-wasm-example
```

Create `package.json`:

```json file=php-wasm/package.json
{
  "name": "lean-alpha-php-wasm-example",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node main.mjs"
  }
}
```

Install the exact host version and the archive, with lifecycle scripts disabled:

```sh
npm install --save-exact --ignore-scripts --no-audit --no-fund \
  php-wasm@0.1.0 "$LEAN_ALPHA_PHP_WASM_ARCHIVE"
```

Keep the resulting lockfile with your application.

### Write the PHP program

Save this as `main.php`:

```php file=php-wasm/main.php
<?php
declare(strict_types=1);

require_once '/vendor/autoload.php';

use LeanAlpha\Box;
use LeanAlpha\Bytes;
use LeanAlpha\Payload;
use function LeanAlpha\makeAdder;
use function LeanAlpha\roundTrip;
use function LeanAlpha\withCallback;

$box = new Box(41);
$addTwo = null;
try {
    $payload = roundTrip(new Payload(
        false, 8, 'consumer', Bytes::fromString("\x00\x7f\xff"), [1, 5, 13],
    ));
    $addTwo = makeAdder(2);
    $result = [
        'box' => $box->read(),
        'identity' => $box->identity() === $box,
        'payload' => [
            $payload->enabled, $payload->count, $payload->label,
            bin2hex($payload->bytes->toString()), $payload->values,
        ],
        'callback' => withCallback(40, static fn(int $value): int => $value),
        'closure' => $addTwo(40),
    ];
    $expected = [
        'box' => 41,
        'identity' => true,
        'payload' => [true, 9, 'consumer', '007fff', [1, 5, 13]],
        'callback' => 42,
        'closure' => 42,
    ];
    if ($result !== $expected) {
        throw new RuntimeException('Lean Alpha returned an unexpected result');
    }
    echo json_encode($result, JSON_THROW_ON_ERROR), PHP_EOL;
} finally {
    try {
        $addTwo?->close();
    } finally {
        $box->close();
    }
}
```

The package loader places its Composer files in PHP's virtual filesystem. `/vendor/autoload.php` belongs to that filesystem, not the Node process's host filesystem.

### Start the host and capture output

Save this as `main.mjs`:

```js file=php-wasm/main.mjs
/**
 * Runs the Alpha PHP program inside the installed PHP-Wasm host.
 *
 * @file
 */

import { readFile } from "node:fs/promises";
import { PhpNode } from "php-wasm/PhpNode";
import leanAlpha from "php-wasm-lean-alpha";

const php = new PhpNode({ version: "8.4", sharedLibs: [leanAlpha] });
let stdout = "";
let stderr = "";
php.addEventListener("output", event => {
	for(const chunk of event.detail) stdout += chunk;
});
php.addEventListener("error", event => {
	for(const chunk of event.detail) stderr += chunk;
});

await php.binary;
const source = await readFile(new URL("./main.php", import.meta.url), "utf8");
await php.writeFile("/main.php", source);
const status = await php.run("<?php require '/main.php';");
if(status !== 0 || stderr !== "")
{
	throw new Error(`PHP failed with status ${status}: ${stderr || stdout}`);
}
process.stdout.write(stdout.endsWith("\n") ? stdout : `${stdout}\n`);
```

Run it:

```sh
npm start --silent
```

Expected output:

```json
{"box":41,"identity":true,"payload":[true,9,"consumer","007fff",[1,5,13]],"callback":42,"closure":42}
```

Register the output listeners before awaiting initialization. `php.run()` returns an exit status; its return value does not contain the PHP output.

The host copies `main.php` into PHP's virtual filesystem and requires it as a file. This preserves PHP's `strict_types` declaration; passing the entire file directly to `php.run()` places it inside the host's evaluation wrapper.

### PHP-Wasm ownership and errors

PHP-Wasm exposes the same copied `Payload`, binary `Bytes`, canonical `Box` identity, PHP callbacks, and invokable Lean closures as [native PHP](#native-php-ownership-and-errors). Alpha changes the record's Boolean and count; the callback and returned callable each produce `42` in this example.

The `finally` blocks close the returned callable and the box even when a call fails. Closing a resource twice is allowed; using a closed wrapper raises `LeanAlpha\DisposedResource`. Keep each resource in the PHP-Wasm instance that created it. A second instance owns a separate Lean heap and identity domain.

Handle both JavaScript initialization failures and PHP failures. The host example throws on a nonzero PHP exit status or PHP error output. Explicit PHP comparisons keep the example's checks active when assertions are disabled.

### PHP-Wasm troubleshooting

- **The process prints nothing:** add the `output` listener and forward the captured text as above. Waiting for `php.run()` alone does not print PHP output.
- **The extension or a side module fails to load:** use PHP `8.4`, `php-wasm@0.1.0`, and the complete generated package. Do not mix assets from lazy and startup archives.
- **The autoloader is missing:** pass the imported descriptor in `sharedLibs` before awaiting `php.binary`. Node's `vendor/` directory is not PHP's virtual `/vendor/` directory.


## Values and cleanup

### Type conversions

Profiles: Native PHP, PHP-Wasm. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | Native PHP: `null` (input, result, field); `void` (result); PHP-Wasm: `void` (result) | Ordinary source: Native PHP: Installed checks passed (input, result, field); Not audited (callback input, callback result); PHP-Wasm: Not audited. Reviewed IR: Inspected: no host mapping (input, field, callback input, callback result); Generator inspected (result) | Native PHP: Unit is null in arguments, results and fields. PHP void is return-only; there is no valid void parameter or property representation.; PHP-Wasm: PHP void is return-only; there is no valid void parameter or property representation. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `bool` (input, result, field, callback input, callback result) | Ordinary source: Native PHP: Installed checks passed (input, result, field); Not audited (callback input, callback result); PHP-Wasm: Not audited. Reviewed IR: Generator inspected | Native PHP: Exact bool, including when the caller has strict_types disabled. Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `int` (input, result, field, callback input, callback result) | Ordinary source: Native PHP: Installed checks passed (input, result, field); Not audited (callback input, callback result); PHP-Wasm: Not audited. Reviewed IR: Generator inspected | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `int` (input, result, field, callback input, callback result) | Ordinary source: Native PHP: Installed checks passed (input, result, field); Not audited (callback input, callback result); PHP-Wasm: Not audited. Reviewed IR: Generator inspected | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `int` (input, result, field, callback input, callback result) | Ordinary source: Native PHP: Installed checks passed (input, result, field); Not audited (callback input, callback result); PHP-Wasm: Not audited. Reviewed IR: Generator inspected | Native PHP: Native 64-bit PHP represents the full 0..4294967295 range.; PHP-Wasm: PHP-Wasm accepts only 0..2147483647 as positive PHP integers; VO1206 tracks exact upper-half conversion. A result above PHP_INT_MAX fails. Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | Native PHP: `BigInteger` (input, result, field); `LeanAlpha\BigInteger` (input, result, field, callback input, callback result); PHP-Wasm: `LeanAlpha\BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Native PHP: Installed checks passed (input, result, field); Not audited (callback input, callback result); PHP-Wasm: Not audited. Reviewed IR: Generator inspected | Native PHP: BigInteger::fromDecimal preserves the full unsigned range without conversion through PHP float. The reviewed-IR BigInteger projection has no installed full-range Alpha transport evidence.; PHP-Wasm: The reviewed-IR BigInteger projection has no installed full-range Alpha transport evidence. Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `int` (input, result, field, callback input, callback result) | Ordinary source: Native PHP: Installed checks passed (input, result, field); Not audited (callback input, callback result); PHP-Wasm: Not audited. Reviewed IR: Generator inspected | Required: -128..127; reject overflow before narrowing. |
| `Int16` | `int` (input, result, field, callback input, callback result) | Ordinary source: Native PHP: Installed checks passed (input, result, field); Not audited (callback input, callback result); PHP-Wasm: Not audited. Reviewed IR: Generator inspected | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `int` (input, result, field, callback input, callback result) | Ordinary source: Native PHP: Installed checks passed (input, result, field); Not audited (callback input, callback result); PHP-Wasm: Not audited. Reviewed IR: Generator inspected | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `int` (input, result, field, callback input, callback result) | Ordinary source: Native PHP: Installed checks passed (input, result, field); Not audited (callback input, callback result); PHP-Wasm: Not audited. Reviewed IR: Generator inspected | The generated int spelling requires 64-bit PHP. PHP-Wasm's 32-bit int does not provide this full range. Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | Native PHP: `BigInteger` (input, result, field); `Generated BigInteger value` (input, result); `LeanAlpha\BigInteger` (field, callback input, callback result); PHP-Wasm: `Generated BigInteger value` (input, result); `LeanAlpha\BigInteger` (field, callback input, callback result) | Ordinary source: Native PHP: Installed checks passed (input, result, field); Not audited (callback input, callback result); PHP-Wasm: Not audited. Reviewed IR: Generator inspected | Native PHP: BigInteger stores canonical unsigned decimal text up to 16384 digits. The reviewed-IR BigInteger projection has no installed full-range Alpha transport evidence.; PHP-Wasm: The reviewed-IR BigInteger projection has no installed full-range Alpha transport evidence. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | Native PHP: `BigInteger` (input, result, field); `Generated BigInteger value` (input, result); `LeanAlpha\BigInteger` (field, callback input, callback result); PHP-Wasm: `Generated BigInteger value` (input, result); `LeanAlpha\BigInteger` (field, callback input, callback result) | Ordinary source: Native PHP: Installed checks passed (input, result, field); Not audited (callback input, callback result); PHP-Wasm: Not audited. Reviewed IR: Generator inspected | Native PHP: BigInteger stores canonical signed decimal text up to 16384 digits. The reviewed-IR BigInteger projection has no installed full-range Alpha transport evidence.; PHP-Wasm: The reviewed-IR BigInteger projection has no installed full-range Alpha transport evidence. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `float` (input, result, field, callback input, callback result) | Ordinary source: Native PHP: Installed checks passed (input, result, field); Not audited (callback input, callback result); PHP-Wasm: Not audited. Reviewed IR: Generator inspected | Native PHP: PHP float input rounds to binary32. NaN classification, infinities and signed zero are preserved. Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `float` (input, result, field, callback input, callback result) | Ordinary source: Native PHP: Installed checks passed (input, result, field); Not audited (callback input, callback result); PHP-Wasm: Not audited. Reviewed IR: Generator inspected | Native PHP: Exact PHP float inputs preserve NaN classification, infinities and signed zero. Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `string` (input, result, field, callback input, callback result) | Ordinary source: Native PHP: Installed checks passed (input, result, field); Not audited (callback input, callback result); PHP-Wasm: Not audited. Reviewed IR: Generator inspected | Native PHP: Validated UTF-8 PHP strings preserve embedded NUL. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | Native PHP: `Bytes` (input, result, field); `LeanAlpha\Bytes` (input, result, field, callback input, callback result); PHP-Wasm: `LeanAlpha\Bytes` (input, result, field, callback input, callback result) | Ordinary source: Native PHP: Installed checks passed (input, result, field); Not audited (callback input, callback result); PHP-Wasm: Not audited. Reviewed IR: Generator inspected | Native PHP: Bytes::fromString and toString preserve arbitrary binary bytes. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | Native PHP: `list<T>` (input, result, field); `array; list<T>` (input, result, field, callback input, callback result); PHP-Wasm: `array; list<T>` (input, result, field, callback input, callback result) | Ordinary source: Native PHP: Installed checks passed (input, result, field); Not audited (callback input, callback result); PHP-Wasm: Not audited. Reviewed IR: Generator inspected | Native PHP: Consecutive-key PHP lists with recursive element validation; nested results own independent copies. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `T\|null (non-null payload only)` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Generation rejects nested Option and Option Unit with ambiguous-nullable-option. Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `array with fixed positions` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | Native PHP: `Generated readonly class` (input, result, field); `Generated value class (Alpha: LeanAlpha\Payload)` (input, result, field, callback input, callback result); PHP-Wasm: `Generated value class (Alpha: LeanAlpha\Payload)` (input, result, field, callback input, callback result) | Ordinary source: Native PHP: Installed checks passed (input, result, field); Not audited (callback input, callback result); PHP-Wasm: Not audited. Reviewed IR: Generator inspected | Native PHP: Final readonly typed classes, including empty and scalar-represented records. Input checks also validate objects made without their constructors. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | `Resolved target type` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `LeanAlpha\Box` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `callable` (input) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input); Not audited (result, field, callback input, callback result) | Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve order and elements without exposing list constructors; choose and test a lossless IR lowering. |
| `Char` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Dependent parameters and results` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
| `Polymorphic exports` | `Named finite specializations` (signature) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |
| `Implicit arguments {α}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |
| `Instance arguments [C α]` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specialize or supply the selected dictionary without changing runtime behavior. |
| `Prop / theorem / proof arguments` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Record theorem identity and assumptions. Erasure does not remove the need to check a runtime refinement. |
| `Optional parameter with default` | `Optional argument with declared default` (signature) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Apply only the declared default; distinguish omitted input from a supplied Option.none. |
| `Explicit nullable host value` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Select an explicit host projection; null does not stand for every missing, erased or unsupported value. |
| `IO α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Executing IO is not automatically asynchronous. Preserve effect order and exceptions. |
| `EIO ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve typed failures separately from transport validation and unexpected traps. |
| `Declared failure contract` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Project every declared error and payload; preserve trap or poisoned-runtime handling separately. |
| `Task α / asynchronous result` | `Generated Awaitable<T>` (signature) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Keep completion, rejection, cancellation and runtime lifetime distinct; do not block a browser event loop. |
| `Declared host object` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate typed members and preserve receiver identity, dynamic-access policy and lifetime. |
| `Lean function returned to the host` | `LeanAlpha\Transform` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve captured state, call signature, errors and deterministic disposal. |
| `Cancellation protocol` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specify acknowledgement and late completion; release pending work exactly once. |
| `Synchronous iterator` | `Traversable<int, T>` (signature) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve values, end-of-sequence, failure, early return and cleanup. |
| `Asynchronous iterator` | `Generated AsyncIterator<T>` (signature) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve backpressure, pending-pull cancellation and terminal cleanup. |

### Alpha example API

Both prepared Alpha profiles use these PHP types. Keep `declare(strict_types=1)` in application files so PHP does not coerce arguments before the bindings validate them.

| Lean type | PHP type | Conversion rules |
| --- | --- | --- |
| `Bool` | `bool` | Pass `true` or `false`. |
| `UInt32` | `int` | Native PHP: `0..4294967295` with 64-bit integers. PHP-Wasm: `0..2147483647` with 32-bit signed integers. Inputs and results must fit the host range. |
| `String` | `string` | Valid UTF-8 text; embedded NUL is preserved. |
| `ByteArray` | `LeanAlpha\Bytes` | Use `Bytes::fromString` for binary data and `toString()` to retrieve it. |
| `Array UInt32` | `array` documented as `list<int>` | Sequential keys starting at zero; each element obeys the host's `UInt32` range above. |
| `Payload` | `LeanAlpha\Payload` | Readonly copied value with typed fields; no JSON conversion. |
| `Box` | `LeanAlpha\Box` | Resource with canonical object identity; close it in `finally`. |
| `UInt32 → UInt32` callback | `callable` taking and returning `int` | Synchronous PHP callback; arguments and results obey the host integer range. |
| Returned Lean closure | `LeanAlpha\Transform` | Invokable resource; call it in its originating runtime and release it with `close()`. |

In PHP-Wasm, a Lean result above `PHP_INT_MAX` cannot be represented. Alpha's `roundTrip` increments its count, so input `2147483647` cannot produce a representable count.



### Verify the native release

[Use a prepared release](consume/receive-package.md) explains archive authentication. The [native release evidence](evidence/native-php-release-package.md) records ABI and package checks.

### Install Composer autoloading

Follow [Install the Composer files](#install-the-composer-files) above.

### PHP-Wasm alternate transport

Follow the [PHP-Wasm installation and host example](#php-wasm) above.

## Start from a raw Lean package

Follow [Build and publish PHP packages](publish/php.md) for the required inputs and package builders.

### Build the pinned native package

[Build the native package](publish/php.md#build-and-check-the-native-package) in the author workflow. Repository maintainers run the [PHP acceptance checks](contributing/testing.md#consumer-acceptance).
