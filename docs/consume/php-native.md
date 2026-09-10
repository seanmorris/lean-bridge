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

Profiles: Native PHP. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `void` (result) | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping (input, field, callback input, callback result); Generator inspected (result) | PHP void is return-only; there is no valid void parameter or property representation. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `bool` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Native 64-bit PHP represents the full 0..4294967295 range. Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `LeanAlpha\BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | BigInteger is a generator projection; no installed full-range transport acceptance is recorded. Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: -128..127; reject overflow before narrowing. |
| `Int16` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | The generated int spelling requires 64-bit PHP. PHP-Wasm's 32-bit int does not provide this full range. Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `Generated BigInteger value` (input, result); `LeanAlpha\BigInteger` (field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | BigInteger is a generator projection; no installed full-range transport acceptance is recorded. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `Generated BigInteger value` (input, result); `LeanAlpha\BigInteger` (field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | BigInteger is a generator projection; no installed full-range transport acceptance is recorded. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `float` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `float` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `string` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `LeanAlpha\Bytes` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `array; list<T>` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `T\|null (non-null payload only)` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Generation rejects nested Option and Option Unit with ambiguous-nullable-option. Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `array with fixed positions` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Generated value class (Alpha: LeanAlpha\Payload)` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
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

The [PHP-Wasm profile](php-wasm.md#type-conversions) uses the same PHP classes but has a smaller host integer range.

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
