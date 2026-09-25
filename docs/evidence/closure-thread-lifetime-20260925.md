# Closure thread lifetimes

Plan node: 1219. Baseline: `2273d357fc959cf88bf7b0e1aea70e908ba1ba4d`.

The older native closure registry used operating-system thread IDs. The OS can
reuse an ID after its thread exits. Installed C packages reproduced this bug on
both ordinary-source and reviewed-IR paths: all 16 replacement threads invoked
the departed creator's UInt32 and String closures.

The repaired registry uses nonrepeating thread-lifetime serials. The same installed
consumer rejects every replacement-thread invocation, preserves failed outputs
and still accepts closures created by the calling thread. Each source path passes
204 checks and ends with zero live identities. Both executions repeat after the
author sources, consumer sources, headers and package archives have been removed.

The registry probe passes 8,469 checks per token width, normally and under ASan,
UBSan and LSan. It tests departed creators, wrong signatures, full registries,
the last available thread serial and exhaustion without wrapping. Both deliberate
faults, removing thread binding and permitting serial wraparound, compile and
fail at runtime. The 32-bit token probe runs on the native test host; it is not a
WebAssembly execution claim.

Fresh existing structured package regressions pass on both source paths: 5,999
C checks and 9,366 C++ checks, including 5,956 injected C++ allocation failures
per path. Complete generated native outputs differ only in the five recorded
thread-lifetime edits; non-callable outputs remain byte-identical.

```sh
LEAN_BRIDGE_C_CLOSURE_THREAD_TEST=1 node --test \
  tests/closure-thread-contract.test.mjs tests/closure-thread-installed.test.mjs
```

The [execution record](closure-thread-lifetime-20260925.json) retains the original
failure and repaired installed results. The [code-generation comparison](closure-thread-codegen-20260925.json)
and [source transition](closure-thread-lifetime-integration-20260925.json) preserve
the previous receipts. Inventory 0.98.1 adds no support claims or type cells.
