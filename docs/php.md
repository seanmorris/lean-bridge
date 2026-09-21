# PHP

Install the package for the PHP runtime that executes your application. Ordinary native packages load their bundled Lean runtime automatically. Ordinary PHP-Wasm packages can load at startup or on the first API call. Consumers do not build Lean.

## Use a prepared release

| Application | Installation | Tested runtime |
| --- | --- | --- |
| Ordinary native PHP CLI package | [Composer archive](#ordinary-project-packages) | PHP 8.2+ NTS CLI, Linux x86-64, FFI enabled, glibc 2.38 or newer |
| Ordinary PHP-Wasm package | [npm and optional Composer archive](#ordinary-php-wasm-packages) | Node 22 or Chromium, PHP 8.4, `php-wasm` 0.1.0, startup or first-call loading |
| Native PHP CLI or deployment | [Native PHP](#native-php) | PHP 8.2 NTS, x86-64 Linux, glibc 2.38 or newer |
| PHP hosted by Node | [PHP-Wasm](#php-wasm) | Node 22, PHP 8.4, `php-wasm` 0.1.0 |

The Alpha native package includes an extension, Lean runtime, and Composer library. Its PHP-Wasm profile uses an npm archive containing side modules and loader metadata, tested in Node. Ordinary PHP-Wasm packages also run in Chromium with the same startup and lazy descriptors.

### Ordinary project packages

Use PHP 8.2 or newer (below 9), NTS CLI on Linux x86-64 with glibc 2.38 or newer. PHP's FFI extension must be installed and enabled. The default `ffi.enable=preload` permits CLI use. This package path does not yet cover FPM, Apache, PHP's development server, ZTS or PHP-Wasm. [PHP FFI configuration](https://www.php.net/manual/en/ffi.configuration.php).

Authenticate your publisher's archive using [Use a prepared release](consume/receive-package.md). This example uses the Clover acceptance package. Put `example-clover-api-2.0.0-RC.1-linux-x86_64.zip` in a `releases/` directory. Use Composer 2 with its ZIP extension for the local artifact repository. Save this as `composer.json`:

```json file=php-native/ordinary/composer.json
{
  "name": "example/lean-php-consumer",
  "repositories": [
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

use Brick\Math\BigInteger;
use function LeanClover\{array_u32, echo_nat, echo_text, echo_u32};

$large = BigInteger::of('184467440737095516160000000001');
if (echo_u32(42) !== 42
    || (string) echo_nat($large) !== (string) $large
    || echo_text("Lean λ\0") !== "Lean λ\0"
    || array_u32([0, 4294967295]) !== [0, 4294967295]) {
    throw new RuntimeException('Lean returned an unexpected result');
}
echo '42; exact integers and copied arrays', PHP_EOL;
```

Run `php main.php`. Expected output is `42; exact integers and copied arrays`. You do not need Lean, C headers, a package-specific extension or runtime paths. Keep the installed package directory intact; it can move with your application.

Ordinary native packages support pure functions over 19 primitive types, arrays, Lists, acyclic records, options, results and nested binary products. `Unit` is `null`, and `Char` is a UTF-8 string containing exactly one Unicode scalar. Fixed-width integers use PHP `int`, except `UInt64`, which uses `BigInteger`; `Nat`, `Int`, and `USize` use it too. `ISize` uses PHP `int`. Platform words follow the compiled Lean target: 64 bits for native PHP and 32 bits for PHP-Wasm. Composer installs the pinned `brick/math` 1.0.0 dependency. Use `Brick\Math\BigInteger::of` to construct exact integers. Lean Bridge accepts values up to 16,384 decimal digits. `Bytes::fromString` preserves arbitrary binary data. Arrays are consecutive-key lists, and records are final readonly classes. Results own independent copied values.

Parameters use `mixed` with precise PHPDoc so generated checks can reject numeric coercion even in weak caller mode. Invalid types raise `TypeError`; range and conversion limits raise `ValueError`; native failures raise the package's `LeanBridgeError`. `Float32` rounds PHP floats to binary32; floating-point conversions preserve NaN classification, infinities and signed zero.

`BigInteger` is the standard Brick Math class. Its arithmetic methods work on returned values, and two Lean Bridge packages accept the same integer object. For example, `$large->plus(1)` returns another exact integer. For untrusted text, use `BigInteger::parse($text, allowedSyntax: [], maxDigits: 16384)` to bound parsing before calling Lean. See the [Brick Math API](https://github.com/brick/math/tree/1.0.0) and [installed integer checks](evidence/php-brick-math-20260918.md).

Validation, PHP conversion and native copying each have a 16 MiB accounting limit. PHP lists count at least 32 bytes per element. These limits do not bound Lean working memory. `finally` releases native outputs after conversion errors. Compatible packages share one process runtime; post-fork calls and already loaded foreign Lean runtimes are rejected. Loading needs readable `/proc/self/maps` to detect foreign runtime mappings. See [installed PHP evidence](evidence/native-php-copied-20260915.md).

### Options, results and products

Prepared native and PHP-Wasm packages generate the branch classes they need inside
their public namespace:

| Lean type | PHP value |
| --- | --- |
| `Option T` | `null` for none, `new Some($value)` for some |
| `Except E T` | `new Ok($value)` or `new Err($error)` |
| `A × B` | Exactly two consecutive-key array elements, `[$a, $b]` |

For the compound acceptance package, whose `classify` function takes
`Option (Option Unit)`:

```php
use LeanCompounds\Some;
use function LeanCompounds\{classify, tuple_string};

echo classify(null);                     // 0: None
echo classify(new Some(null));           // 1: Some None
echo classify(new Some(new Some(null))); // 2: Some (Some Unit)
$swapped = tuple_string(['left', 'right']); // ['right', 'left']
```

Every branch exposes `$value`. A declared domain error returns `Err`; bridge
failures throw `LeanBridgeError`. Success and error remain distinct even when
their payload types match. Products preserve binary nesting: `(A × B) × C`
is `[[$a, $b], $c]`, not a three-element array.

`Some`, `Ok` and `Err` are final readonly classes. Their constructors accept one
payload; each call validates that payload against the concrete Lean signature,
including in weak caller mode. A wrapper does not make an arbitrary object
payload deeply immutable. Returned arrays, records, buffers and wrappers own
independent copies. PHP `===` compares object identity; `==` uses PHP's property
comparison rules, not a generated Lean equality operation.

These constructors compose with supported primitives, arrays, records and each
other. Type nesting stops at 32 levels; the existing conversion budgets apply.
Compound callables, resource-containing copies, arbitrary variants and
recursive copied types remain unsupported. See the
[native compound checks](evidence/php-native-compounds-20260920.md) and
[PHP-Wasm compound checks](evidence/php-wasm-compounds-20260920.md).

### Lean Lists

Native Composer and PHP-Wasm packages accept `List T` as consecutive-key PHP arrays and
return independently copied arrays. Generated PHPDoc uses `list<T>`. Empty
Lists, order, duplicates and nesting are preserved, including List fields in
records and combinations with arrays, options, results and products.

For the native List acceptance package:

```php
use function LeanLists\{reverse_uint32, mix};

$reversed = reverse_uint32([1, 2, 1, 3]); // [3, 1, 2, 1]
$nested = mix([[1, 2], [], [3]]);        // [[3], [], [2, 1]]
```

`List` and `Array` retain distinct Lean and native types even though PHP uses
arrays for both. Weak and strict callers get the same type and copy-budget
checks. Associative arrays, sparse arrays, iterator objects and invalid elements
are rejected. Changing a result cannot change inputs or sibling results.
The existing 32-level type and 16 MiB conversion limits apply.

PHP-Wasm applies its 32-bit mappings inside Lists: `List UInt32` and `List Int64`
contain `Brick\Math\BigInteger` values. These mappings differ from native PHP;
do not pass PHP integers in their place.

[Native List checks](evidence/php-native-lists-20260921.md) and
[PHP-Wasm List checks](evidence/php-wasm-lists-20260921.md) cover ordinary source
and reviewed contracts. PHP-Wasm runs in Node and Chromium with startup or
first-call loading. List callback payloads remain unsupported.
The [native FFI follow-up](evidence/php-native-lists-ffi-20260921.md) records
the PHP 8.5 deprecation fix and repeated installed checks.

### Named copied aliases

Native Composer and PHP-Wasm packages preserve Lean alias names, original targets
and chains in installed metadata and API documentation. Callers pass ordinary
PHP target values. Aliases do not create wrapper classes. Native packages use
`binding-manifest.json`; PHP-Wasm packages also include a shared
`lean-bridge/aliases.json` catalog in their npm and Composer archives.

For a package exporting `Scores.Count := UInt32` and
`Scores.Counts := List Count`, save this as `aliases.php`:

```php
<?php
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use function LeanScores\{increment, reverse};

echo increment(41), PHP_EOL;          // 42
print_r(reverse([1, 2, 1, 3]));       // [3, 1, 2, 1]
```

For native PHP, run `php aliases.php`. Generated PHPDoc records the target types, such as `int`
and `list<int>`. The `@lean-bridge-param`, `@lean-bridge-return` and
`@lean-bridge-contract` annotations retain the original Lean names at API sites
and record fields. Alias chains remain in the manifest, including aliases used
only in return types.

In PHP-Wasm, `Count` uses `Brick\Math\BigInteger` because UInt32 does not fit
the host's signed 32-bit integer. Inside the PHP code loaded by your
[installed descriptor](#ordinary-php-wasm-packages), call:

```php
use Brick\Math\BigInteger;
use function LeanScores\{increment, reverse};

echo increment(BigInteger::of(41));                 // 42
$counts = array_map(BigInteger::of(...), [1, 2, 1, 3]);
$reversed = reverse($counts);                      // BigInteger values: 3, 1, 2, 1
```

The catalog is available beside the mounted package's `src` directory with
either embedded declarations or Composer. Startup and first-call loading use
the same declarations and target checks.

Weak and strict callers receive the same checks: Nat requires a nonnegative
`BigInteger`, integer ranges remain enforced, Unit uses `null` and Char requires
one Unicode scalar. Copied containers retain their target's ownership and
conversion limits. The [native PHP](evidence/php-native-aliases-20260921.md) and
[PHP-Wasm alias checks](evidence/php-wasm-aliases-20260921.md) cover both source
paths and caller modes. Alias payloads in callbacks still need separate support.

### Native callbacks and returned functions

Native Composer packages support synchronous callbacks and returned Lean functions across all 19 primitive types, from ordinary source or a compiler-checked reviewed contract. Pass a PHP callable directly. For the Clover package:

```php
echo LeanClover\call_word(40, fn($value) => $value + 1); // applies twice: 42
$add = LeanClover\make_word(2);
try {
    echo $add(40);                                  // 42
    echo LeanClover\call_word(40, $add);             // 44
} finally {
    $add->close();
}
```

The returned `LeanClosure` is invokable with exactly its declared positional arguments. `close()` is idempotent; `isClosed()` reports closure. Saved callable aliases share its lifetime and reject calls after closing. Destruction releases abandoned closures, but `finally` gives deterministic cleanup. You cannot construct, clone or serialize a Lean closure.

Callbacks accept one to sixteen primitive arguments. Their PHPDoc states the signature, and the bridge validates inputs and results in weak and strict callers. `Nat`, `Int`, `UInt64` and native `USize` remain `Brick\Math\BigInteger`. Unit uses `null`, including a callback with a `void` return. Callback arguments are independent copies. The callback itself is borrowed for one synchronous call; Lean cannot invoke it afterward. Exceptions return as the same `Throwable`, preserving its trace and previous exception. Later callbacks in a failed call do not run.

Reference parameters, reference returns and generators reject. Callable operations require the main NTS CLI execution context; calls from a Fiber reject. Close may defer native release until an active call returns. Start a fresh process after fork. Each native adapter permits 64 nested calls per thread, and the shared runtime permits 4,096 closure identities. Existing conversion limits still apply. Asynchronous functions and compound callback arguments are not admitted. See the [installed native PHP callable checks](evidence/php-callables-20260919.md).

### Ordinary PHP-Wasm packages

Use `php-wasm` 0.1.0 with PHP 8.4's default variant, hosted in Node 22 or Chromium. Obtain the publisher's archives, `package-set-receipt.json`, and its `.json.sha256` sidecar through your trusted release channel. [Verify the package set](consume/receive-package.md#verify-a-local-package-set) before installation. It contains two npm archives, one component and its shared runtime, plus a companion Composer ZIP. No Lean tools, PHP headers or Emscripten installation are needed.

The npm descriptor includes Brick Math 1.0.0 and loads its classes automatically. No Composer installation or GMP/BCMath extension is required. A Composer application uses the generated package's exact `brick/math` dependency instead. Include dependencies in your application lockfile; offline Composer installs need that locked dependency in their repository or cache.

Options, results and nested products use the [same public PHP types](#options-results-and-products) as native packages. They compose with all nineteen primitives, arrays and copied records. The 32-bit integer mappings still apply inside every payload: for example, `Option UInt32` accepts `new Some(BigInteger::of('4294967295'))`. Weak-mode callers do not coerce integers, strings or branch values. Validation, Zend conversion and native copying each have a 16 MiB accounting limit; PHP array elements count at least 32 bytes. The adapter releases native output owners on conversion errors and PHP bailouts.

PHP-Wasm also accepts synchronous primitive callbacks and returns invokable `LeanClosure` objects with `close()` and `isClosed()`. Use the same lifetime rules as native PHP. On this 32-bit target, `UInt32`, `UInt64`, `Int64`, `Nat`, `Int` and `USize` use `Brick\Math\BigInteger`; `ISize` uses PHP `int` in -2147483648..2147483647. Callback arguments and results use those same types. For example, a `UInt32 → UInt32` callback can be `fn(BigInteger $value) => $value->plus(1)`.

The private Zend adapter preserves callback `Throwable` identity after Lean cleanup and owns returned functions through PHP resources. Closing a function releases its native state; destruction provides a fallback. Keep functions within their originating PHP instance and close them before disposing that instance. The pinned PHP-Wasm host cannot start Fibers; use the main execution context. Async and compound callables are not supported. [Installed PHP-Wasm callable checks](evidence/php-wasm-callables-20260919.md) cover both source paths and loading modes.

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
use Brick\Math\BigInteger;
echo LeanWillow\echo_u32(BigInteger::of('4294967295'));
`);
assert.equal(status, 0);
```

Run `node main.mjs`. Expected output is `4294967295`. Register every component in `sharedLibs` before accessing `php.binary` or running PHP. Compatible packages share one runtime; duplicate registration does not reload an extension. Different runtime identities fail before startup.

#### Load on the first call

The same package exports a `lazy` descriptor. In `main.mjs`, replace the component import and host construction with:

```js
import { lazy as api } from '@example/willow-php-wasm';
const php = new PhpNode({ version: '8.4', dynamicLibs: [api] });
```

Keep the rest of the file unchanged. Loading the PHP declarations does not fetch Lean libraries. The first valid API call fetches the shared runtime and that component's extension. Calling another component fetches only its extension. Unused components stay unloaded; invalid inputs fail before loading.

Register the default descriptor in `sharedLibs` for startup loading, or `lazy` in `dynamicLibs` for first-call loading. Different components can choose different modes. Do not register the same component in both modes. npm handles the same runtime dependency in either case.

The pinned PHP host supports asynchronous library downloads through `dl()`. Keep `enable_dl=1`, its default, and await each `php.run()` before starting another. A failed extension load raises the package's `LeanBridgeError`; create a new PHP instance before trying again. The loader does not retry a partially linked library.

#### Run in a browser

Use the same installed component with `PhpWeb`. This example selects first-call loading. For a new Vite application, install the tested Vite version and copy the pinned PHP host into its public directory:

```sh
npm install --save-dev --save-exact vite@8.2.1
mkdir public
cp -R node_modules/php-wasm public/php-host
```

Serve `public/php-host/` at `/php-host/`, even when the application lives under a nested URL. Keep the PHP package's internal directory layout intact. Save these three files in the application root.

`index.html`:

```html file=php-wasm/ordinary/index.html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" href="data:,">
    <title>Lean in PHP-Wasm</title>
  </head>
  <body>
    <output id="result" aria-live="polite"></output>
    <script type="module" src="./browser.mjs"></script>
  </body>
</html>
```

`browser.mjs`:

```js file=php-wasm/ordinary/browser.mjs
/**
 * Execute an installed ordinary Lean API in browser-hosted PHP.
 *
 * @file
 */
import { PhpWeb } from '/php-host/PhpWeb.mjs';
import { lazy as api } from '@example/willow-php-wasm';

const output = globalThis.document.querySelector('#result');
try
{
	const php = new PhpWeb({ version: '8.4', autoTransaction: false, dynamicLibs: [api] });
	let stderr = '';
	php.addEventListener('output', event => {
		for(const part of event.detail) output.textContent += part;
	});
	php.addEventListener('error', event => {
		for(const part of event.detail) stderr += part;
	});
	const status = await php.run(String.raw`<?php
require_once '${api.autoload}';
use Brick\Math\BigInteger;
echo LeanWillow\echo_u32(BigInteger::of('4294967295'));
`);
	if(status !== 0 || stderr) throw new Error(stderr || `PHP exited with status ${status}`);
	output.dataset.state = 'ready';
} catch(error)
{
	output.textContent = error.message;
	output.dataset.state = 'error';
	throw error;
}
```

`vite.config.mjs`:

```js file=php-wasm/ordinary/vite.config.mjs
/**
 * Bundle the Lean package and serve the pinned PHP host unchanged.
 *
 * @file
 */
export default {
	base: './'
	, build: {
		assetsInlineLimit: 0
		, rollupOptions: { external: ['/php-host/PhpWeb.mjs'] }
	}
};
```

Run `npx vite build`, then `npx vite preview` and open the printed localhost address. The page displays `4294967295`. Vite bundles the Lean descriptor and copies its libraries and PHP files to asset URLs. The external import leaves the PHP host unchanged. `autoTransaction: false` disables automatic filesystem persistence for this stateless example.

The [first-call acceptance](evidence/php-wasm-lazy-20260915.md) runs these exact files, plus two installed components together, with external requests blocked. It checks both loading modes and browser responsiveness during delayed library downloads. Other browser engines and browser workers need separate acceptance.

#### Copied type conversions

These mappings apply to ordinary copied packages. The Alpha tables later on this page retain their separate profile.

| Lean type | PHP-Wasm value | Rules |
| --- | --- | --- |
| `Unit` | `null` | Arguments, results and fields |
| `Bool` | `bool` | No integer coercion |
| `UInt8`, `UInt16`, `Int8`, `Int16`, `Int32` | `int` | Exact width and range checks |
| `UInt32`, `UInt64`, `Int64`, `Nat`, `Int` | `Brick\Math\BigInteger` | Canonical decimal input; exact values across the 32-bit host boundary |
| `Float32`, `Float` | `float` | Binary32 rounding for `Float32`; NaN, infinities and signed zero preserved |
| `String` | `string` | Valid UTF-8, including embedded NUL |
| `ByteArray` | Generated `Bytes` | Arbitrary binary data |
| `Array T` | PHP list | Consecutive keys; recursively checked copied elements |
| Acyclic Lean record | Generated readonly class | Named fields and independent copied results |

Invalid types raise `TypeError`; out-of-range values and conversion limits raise `ValueError`. Native conversion failures raise the package's `LeanBridgeError`. Converted input and output have separate 16 MiB accounting limits; those limits do not bound Lean's working memory.

Use `Brick\Math\BigInteger::of` for every `UInt32`, `UInt64`, `Int64`, `Nat` and `Int` argument, including small values. Numeric PHP strings, integers and floats are not substitutes. Brick normalizes the number; Lean Bridge checks its canonical value and limits it to 16,384 decimal digits. Use quoted decimal strings for values above `PHP_INT_MAX`, never PHP floating-point literals. The same mapping applies to array elements and record fields, with `strict_types` either enabled or disabled.

The [installed boundary checks](evidence/php-wasm-primitive-boundaries-20260918.md) cover both halves of `UInt32`, signed bounds, values beyond JavaScript's exact-number range, and large `Nat`/`Int` values. They also check floating-point rounding, signed zero, NaN classification, Unicode, embedded NUL and arbitrary bytes in Node and Chromium. The [Alpha example API](#alpha-example-api) uses the same `BigInteger` representation for its `UInt32` resources, callbacks and returned functions.

#### Use the companion Composer API

Install the matching Composer ZIP using the [artifact-repository setup](#ordinary-project-packages), with its own coordinate, `example/willow-php-wasm:2.0.0-RC.1`. When Composer runs on a native host, set `config.platform.php` to `8.4.1` for this Wasm application. Use the npm descriptor's `extensions` export in `sharedLibs`, mount your installed `vendor/` directory into the PHP virtual filesystem, then require that mounted `vendor/autoload.php`. The default descriptor already supplies the PHP files and needs no Composer install; do not preload a second copy.

For first-call loading, import `lazy` and pass `lazy.extensions` in `dynamicLibs` instead. The [installed tests](evidence/php-wasm-lazy-20260915.md) execute both loading modes with embedded PHP files, Composer autoloading and Vite-bundled assets in Node. Chromium executes bundled PHP sources in both modes.

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
use Brick\Math\BigInteger;
use LeanAlpha\Bytes;
use LeanAlpha\Payload;
use function LeanAlpha\makeAdder;
use function LeanAlpha\roundTrip;
use function LeanAlpha\withCallback;

$box = new Box(BigInteger::of('41'));
$addTwo = null;
try {
    $payload = roundTrip(new Payload(
        false, BigInteger::of('8'), 'consumer', Bytes::fromString("\x00\x7f\xff"),
        array_map(BigInteger::of(...), ['1', '5', '13']),
    ));
    $addTwo = makeAdder(BigInteger::of('2'));
    $result = [
        'box' => (string) $box->read(),
        'identity' => $box->identity() === $box,
        'payload' => [
            $payload->enabled, (string) $payload->count, $payload->label,
            bin2hex($payload->bytes->toString()), array_map(strval(...), $payload->values),
        ],
        'callback' => (string) withCallback(BigInteger::of('40'), static fn(BigInteger $value): BigInteger => $value),
        'closure' => (string) $addTwo(BigInteger::of('40')),
    ];
    $expected = [
        'box' => '41',
        'identity' => true,
        'payload' => [true, '9', 'consumer', '007fff', ['1', '5', '13']],
        'callback' => '42',
        'closure' => '42',
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

The copied-package examples above use exact `BigInteger` values where PHP-Wasm's 32-bit integers cannot hold the full Lean range. The table distinguishes ordinary-source packages from the separately checked Alpha resource and callback API.

### Type conversions

Profiles: Native PHP, PHP-Wasm. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `null` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Unit is null in arguments, results and fields. Unit is null for arguments and results, including callbacks; a PHP void callback returns null. PHP void is return-only; there is no valid void parameter or property representation. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `bool` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Native PHP: Exact bool, including when the caller has strict_types disabled.; PHP-Wasm: Exact bool in weak and strict callers; numbers and strings are not Boolean inputs. Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | Native PHP: `int` (input, result, field, callback input, callback result); PHP-Wasm: `Brick\Math\BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Native PHP: Alpha preserves the full 0..4294967295 range as int, including payload elements, callback arguments/results and returned closures. Requires native 64-bit PHP.; PHP-Wasm: The compiled copied API uses Brick\Math\BigInteger for the full 0..4294967295 range, even for values below PHP_INT_MAX. PHP ints, floats and numeric strings are rejected. The 32-bit PHP host requires Brick\Math\BigInteger for the full 0..4294967295 range, even for small values; PHP ints, floats and numeric strings reject. Alpha preserves the full 0..4294967295 range as Brick\Math\BigInteger, including payload elements, callback arguments/results and returned closures. Use Brick\Math\BigInteger even for small values; PHP ints, floats and numeric strings are rejected. Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `Brick\Math\BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Brick\Math\BigInteger::of preserves the full unsigned range without conversion through PHP float. The reviewed-IR Brick\Math\BigInteger projection has no installed full-range Alpha transport evidence. Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Required: -128..127; reject overflow before narrowing. |
| `Int16` | `int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | Native PHP: `int` (input, result, field, callback input, callback result); PHP-Wasm: `Brick\Math\BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Native PHP: Native 64-bit PHP represents the full -9223372036854775808..9223372036854775807 range as int.; PHP-Wasm: The compiled copied API uses Brick\Math\BigInteger for the full -9223372036854775808..9223372036854775807 range on the 32-bit host. Exact Brick\Math\BigInteger preserves both signed 64-bit endpoints on the 32-bit host. The 32-bit projection uses Brick\Math\BigInteger with exact signed bounds. Alpha declares no Int64 export; this is inspected generation, not installed Alpha Int64 support. Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `Brick\Math\BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Brick\Math\BigInteger accepts nonnegative integer values up to 16384 decimal digits. Exact Brick\Math\BigInteger; negative Nat inputs and callback results reject. No native integer narrowing. The reviewed-IR Brick\Math\BigInteger projection has no installed full-range Alpha transport evidence. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `Brick\Math\BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Brick\Math\BigInteger accepts signed integer values up to 16384 decimal digits. Exact signed Brick\Math\BigInteger including multi-thousand-bit captured values. The reviewed-IR Brick\Math\BigInteger projection has no installed full-range Alpha transport evidence. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `float` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Native PHP: PHP float input rounds to binary32. NaN classification, infinities and signed zero are preserved.; PHP-Wasm: PHP float input rounds to binary32 in scalar, array and record positions. NaN classification, infinities, subnormals and signed zero are checked. Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `float` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Native PHP: Exact PHP float inputs preserve NaN classification, infinities and signed zero.; PHP-Wasm: Binary64 values, NaN classification, infinities, subnormals and signed zero are checked in scalar, array and record positions. Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `string` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Validated UTF-8 PHP strings preserve embedded NUL. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `Bytes` (input, result, field, callback input, callback result); `LeanAlpha\Bytes` (field) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Bytes::fromString and toString preserve arbitrary binary bytes. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `list<T>` (input, result, field); `array; list<T>` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Consecutive-key PHP lists with recursive element validation; nested results own independent copies. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `null or Some` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result) | None is null; new Some($value) retains presence. Some(null) preserves present Unit or an outer Some containing None, according to the declared payload type. Some(Some(null)) preserves two layers. Generated final readonly branch classes expose one value property. Concrete payloads are validated on every call, without weak-caller coercion. Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | `Ok or Err` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result) | Lean Except E T becomes new Ok($value) or new Err($error), each exposing a readonly value property. Branch identity is preserved even for same-typed payloads. Domain errors return Err; bridge failures throw. PHP === compares object identity; PHP == property comparison is not generated Lean equality. Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `Two-element consecutive-key array (nested binary products)` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result) | Exactly two consecutive integer-key array elements preserve binary nesting and per-position validation. Nested arrays, records and branch payloads are copied independently. Validation, host conversion and native copying each have a 16 MiB accounting limit, not a bound on all PHP or Lean allocations. Payloads use the selected target's integer mappings. Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Generated readonly class` (input, result, field); `Generated value class (Alpha: LeanAlpha\Payload)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Native PHP: Final readonly typed classes, including empty and scalar-represented records. Input checks also validate objects made without their constructors.; PHP-Wasm: Final readonly typed classes, including empty and scalar-represented records. Nested fields are checked and results own independent copies. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | Native PHP: `PHP target value; named Lean contract in installed manifest and PHPDoc` (input, result, field); `Resolved target type` (callback input, callback result); PHP-Wasm: `PHP target value; named Lean contract in installed catalog and PHPDoc` (input, result, field); `Resolved target type` (callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Generator inspected (callback input, callback result) | Native PHP: Aliases preserve exact target conversion rules, original names and independently copied results. Weak and strict callers get the same checks: Nat requires nonnegative Brick\Math\BigInteger, integer ranges remain enforced, Unit uses null and Char requires one Unicode scalar. List/Array identity, Option/Result presence, 32-level schema depth and existing 16 MiB conversion budgets remain unchanged.; PHP-Wasm: Aliases retain exact wasm32 target rules and independent copies. UInt32, UInt64, Int64, Nat, Int and USize use Brick\Math\BigInteger; ISize uses a 32-bit PHP int. Weak and strict callers get the same checks. Unit uses null and Char requires one Unicode scalar. List/Array identity, Option/Result presence, 32-level schema depth and existing 16 MiB conversion budgets remain unchanged. Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `LeanAlpha\Box` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `callable` (input) | Ordinary source: Installed checks passed (input); Not audited (result, field, callback input, callback result). Reviewed IR: Installed checks passed (input); Not audited (result, field, callback input, callback result) | Synchronous PHP callable with generated signature PHPDoc. Mixed bridge parameters prevent weak-caller coercion; callback failures preserve the same Throwable, trace and previous exception after cleanup. Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | `list<T> (consecutive-key PHP array)` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Native PHP: Consecutive-key PHP arrays preserve empty Lists, order, duplicates and nesting. Element-specific PHPDoc accompanies recursively checked mixed parameters, preventing weak-mode coercion. Results own independent mutable copies. Calls reject associative or sparse arrays, iterator objects, invalid payloads and oversized copies. Typed Lean helpers avoid cons-cell layout assumptions. Native output lengths, missing buffers and alignment are checked before element reads; finally clears owned results after conversion errors.; PHP-Wasm: Consecutive-key PHP arrays preserve empty Lists, order, duplicates and nesting. Element-specific PHPDoc accompanies recursively checked mixed parameters, preventing weak-mode coercion. UInt32, UInt64, Int64, Nat, Int and USize payloads use Brick\Math\BigInteger on wasm32; ISize uses a 32-bit PHP integer. Results own independent mutable copies. Typed Lean helpers retain distinct List/Array identities without cons-cell layout assumptions. Native sequence lengths, null buffers, element alignment and Wasm memory bounds are checked before allocation or element reads. Native owners are released after conversion errors and PHP bailouts. Required: Preserve order, duplicates and nesting with a distinct list constructor. Validate all elements and copying limits; never expose Lean cons cells. |
| `Char` | `string` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly one Unicode scalar, 0..0x10FFFF excluding surrogates. NUL, supplementary characters, combining scalars, noncharacters and line endings are preserved without normalization. Multi-scalar grapheme clusters require String. One UTF-8 Unicode scalar, including NUL and supplementary values. Malformed text and multiple scalars reject. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | `Brick\Math\BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Native PHP: 64-bit compiled Lean target, 0..18446744073709551615. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Exact Brick\Math\BigInteger for the 64-bit compiled Lean target, checked in 0..2^64-1.; PHP-Wasm: 32-bit compiled Lean target, 0..4294967295. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Exact Brick\Math\BigInteger for the 32-bit compiled Lean target, checked in 0..4294967295. Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | `int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Native PHP: 64-bit compiled Lean target, -9223372036854775808..9223372036854775807. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. PHP int for the 64-bit compiled Lean target; both signed endpoints are preserved.; PHP-Wasm: 32-bit compiled Lean target, -2147483648..2147483647. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. PHP int for the 32-bit compiled Lean target, checked in -2147483648..2147483647. Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
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
| `Lean function returned to the host` | `LeanClosure` (result) | Ordinary source: Not audited (input, field, callback input, callback result); Installed checks passed (result). Reviewed IR: Not audited (input, field, callback input, callback result); Installed checks passed (result) | Invokable LeanClosure with exact positional arity, close and isClosed. Saved callable aliases share its lease. Cloning, serialization and direct construction reject. Required: Preserve captured state, call signature, errors and deterministic disposal. |
| `Cancellation protocol` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specify acknowledgement and late completion; release pending work exactly once. |
| `Synchronous iterator` | `Traversable<int, T>` (signature) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve values, end-of-sequence, failure, early return and cleanup. |
| `Asynchronous iterator` | `Generated AsyncIterator<T>` (signature) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve backpressure, pending-pull cancellation and terminal cleanup. |

### Alpha example API

Alpha uses `int` for `UInt32` on native 64-bit PHP and `Brick\Math\BigInteger` on PHP-Wasm. Keep `declare(strict_types=1)` in application files so PHP does not coerce scalar arguments before the bindings validate them.

| Lean type | PHP type | Conversion rules |
| --- | --- | --- |
| `Bool` | `bool` | Pass `true` or `false`. |
| `UInt32` | Native: `int`; PHP-Wasm: `Brick\Math\BigInteger` | Full `0..4294967295` range in both profiles. In PHP-Wasm, use `BigInteger::of('4294967295')`, including for small values. |
| `String` | `string` | Valid UTF-8 text; embedded NUL is preserved. |
| `ByteArray` | `LeanAlpha\Bytes` | Use `Bytes::fromString` for binary data and `toString()` to retrieve it. |
| `Array UInt32` | `array`, documented as native `list<int>` or PHP-Wasm `list<BigInteger>` | Sequential keys starting at zero; each element uses the profile's `UInt32` representation. |
| `Payload` | `LeanAlpha\Payload` | Readonly copied value with typed fields; no JSON conversion. |
| `Box` | `LeanAlpha\Box` | Resource with canonical object identity; close it in `finally`. |
| `UInt32 → UInt32` callback | Native: `callable(int): int`; PHP-Wasm: `callable(BigInteger): BigInteger` | Synchronous PHP callback; arguments and results preserve the full unsigned range. |
| Returned Lean closure | `LeanAlpha\Transform` | Invokable resource; call it in its originating runtime and release it with `close()`. |

Alpha's `roundTrip` increments its count with Lean's `UInt32` arithmetic: `2147483647` becomes `2147483648`, and `4294967295` wraps to `0`. Both results are exact in PHP-Wasm. PHP integers, floats and numeric strings cannot substitute for `BigInteger` arguments. [Installed checks](evidence/php-alpha-uint32-boundaries-20260918.md) cover strict and weak callers, payload elements, callback arguments and results, returned closures, rejected inputs and cleanup.



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
