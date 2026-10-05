# Recursive WIT packages

The `wit-wasi` builder now produces a prepared archive for the recursive copied
contract. Both ordinary-source and independently reviewed-IR packages passed
source-free installation checks. Each consumer exercised all eighteen exports,
including rejection of the uninhabited recursive type, and all nineteen scalar
types. Each run recorded 73 assertions, 33 successful helper calls and eleven
rejected inputs. The consumer ran twice after removal of author sources,
installed headers and the archive handoff.

The public header adds typed `*_wasmtime_value_*` helpers and stable names such
as `recursive_envelope_outcome_t` and `recursive_units_result_t`. Callers use
named constructor constants from the header. They do not assemble transport
tables or discover hashed type names. These helpers invoke the compiled
Component Model binary before calling native Lean.

An independent process opened the host with `dlopen`, obtained an owned result,
closed its session and library handle, then read and cleared the result. The
host carries the `NODELETE` flag so its cleanup function remains mapped.

Separate processes interposed a test-only native result. A malformed constructor
retired the shared runtime and caused both sessions to reject later calls. A
node-limit failure left both sessions usable. The installed libraries remained
unchanged during these probes. Compiler-free reassembly reproduced each original
archive. Re-signing three graph-receipt variations and eight generated-source
mutations did not bypass artifact checks.

The sanitizer rerun passed fourteen round-trips, thirteen malformed-input cases,
263 malformed-output cases, 132 injected scratch-allocation failures and
input/output budget failures. Its allocation ledger ended at zero. Node-limit
failures now retain their conversion-limit classification on both sides of the
WIT boundary.

Run the installed and independent-rebuild gates separately:

```sh
LEAN_BRIDGE_WIT_GRAPH_INSTALLED_TEST=1 node --test tests/wit-copied-graph-package.test.mjs
LEAN_BRIDGE_WIT_GRAPH_REPRO_TEST=1 node --test tests/wit-copied-graph-package.test.mjs
```

Independent fresh builds produced the same archive hashes on both source paths.
The reports are `build/recursive/wit-packages.json` and
`build/recursive/wit-reproducibility.json`; the
[execution record](wit-recursive-packages-20260924.json) retains their original
contents and logs.

Fresh shared-backend regressions passed for recursive C/C++, Python, Ruby, Rust
and Perl packages, Java/Kotlin collections, and the existing WIT collection and
primitive callback/closure packages. The Perl gate completed 32 source-free
installations across two independent builds, both source paths, four interpreter
configurations and two installation modes. The six native regression gates retain
their original package archives and public observations. The WIT collection gate
retains its public behavior and six generated WIT artifacts.

The [regression record](wit-recursive-package-regressions-20260924.json) stores the
fresh observations and passing logs. The
[integration record](wit-recursive-package-integration-20260924.json) binds every
source change to exact reversible edits. Historical receipts retain their original
hashes. All 101 historical evidence checks passed; the support inventory changes
only current source fingerprints.

Cross-package composition and conflicts, an executed consumer documentation
example and final installed acceptance remain open. The inventory stays at sixteen
accepted copied-recursive profiles out of seventeen. This milestone does not
complete structured callbacks, closures or explicitly owned resource aggregates.
