# PHP-Wasm records keep the original Zend objects

Workshop and Sidekick were built as separate Lean components. The PHP
[application](../../tests/fixtures/php-wasm-task-owner/zend-records.php)
constructed a record containing its own two boxes, bytes and a 131-bit
integer. Compiled Lean constructed and flipped records and returned a
function that still selected the original boxes after its input closed.
During another call, a PHP member closed the input record. The in-flight
call kept its arguments alive and returned 42. After Workshop closed,
Sidekick changed the same PHP object read from the returned record.
Dropping the last PHP reference cleared its weak reference.

A bad second record was refused before the first member ran. An exception
from a PHP method reached the caller as the same object. When a staged
result exceeded its copy budget, no partial row escaped, the intermediate
box's weak reference cleared, and a previously created closure still worked.

The error-owner check uses a different signature: `Workshop.checked : Box → EIO Box UInt32`.
PHP caught the generated exception and closed the binding that produced it.
After the original variable was unset, Sidekick set the payload's level to
42. Only dropping the exception cleared the weak reference. The client
disabled exception backtrace arguments so they could not keep the box alive.

The [ordinary](php-wasm-host-record-20261126/ordinary.json) and
[reviewed](php-wasm-host-record-20261126/reviewed.json) receipts identify
the same runtime, independent components and actual PHP source. On both
routes, PHP 8.4 ran the program with the embedded and Composer autoloaders
in Node and with the embedded API in Chromium without cross-origin isolation.
The embedded Node client also ran the [two-interpreter check](../../tests/fixtures/php-wasm-task-owner/installed-realms.mjs):
each interpreter kept a record and a closure across a rendezvous, then
recovered the box and bytes belonging to its own class. These checks are
for the standalone runtime, not the pthread worker profile.

To reproduce, use the [PHP-Wasm host setup](php-wasm-retained-callback-packages-20261124.md#reproduce)
and the ordinary Wasm author toolchain; the pthread SDK is unnecessary.
Set `LEAN_BRIDGE_PHP_WASM_HOST` to the installed interpreter directory
and `LEAN_BRIDGE_CHROMIUM` to the browser executable if needed. Run
`npm run test:php-wasm-zend-records`. To keep the original releases, set
`LEAN_BRIDGE_PHP_ZEND_PACKAGE_OUTPUT` to an existing scratch directory. To
replay, set `LEAN_BRIDGE_PHP_ZEND_PACKAGE_REPLAY` to the generated directory
containing `ordinary`, `reviewed` and `peer` instead.
