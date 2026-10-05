# PHP-Wasm methods and properties

Acceptance requires `npm run test:owned-php-wasm-receivers` to pass all seventeen
tests without skips. The execution receipt binds that run to its thirteen
reports and the sources used to produce them.

The complete run passed all seventeen tests with no failures, cancellations or
skips. Each ordinary and reviewed runtime passed 2,643 checks in both weak and
strict PHP, including allocation failures, retained exceptions and cleanup.

The wasm32 Zend adapter generates nominal owner classes, camelCase methods and
read-only properties from checked Lean contracts. Receiver and remaining-argument
anchors retain their original owners. Consuming methods invalidate shared roots
at handoff; independent retained owners survive. Plain resources work without
callbacks or borrowed-result contracts. Callback-only lifetime support remains
independent of receiver and result-anchor support.

The required gate compiles ordinary source and reviewed contracts, exercises
allocation failures, retained exceptions and request bailouts, and rejects eight
parsed semantic mutations before rerunning the restored implementation. A native
Zend companion covers Fiber suspension and fork guards. It is not Wasm Fiber
execution.

Full and resource-only npm/Composer releases must install offline after producer
removal and run in Node and Chromium under weak and strict PHP, with startup and
first-call loading. Independent builds and reassembly must reproduce archives.
The exact documentation example must run from an installed mixed C/PHP-Wasm
release in both loading modes.

The first mixed documentation run exposed a missing receiver capability during
native-model reconstruction in the combined builder. The verifier now admits
receiver reconstruction while retaining exact model and source-API agreement.
The same installed example remains the regression test.

This milestone does not add callback-result anchors, asynchronous delivery,
Wasm Fibers or container acceptance, and does not promote unrelated support
matrix cells. Native PHP and prior PHP-Wasm receipts retain their recorded bytes.
