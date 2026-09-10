# Native PHP

Call Lean from PHP through the Alpha package's generated `LeanAlpha` API. The package includes a Composer library, a Zend extension, and a shared Lean runtime. The program below creates a resource, copies a record, calls a PHP callback from Lean, and invokes a returned Lean closure.

## Use a prepared release

### Prerequisites

Use PHP 8.2 NTS on x86-64 Linux with glibc 2.38 or newer, plus Composer 2. The extension targets PHP module API `20220829`. ZTS, other PHP versions, and other native platforms require a different build and are not covered by this package's acceptance tests.

Check the PHP executable that will run the application:

```sh
php -n -v
php -n -r 'echo PHP_VERSION, " NTS=", PHP_ZTS ? "no" : "yes", PHP_EOL;'
getconf GNU_LIBC_VERSION
```

### Obtain the package

Request the native Alpha package `poc/lean-alpha-php-native@0.0.0`. For a distributed archive, follow [Use a prepared release](receive-package.md) before extracting it or loading native code. Set `LEAN_ALPHA_PHP_PACKAGE` to the extracted directory containing `lib/` and `share/`:

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

### Type conversions

These mappings describe the prepared native Alpha package's `LeanAlpha` namespace on 64-bit PHP. Keep `declare(strict_types=1)` in application files to prevent PHP from coercing arguments before the generated validators see them.

| Lean type | PHP type | Conversion rules |
| --- | --- | --- |
| `Bool` | `bool` | Pass `true` or `false`. |
| `UInt32` | `int` | Range `0..4294967295`; the supported native PHP build has 64-bit integers. |
| `String` | `string` | Valid UTF-8 text; embedded NUL is preserved. |
| `ByteArray` | `LeanAlpha\Bytes` | Use `Bytes::fromString` for arbitrary bytes and `toString()` to retrieve them. |
| `Array UInt32` | `array` documented as `list<int>` | Sequential integer keys starting at zero; every element is range-checked. |
| `Payload` | `LeanAlpha\Payload` | Readonly value object with typed fields and copied values; no JSON conversion. |
| `Box` | `LeanAlpha\Box` | Resource with canonical object identity; close it in `finally`. |
| `UInt32 → UInt32` callback | `callable` taking and returning `int` | Synchronous; input and result obey the `UInt32` range. |
| Returned Lean closure | `LeanAlpha\Transform` | Invokable resource; call `$transform($value)` and release it with `close()`. |

This Alpha release exposes no `Nat`, `Int`, floating-point, optional, or asynchronous operations. The [PHP-Wasm profile](php-wasm.md#type-conversions) uses the same PHP classes but has a smaller host integer range.

### Types, ownership, and errors

`Payload` is a copied PHP value. Its text remains UTF-8 text, `Bytes` preserves binary data, and `values` is a typed list. The transport does not encode the record as JSON; this example uses JSON only to print its result.

`Box` owns a Lean resource. `identity()` returns the same PHP wrapper, so closing either reference closes that resource. The returned callable also owns a Lean value. Close both in `finally`; their destructors provide fallback cleanup. Repeated `close()` calls are allowed, and using a closed wrapper raises `LeanAlpha\DisposedResource`.

Generated validators reject incorrect PHP types and out-of-range values. Callback exceptions cross back to the PHP caller. Catch errors at your application boundary and keep cleanup in `finally`.

### Troubleshooting

- **Unable to load the extension:** check the PHP version, NTS setting, CPU architecture, and glibc version. Keep `lib/php/lean_alpha.so` beside the packaged `lib/liblean_bridge_native.so` layout.
- **The `LeanAlpha` classes are missing:** run Composer in `component/` and require `component/vendor/autoload.php` from the application.
- **No output from an older example:** run the complete program above. It prints results and uses unconditional comparisons instead of PHP's configurable `assert()`.

## Start from a raw Lean package

For Alpha, [build the pinned native PHP package](../contributing/testing.md#native-php-package), including its compiled extension, runtime, and Composer files. Set `LEAN_ALPHA_PHP_PACKAGE` to that output and return to [Obtain the package](#obtain-the-package). The [native release record](../evidence/native-php-release-package.md) identifies the producer's toolchain.

For another Lean library, check the [source workflow and supported targets](../consume.md#start-from-a-raw-lean-package). These Alpha builds use the repository's target-specific inputs.

### Acceptance checks

Contributors run this program through the [installed consumer checks](../contributing/testing.md#consumer-acceptance). See the [PHP release gate](../evidence/php-release-gate.md) for native and PHP-Wasm parity results.

### Publish this package

See [Publish with Composer](../publish/composer.md) for package preparation, distribution, and verification after upload.
