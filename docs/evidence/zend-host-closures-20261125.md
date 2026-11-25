# PHP-Wasm functions that capture application PHP objects

An [installed PHP application](../../tests/fixtures/php-wasm-task-owner/zend-functions.php)
passed its own object into a Lean factory and got back a PHP invokable.
Calling it with another object returned the original instance, not a JavaScript
copy. The PHP tests used identity comparisons and weak references, including
after dropping the application's last direct reference.

## Threaded PHP-Wasm

The [installed package test](../../tests/helpers/php-wasm-zend-packages.mjs)
built an ordinary Workshop package, a reviewed Workshop package and an
independent Sidekick package. Each handoff contained a Composer API, an npm
component descriptor and a matching runtime. These are the verified
package-set receipt SHA-256 digests:

| Handoff | Receipt SHA-256 |
| --- | --- |
| Sidekick | `5595d97bf5562d80e19bd642fd8507af3100707fcad0f0cf7755b311d80926a6` |
| Workshop, ordinary | `ee87f27faf6a47bcdd59d76174d1c4c353c1df1e05f2e07559e93dd36d628701` |
| Workshop, reviewed | `8c2921f92f978c9f23275be5f65ba953c37c06da52c6d75305cf45ae23086fe9` |

Both Workshop routes ran in the Node PHP-Wasm interpreter using the embedded
PHP API and the offline Composer install, and in Chromium's PHP-Wasm
interpreter. The tests checked the original PHP exception from a factory,
from an invocation and from a retained callback. Closing a function inside
its own call refused later calls without losing the in-flight result. Closing
a binding while a callback was pending canceled its task; a sibling binding's
own callable still completed. Dropping the last capture released the PHP
object. An escaped function did not keep its binding alive.

The embedded test used two live interpreters with different PHP classes.
The [trap control](../../tests/fixtures/php-wasm-task-owner/zend-trap.php)
checked retirement and released the captured object. The successful clients
finished with zero frames, native owners, pending work, notifications, and
tracked host pins and errors.

Run `npm run test:php-wasm-zend-packages` with the verified pthread author
SDK and the PHP-Wasm interpreter.

## Standalone PHP-Wasm

The `php-wasm-zend-host-io-v1` package has no task exports. The installed
author CLI compiled all three packages without a pthread SDK. Each receipt
identified one Composer API, one npm component and the same single-threaded
runtime (archive SHA-256 `1c0b2166579321b164c02312a20c123b22226345f5343bc27c0a837826b10529`).

| Handoff | Package-set receipt SHA-256 |
| --- | --- |
| Ordinary Workshop | `53a0eec4b562339416e5bba3f4efa147363e46bb3364fef915e0a4f0f00acfbb` |
| Reviewed Workshop | `e85e4d50c9dd3f7618c21b3f326bb67843b8dc915a15c6641cd8308597c11c0f` |
| Sidekick peer | `826cc10ee87d983118ee32087e289e9b3075171b5907784695bcf28fd9421185` |

The [PHP consumer](../../tests/fixtures/php-wasm-task-owner/zend-sync.php)
ran six times: each Workshop release with Sidekick, using the embedded
library and offline Composer in Node, then the embedded library in a Chromium
page without cross-origin isolation. It compared object identity across
the two packages after a mutation. An `Except.error` remained a returned
value, an `EIO` failure carried the same PHP object, and a host exception
survived both factory and invocation. Closing the active binding was refused;
closing the active function allowed that call to finish, refused another
invocation and left the sibling callable usable. A PHP weak reference cleared
after the last capture closed.

Run `npm run test:php-wasm-zend-sync-packages` with the single-threaded
author runtime, PHP-Wasm interpreter and Chromium. These are local installed
results, not hosted or registry releases.
