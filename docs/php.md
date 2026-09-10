# PHP

Install the prepared Alpha package for the PHP runtime that will execute your application. Both profiles expose the generated `LeanAlpha` classes and functions, including copied values, `Box` resources, PHP callbacks, and returned Lean closures.

## Use a prepared release

| Application | Guide | Tested runtime |
| --- | --- | --- |
| PHP CLI or a native PHP deployment | [Native PHP](consume/php-native.md) | PHP 8.2 NTS, x86-64 Linux, glibc 2.38 or newer |
| PHP hosted by a Node application | [PHP-Wasm](consume/php-wasm.md) | Node 22, PHP 8.4, `php-wasm` 0.1.0 |

The native release includes its compiled extension, Lean runtime, and Composer library. The PHP-Wasm npm archive includes its compiled side modules and loader metadata. Installing either prepared package needs no Lean compiler.

### Type conversions

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

In PHP-Wasm, a Lean result above `PHP_INT_MAX` cannot be represented. Alpha's `roundTrip` increments its count, so input `2147483647` cannot produce a representable count. The prepared Alpha API exposes no `Nat`, `Int`, floating-point, optional, or asynchronous operations.

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
