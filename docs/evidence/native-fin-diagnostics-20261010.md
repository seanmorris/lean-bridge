# Native Fin diagnostic paths: first installed check

Producer: `f16b01fdc1790322130887f68a66b0f7b19cb7a2`, on
`agent/native-fin-diagnostic-paths-vo1442`. This is the first installed check
for the shared C validator's nested error paths in VO #1442.

The [original report](native-fin-diagnostics-20261010/ordinary-c-cpp.json)
records 2,064 C checks and 2,053 C++ checks. The
[original TAP](native-fin-diagnostics-20261010/ordinary-c-cpp.tap) records
one passing installed test, with no failures or skips.

Both author roots produced identical package archives. The harness removed
the author and build roots before offline installation and ran the public
consumers without a Lean compiler. The consumers require exact field, case,
product, result and optional-value paths, including actual first, middle
and last array/list indices. Existing invalid-input, recovery and
caller-immutability assertions still pass.

The separate C interposer observes source and checked-adapter entry.
Valid public calls increment both counters. Invalid public calls increment
neither. Raw invalid calls enter the checked adapter but never enter the
source body. C++ dispatch was not measured.

The host reports glibc 2.36; the run explicitly configured a 2.36 package
floor. These are local observations, not hosted release-floor acceptance.
The report records archive digests and sizes. The binary archives were
removed by the installed harness and are not retained here.

Run from the producer checkout:

```sh
export LEAN_BRIDGE_LEAN_PREFIX=/path/to/lean-4.32.2
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36
export LEAN_BRIDGE_FIN_RECORD_PROFILES=c,cpp
export LEAN_BRIDGE_FIN_RECORD_REPORT=/path/to/ordinary-c-cpp.json
node --test --test-concurrency=1 \
  --test-name-pattern='^relocated source-free native packages check Fin inside record fields and the active variant case$' \
  tests/native-fin-records.test.mjs
```

The recorded run used CPU 3 and
`/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2`.
The original report and TAP were copied without changing their bytes:

| Artifact | SHA-256 |
| --- | --- |
| `ordinary-c-cpp.json` | `31b27a9cc5b78f4bfd979ede83ce9bf0d70e9e2ebd0dcb00a0b2cf46859d6387` |
| `ordinary-c-cpp.tap` | `e824c012d8a90820c942e690186e845642f7aa261873090cd9d2e26902095738` |

The shared validator reports source field and case names, even when a host
binding spells them differently. For example, an inherited `toDigit` field
reports `arg0.toDigit.digit`. Tuple members use `.0` and `.1`, result branches
use `.ok` and `.error`, a present option adds `?`, and arrays/lists add the
actual zero-based index. `arg0[1]?[2].circle.radius` identifies the failed
radius inside a nested container. Top-level scalar messages are unchanged.

Indexed messages use thread-local storage and format only after a failed
bound check. The generated formatter preserves long paths; existing bridge
error channels still impose their 1,023-byte message limit.

This check does not cover the new messages in reviewed packages, other
native consumers, PHP-Wasm, or callback/closure packages. Their installed
checks and support-table reconciliation remain pending. The
[source-history transition](native-fin-diagnostic-source-history-20261010.json)
preserves earlier producer bytes and refreshes current source hashes without
changing historical receipts, observations or support claims.
