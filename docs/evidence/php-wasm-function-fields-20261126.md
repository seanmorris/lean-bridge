# Keeping a function field in wasm32 PHP

The same [PHP application](../../tests/fixtures/structured-types/tariff-zend.php)
ran on the [ordinary](php-wasm-function-fields-20261126/ordinary.json) and
[reviewed](php-wasm-function-fields-20261126/reviewed.json) Tariff packages.
Each route ran on PHP 8.4 in both Node and Chromium, loading at startup
and on first use, from both the npm-bundled API and the Composer autoloader:
**16 installed executions**. These are Zend calls from PHP, not calls to
the JavaScript binding. The records identify the original archives, installed
host, compiled interface, consumer and independent observer.

The application saved a function from a record, closed the original owners,
and used its retained function directly, in another record and as the
function returned from a callback. Lean applied the callback result to get
44. A PHP closure stored past the end of its borrowing call was refused
both directly and through Lean (status 10, zero entries); a closed function
supplied as a field was refused with status 4.

A callback allocated and closed another function, then threw an exception.
The caller caught the original PHP exception object; a subsequent call
returned 42. The observer saw **0 → 2 → 0** live identities. After a PHP
request refresh in the same host the program called the package again,
returned 42, and measured zero live identities.

Run `npm run test:php-wasm-function-fields` with the
[PHP-Wasm author toolchain](php-wasm-installed-sync-io-20261123.md).
Set `LEAN_BRIDGE_ZEND_TARIFF_KEEP` to an existing scratch directory to
retain the handoffs. Set `LEAN_BRIDGE_ZEND_TARIFF_REPLAY` to their common
directory instead to install the same releases again without rebuilding Lean.
