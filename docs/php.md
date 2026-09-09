# PHP

Install the prepared Alpha package for the PHP runtime that will execute your application. Both profiles expose the generated `LeanAlpha` classes and functions, including copied values, `Box` resources, PHP callbacks, and returned Lean closures.

## Use a prepared release

| Application | Guide | Tested runtime |
| --- | --- | --- |
| PHP CLI or a native PHP deployment | [Native PHP](consume/php-native.md) | PHP 8.2 NTS, x86-64 Linux, glibc 2.38 or newer |
| PHP hosted by a Node application | [PHP-Wasm](consume/php-wasm.md) | Node 22, PHP 8.4, `php-wasm` 0.1.0 |

The native release includes its compiled extension, Lean runtime, and Composer library. The PHP-Wasm npm archive includes its compiled side modules and loader metadata. Installing either prepared package needs no Lean compiler.

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
