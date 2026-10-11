# Nominal Subtype C/C++ acceptance harness

This milestone prepares installed C/C++ acceptance for VO #1444. The fixture
already has installed Node JavaScript/TypeScript evidence. This note does not
claim a successful native package run or promote a native support cell.

The shared Lean fixture exports 26 functions in the full selection and 13 in the
standalone result-only selection. Ordinary configurations and independent
reviewed APIs come from `tests/helpers/nominal-subtype-installed-fixture.mjs`.
The result-only package has no input-constructor configuration.

The new C11 and C++20 callers under `tests/fixtures/nominal-subtype-consumers/`
cover per-use normalization, repeated records, variants, aliases, mixed Fin
guards, exact 100-bit results, late refusals and 1,000 recovery iterations.
The C caller uses GMP values and checks that refusals preserve existing outputs
as well as borrowed inputs. The C++ caller uses the public value and exception
types. All eight route/mode/language combinations compile against generated
public headers with warnings treated as errors. Header compilation alone does
not execute Lean or a package.

`tests/helpers/nominal-subtype-native-installed-tests.mjs` defines four explicit
ordinary/reviewed, full/result-only gates. Each gate builds C and C++ packages
from two independent author roots, checks unchanged author inputs, reproduces
models, receipts and archives, and removes both author roots before installation.
The callers compile against the offline installed packages. The harness then
moves each actual installed consumer directory and replays the same executable
with no compiler or Lean tools on PATH. Archive closure, source bytes and
executable hashes must remain unchanged around both executions.

The reports retain original models, package receipts, author-input snapshots,
caller sources, compiler versions and the observed glibc runtime. The native
glibc floor must be selected explicitly. Constructor/source entry counts and
memory usage are not measured by these callers.

Run one case at a time with a new output directory. On this Linux/glibc 2.36 host:

```sh
LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_TEST=1 \
LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_PROFILES=c,cpp \
LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_ROUTES=ordinary \
LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_MODES=full \
LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_OUTPUT=build/nominal-native-run-1 \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 \
nice -n 19 ionice -c 3 taskset -c 3 \
  node --test --test-concurrency=1 \
  tests/helpers/nominal-subtype-native-installed-tests.mjs
```

Change the route to `reviewed` or the mode to `result-only` for the other cases.
`LEAN_BRIDGE_LEAN_PREFIX` selects the prepared Lean toolchain. Invalid switches,
duplicate selections and existing output directories fail rather than silently
skipping. Failed temporary inputs remain available for diagnosis; successful
temporary installations are removed.

The caller and installed-gate helpers are registered through the existing
nominal fixture tests. Native metadata tests remain in their original helper;
the new public-header caller tests use a separate filename.

The component, author, support-inventory, documentation and test-registration
regression passed 144 tests with no failures. Ten expensive cases were explicitly
skipped: two existing compiler/source cases and the four npm plus four native
installed gates. All eight native public-header compilations passed in that run.
The log is `build/vo1444-nominal-native-harness-regression-r2.tap`, SHA-256
`31c0e6d8b446e22806d2aaeef40584b2d34f1e6479ea06e36b0ecb33dabe0d79`.

Next: execute and preserve all four native cases before recording installed
support. Perl and the other native hosts, browser contexts, PHP-Wasm, measured
entry probes and the remaining callback, owned, recursive and generic Subtype
requirements remain open. No part of #1220 is closed by preparing this harness.
