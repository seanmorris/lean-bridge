# Checked Subtype generation for PHP-Wasm

The plain copied wasm32 model now accepts top-level primitive-base `Subtype`
parameters and results on ordinary and independently reviewed source routes.
It reuses the existing typed native adapters. The exported validator constructs
and releases its own value; the call adapter constructs again and passes that
value to the Lean export. A rejecting constructor returns an error, without a
fabricated proof or fallback value. Results project the proof-backed base value.

The PHP-Wasm model still rejects nested Subtype and packages combining refinements
with callable, graph or owned transports. Installed Node/Chromium execution and
constructor/source/adapter entry counts remain pending. No installed support
cell changes in this source milestone.

## Fresh Lean checks

The [successful original log](php-wasm-subtype-source-20261010/fresh-lean.tap)
records 14 passing checks, zero failures and two explicitly skipped installed
package gates. Its SHA-256 is
`aca32e2022b3b6ddbc06213012db6700d404adb73dd52fbd572deec6c4e152e7`.
The command was:

```sh
LEAN_BRIDGE_PHP_WASM_SUBTYPE_LEAN_TEST=1 \
  node --test --test-concurrency=1 tests/helpers/php-wasm-subtype-tests.mjs
```

Both ordinary and reviewed configurations compile the full Lean fixture and its
generated adapters. The wasm32 model retains all twelve export decisions. The
fixture includes String, Nat, Int, ByteArray and UInt8 bases; a mixed Fin/Subtype
signature; two checked arguments; normalization; two constructor choices for one
generic function; and a zero-argument refined result. A changed review choosing
another valid normalizing constructor also compiles.

Eight negative cases reject a wrong constructor input base, wrong result subtype,
unsafe implementation, partial implementation, constructor outside the selected
source closure, missing constructor, contradictory Fin bound and contradictory
transport. Each checks that no output directory exists after rejection.

These checks stop after Lean compiles the generated adapters, before C/Emscripten
compilation or package production. They do not execute a PHP consumer or measure
constructor calls. The installed test harness retains all native PHP consumer
cases and adds eight checks, but those installed gates have not run yet.

The [first failed log](php-wasm-subtype-source-20261010/original-selection-failure.tap)
is retained with SHA-256
`e23720bf3f98986c78c82992d6075926637d4d3f8adc28716865caf81b86cadc`.
Its ordinary fixture omitted the two specialized names from the export selection.
The corrected fixture includes them, and a configuration-validation regression
catches that error before invoking Lean.

## Source history

The checks ran on the source-admission changes above parent
`bcc816d696f8285b4eaae6aa98d915f1a8a80b5f`.
The [history ledger](php-wasm-subtype-source-history-20261010.json) records twelve
exact transitions. Its SHA-256 is
`4c620679ca2b753d21fe0b1d0b9537c25af8e24d0c001a320b500ae5230cd636`.
An independent comparison with Git authenticates every predecessor and confirms
191 current-source-hash updates. All 405 evidence entries and 507 observations
retain their earlier acceptance claims; older ledgers and reports are unchanged.

The focused history, inventory and model regression passed all twenty checks.
Checked JavaScript and all sixteen generated reference pages also passed.
The nine-root integration regression passed 213 tests with zero failures and
seventeen explicitly gated compiler/installed checks. Full lint passed. The
integration log is `build/vo1443-subtype-integration-r1.tap`.
