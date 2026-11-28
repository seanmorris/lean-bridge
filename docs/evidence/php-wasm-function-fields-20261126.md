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

For a Lean function passed directly to the PHP visitor, set
`LEAN_BRIDGE_ZEND_TARIFF_REQUIRE_INCOMING=1`. The
[application](../../tests/fixtures/structured-types/tariff-zend-direct.php)
checks live identity, expiry, retention, the original exception, nested
failure, and independent captures using the wasm32 `BigInteger` API. The
host keeps a working closure alive, explicitly closes the binding and
samples the same broker before and after that close. A separate check
refreshes PHP and reopens the package. The field-only packages above
predate this export.

`npm run test:zend-direct-transport` is a smaller compiler check: it takes
an authenticated `visitQuote` Lean stage, verifies the optional capability,
compiles the generated Zend C against the wasm32 PHP headers, and checks the
method on the generated PHP class in the real PHP 8.4 interpreter. It does
not replace either installed-package run.

The shutdown control also passed against the original ordinary
[input-record package](php-wasm-host-inputs-20261126/ordinary.json) in
PHP 8.4 on Node. Its existing application observations were unchanged;
the broker saw a live callable before the explicit close and zero after
it in the same request. In a separate lazy-load run, the public flat
callback returned 5 with zero live identities, and the refreshed binding
returned 42 with zero. Neither run used the new direct visitor.
