# PHP

Install the prepared Alpha package for the PHP runtime that will execute your application. Both profiles expose the generated `LeanAlpha` classes and functions, including copied values, `Box` resources, PHP callbacks, and returned Lean closures.

## Use a prepared release

| Application | Guide | Tested runtime |
| --- | --- | --- |
| PHP CLI or a native PHP deployment | [Native PHP](consume/php-native.md) | PHP 8.2 NTS, x86-64 Linux, glibc 2.38 or newer |
| PHP hosted by a Node application | [PHP-Wasm](consume/php-wasm.md) | Node 22, PHP 8.4, `php-wasm` 0.1.0 |

The native release includes its compiled extension, Lean runtime, and Composer library. The PHP-Wasm npm archive includes its compiled side modules and loader metadata. Installing either prepared package needs no Lean compiler.

### Type conversions

Profiles: Native PHP, PHP-Wasm. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `void` (result) | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping (input, field, callback input, callback result); Generator inspected (result) | PHP void is return-only; there is no valid void parameter or property representation. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `bool` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Native PHP: Native 64-bit PHP represents the full 0..4294967295 range.; PHP-Wasm: PHP-Wasm accepts only 0..2147483647 as positive PHP integers; VO1206 tracks exact upper-half conversion. A result above PHP_INT_MAX fails. Required: 0..4294967295, including on hosts with 32-bit signed integers. |
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

See the [native PHP conversion table](consume/php-native.md#type-conversions) or the [PHP-Wasm conversion table](consume/php-wasm.md#type-conversions) for the profile's ownership rules and examples.

### Verify the native release

[Authenticate a distributed archive](consume/receive-package.md) before loading its extension. The [native release evidence](evidence/native-php-release-package.md) records package contents, ABI checks, and the two-build comparison.

### Install Composer autoloading

Follow the [native installation](consume/php-native.md#install-the-composer-files), then run its complete PHP program. The program prints checked results and closes resources even when a call fails.

### PHP-Wasm alternate transport

The [PHP-Wasm guide](consume/php-wasm.md) installs the generated npm archive into a clean Node project and forwards PHP output to the terminal. Lazy and startup profiles use the same PHP API but have separate release identities. The supported host is Node-based PHP 8.4; browser PHP is not covered by this consumer profile.

## Start from a raw Lean package

The [source-package overview](consume.md#start-from-a-raw-lean-package) distinguishes the ordinary Lake-project npm workflow from these target-specific Alpha builds. The ordinary npm package does not include a PHP extension.

### Build the pinned native package

The [contributor testing guide](contributing/testing.md#native-php-package) gives the pinned Nix build command and identifies the output directory. With that package complete, follow the [native PHP installation](consume/php-native.md#obtain-the-package).

For PHP-Wasm, follow its [package build and archive preparation](publish/npm.md#publish-the-php-wasm-profile), then use the [installed consumer example](consume/php-wasm.md).
