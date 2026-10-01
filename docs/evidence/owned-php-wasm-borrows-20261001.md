# PHP-Wasm borrowed results

Plan node: 1219. The [execution receipt](owned-php-wasm-borrows-20261001.json)
records compiler inputs, generated sources, original installed archives and
consumer observations. Earlier receipts remain unchanged.

Packages with owner-anchored results expose whole `Value` owners. `share()`
adds a root to the same owner; `retain()` makes an independent owner. Closing
the last root expires borrowed descendants, including empty arrays, lists,
`None` and nested empty values. Consuming calls hand off the original native
slot. The root, active call and retained exception lifetimes stay separate.

Run the complete acceptance suite with:

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-php-wasm-borrows
```

The suite requires twelve passing tests with no skips or cancellations. Both
ordinary-source and reviewed-IR probes execute 2,595 checks in weak and strict
32-bit PHP. Each probe covers 26 public exports, 19 anchored results, four
consuming exports, canonical resource identity, recursive values, callbacks,
returned closures and reentrant owner close/consume. Fault injection tests
Zend allocation and PHP construction failures while retaining 448 exceptions.
Native allocation and identity counts return to zero.

Six deliberately broken implementations must parse or compile successfully,
then fail the original semantic assertions. Each compiler path also executes
36 request bailout/recovery cases. Separate borrow-only builds exercise empty
owners without consuming exports on both compiler paths.

The pinned Wasm PHP host does not execute Fibers. A separately compiled native
Zend companion checks Fiber and fork rejection and deferred implicit cleanup
in weak and strict PHP. It generates native-width carriers independently and
does not count those executions as Wasm coverage.

The standalone CLI builds npm component/runtime archives and a Composer ZIP.
Both compiler paths install the original archives offline, remove producer
and handoff inputs, and execute in Node and Chromium. Embedded and Composer
loading each run in startup/lazy and weak/strict modes, with 176 assertions per
arrangement. Independent rebuilds and archive reassembly must reproduce the
original bytes. Altered ownership metadata and re-signed source drift reject.

The unchanged documentation example runs from a combined C/PHP-Wasm release
and prints `42`, `expired`, `42`. The combined builder checks source API
agreement while retaining separate native and wasm32 compilations.

The receipt reconstructs generated sources, fault probes, semantic mutants,
package manifests and installed inventories. Unanchored packages retain their
previous generated source bytes. CI requires the enabled suite's TAP totals
and all seven execution reports, and retains them as artifacts.

JS/TS and WIT/WASI owner-anchored results, receiver/callback-result anchors and
the final Docker audit remain unfinished. This receipt makes no registry
publication or unrelated support-table promotion claim.
