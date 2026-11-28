# Immediate Lean iterators in installed PHP-Wasm packages

An installed PHP function returned an `IteratorAggregate` backed by a
compiled Zend extension in the interpreter's own Wasm heap. Opening a
cursor did not pull an item. PHP called Lean once per demand, without a
pthread runtime, JS iterator, or scheduler.

| Source route | Verified package-set SHA-256 |
| --- | --- |
| Ordinary Lean source | `a63424231fcd1de5aaaac56a513c82f2fd9b1a207a06227db868991a0e3536d7` |
| Independently rechecked Binding IR | `4c5cb618a9f90bb6563d4cd5f476e3be2c714abf041ce7b47aed29ea802cf529` |

The [installation test](../../tests/helpers/php-wasm-io-installed.mjs) built both
routes from the [Pulls declarations](../../tests/fixtures/javascript-immediate/Pulls.lean).
For each route it installed npm archives and a Composer ZIP offline, removed
the source project, release and package feed, then ran the relocated app in
the PHP 8.4.1 Node and Chromium hosts. Both used eager and lazy loading with
both embedded and Composer-supplied PHP bindings: **16 consumer runs**.

The [PHP client](../../tests/fixtures/php-wasm-sync-io-probe/immediate.php)
checked exhaustion, early exit, repeated close, a yielded unit, returned
`Ok` and `Err` values, constructor and step failures, and the identity of
the application's exception. It observed twelve pulls and seven closes
before teardown. An ordinary second `php.run()` left the retained cursor
live. The host's `refresh()` ended that request; the next request saw nine
closes. One additional close came from the retained PHP cursor, the other
from a bare Zend resource with no PHP cursor object. Passing that resource
to another iterator's private entry failed without advancing either cursor.

A separate [32-bit Zend decoder test](../../tests/fixtures/php-wasm-sync-io-probe/cursor-frames.php)
substituted malformed frames at the private transport. The generated decoder
requested retirement for a value in place of an open cursor, an end marker
with data or tag padding, an error on the wrong channel, and a malformed
unit. The two valid declared failures kept their type and declaration without
requesting retirement. This tests the decoder, not a failure of the compiled
Lean algorithm.

Run `npm run test:php-wasm-immediate-cursor` with the prepared single-threaded
[PHP-Wasm author inputs](../contributing/author-toolchain.md#php-wasm),
`LEAN_BRIDGE_PHP_WASM_HOST` set to the installed `php-wasm@0.1.0`
directory, and `LEAN_BRIDGE_PHP_WASM_BROWSER_TEST=1` for the browser runs.
Use `CHROMIUM_PATH` to select Chromium. This qualifies local, in-memory
synchronous iteration, not asynchronous delivery or abrupt destruction of
the entire Wasm instance.
