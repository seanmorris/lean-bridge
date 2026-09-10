# PHP-Wasm

Run the generated `LeanAlpha` PHP API inside a Node-hosted PHP 8.4 runtime. The npm package supplies the Lean runtime, component side modules, PHP extension, Composer sources, and loader metadata.

## Use a prepared release

### Prerequisites

Use Node 22 and npm with `php-wasm` version `0.1.0`. This guide selects PHP `8.4`, the version covered by the PHP-Wasm consumer profile. Browser-hosted PHP and other PHP versions need separate acceptance work.

The application uses a completed package and needs no Emscripten or PHP compiler.

### Obtain and install the package

Request the Alpha npm archive `php-wasm-lean-alpha@0.0.0`. [Authenticate the archive](receive-package.md) before installation. The lazy and startup builds share the npm coordinate but have distinct archive subjects and graph profiles in their release receipts. Choose one profile and verify its exact archive.

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

### Type conversions

Profiles: PHP-Wasm. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `void` (result) | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping (input, field, callback input, callback result); Generator inspected (result) | PHP void is return-only; there is no valid void parameter or property representation. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `bool` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | PHP-Wasm accepts only 0..2147483647 as positive PHP integers; VO1206 tracks exact upper-half conversion. A result above PHP_INT_MAX fails. Required: 0..4294967295, including on hosts with 32-bit signed integers. |
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

The API values below are PHP values inside the PHP-Wasm instance, not JavaScript values in the Node host. Keep `declare(strict_types=1)` in the PHP application file.

| Lean type | PHP-Wasm type | Conversion rules |
| --- | --- | --- |
| `Bool` | `bool` | Pass `true` or `false`. |
| `UInt32` | `int` | This PHP 8.4 Wasm host has 32-bit signed integers: positive inputs and results must fit `0..2147483647`. |
| `String` | `string` | Valid UTF-8 text; embedded NUL is preserved. |
| `ByteArray` | `LeanAlpha\Bytes` | Use `Bytes::fromString` and `toString()` for binary data, not a JavaScript typed array. |
| `Array UInt32` | `array` documented as `list<int>` | Sequential keys starting at zero; each element must fit the PHP-Wasm integer range. |
| `Payload` | `LeanAlpha\Payload` | Readonly copied PHP value; the transport does not serialize it as JSON. |
| `Box` | `LeanAlpha\Box` | Resource tied to its PHP-Wasm instance; close it in `finally`. |
| `UInt32 → UInt32` callback | PHP `callable` taking and returning `int` | Synchronous PHP callback, not a Node function; the host integer limit applies to its result too. |
| Returned Lean closure | `LeanAlpha\Transform` | Invokable PHP resource; call it in its originating instance and release it with `close()`. |

The full Lean `UInt32` range is not representable by this PHP-Wasm API. `4294967295` becomes a PHP float and a strict `int` argument rejects it. A Lean result above `PHP_INT_MAX` can also fail during return conversion: Alpha's `roundTrip` increments its count, so input `2147483647` cannot produce a representable count. Use [native 64-bit PHP](php-native.md#type-conversions) when you need the full unsigned range.

Node's `bigint` support does not extend the integer range inside PHP.

### Types, ownership, and errors

PHP-Wasm exposes the same copied `Payload`, binary `Bytes`, canonical `Box` identity, PHP callbacks, and invokable Lean closures as [native PHP](php-native.md#types-ownership-and-errors). Alpha changes the record's Boolean and count; the callback and returned callable each produce `42` in this example.

The `finally` blocks close the returned callable and the box even when a call fails. Closing a resource twice is allowed; using a closed wrapper raises `LeanAlpha\DisposedResource`. Keep each resource in the PHP-Wasm instance that created it. A second instance owns a separate Lean heap and identity domain.

Handle both JavaScript initialization failures and PHP failures. The host example throws on a nonzero PHP exit status or PHP error output. Explicit PHP comparisons keep the example's checks active when assertions are disabled.

### Troubleshooting

- **The process prints nothing:** add the `output` listener and forward the captured text as above. Waiting for `php.run()` alone does not print PHP output.
- **The extension or a side module fails to load:** use PHP `8.4`, `php-wasm@0.1.0`, and the complete generated package. Do not mix assets from lazy and startup archives.
- **The autoloader is missing:** pass the imported descriptor in `sharedLibs` before awaiting `php.binary`. Node's `vendor/` directory is not PHP's virtual `/vendor/` directory.

## Start from a raw Lean package

For Alpha, follow the [PHP-Wasm package build](../publish/npm.md#publish-the-php-wasm-profile) with its pinned PHP source and Emscripten environment. Build and pack the selected lazy or startup profile, then install that completed archive using the [prepared release steps](#use-a-prepared-release). Local build and pack commands do not require uploading it.

For another Lean library, check the [source workflow and supported targets](../consume.md#start-from-a-raw-lean-package). These Alpha builds use the repository's target-specific inputs.

### Acceptance checks

Contributors run these files through the [installed consumer checks](../contributing/testing.md#consumer-acceptance). See the [PHP release evidence](../evidence/php-release-gate.md) for package reproducibility, callbacks, closures, and identity cleanup.

### Publish this package

See [Publish the PHP-Wasm npm package](../publish/npm.md#publish-the-php-wasm-profile) for package preparation, distribution, and verification after upload.
