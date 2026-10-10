# Native Fin diagnostic paths: reviewed C/C++ and Python

Producer: `af1dcbf8fe5e96dada23948b545c063b3e251dcc`. These runs use the
integrated nested-path validator and unchanged exact-message consumers for
VO #1442. The earlier [ordinary C/C++ check](native-fin-diagnostics-20261010.md)
remains a separate observation at `f16b01f`.

| Installed selection | C | C++ | Python |
| --- | ---: | ---: | ---: |
| Reviewed C/C++ | 2,064 | 2,053 | Not selected |
| Ordinary Python | Not selected | Not selected | 2,053 |
| Reviewed Python | Not selected | Not selected | 2,053 |

The [C/C++ TAP](native-fin-diagnostic-installed-20261010/reviewed-c-cpp.tap)
records one passing installed test with no failures or skips. The
[Python TAP](native-fin-diagnostic-installed-20261010/python311.tap) records
two passing installed tests with no failures or skips. Each selection built
at two independent author roots and produced identical archive hashes.
The harness removed author/build roots before offline installation and ran
the public consumers without a Lean compiler on PATH.

The C report measures separate source and checked-adapter entry. Invalid
public inputs increment neither counter. Invalid raw inputs enter the
checked adapter but not the Lean source; valid public and raw calls increment
both. C++ and Python dispatch are unmeasured in these runs.

The original reports cover thirteen export refinement trees, including
record fields, active variant cases, nested records, and records inside
arrays, lists, options, products and result branches. Consumer hashes bind
the exact field/case/index error assertions to the producer checkout.

Python used `/app/.toolchains/python311/bin/python3.11`, version **3.11.16**.
The local host and explicitly configured package floor are glibc 2.36.
These results do not establish the newer hosted Python patch version or
the hosted glibc floor. Binary archives were removed by the test harness;
the reports retain their digests and sizes.

Original bytes:

| Artifact | SHA-256 |
| --- | --- |
| [Reviewed C/C++ report](native-fin-diagnostic-installed-20261010/reviewed-c-cpp.json) | `8f83d39663c1c5aa35d67153acea53749fef349b9226749a7cb6090647d34c41` |
| [Reviewed C/C++ TAP](native-fin-diagnostic-installed-20261010/reviewed-c-cpp.tap) | `8277665d556056daaf5556d54026f433dec46b68179297766c05242634b5d687` |
| [Ordinary Python report](native-fin-diagnostic-installed-20261010/ordinary-python311.json) | `bc2d379cf4155a533a8bd161f0127276da51c0ba6a25555dfd21dd1b862ac1bc` |
| [Reviewed Python report](native-fin-diagnostic-installed-20261010/reviewed-python311.json) | `e6f5a365b2aa1ee51e5baab125b1f6424589a10fa73981b49b6cc4efa324a1ad` |
| [Python TAP](native-fin-diagnostic-installed-20261010/python311.tap) | `0aaf2bb06203d2922cac41ad5aaf0e056a81862b2205cdc37f0b5a47074b546d` |

The reviewed C/C++ command selected only the reviewed installed test:

```sh
export LEAN_BRIDGE_LEAN_PREFIX=/path/to/lean-4.32.2
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36
export LEAN_BRIDGE_REVIEWED_FIN_RECORD_PROFILES=c,cpp
export LEAN_BRIDGE_REVIEWED_FIN_RECORD_REPORT=/path/to/reviewed-c-cpp.json
node --test --test-concurrency=1 \
  --test-name-pattern='^independently reviewed native packages check record and variant field bounds after source-free installation$' \
  tests/native-fin-records.test.mjs
```

The Python command selected both installed tests in one serial run:

```sh
export LEAN_BRIDGE_LEAN_PREFIX=/path/to/lean-4.32.2
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36
export LEAN_BRIDGE_PYTHON=/path/to/python3.11
export LEAN_BRIDGE_FIN_RECORD_PROFILES=python
export LEAN_BRIDGE_REVIEWED_FIN_RECORD_PROFILES=python
export LEAN_BRIDGE_FIN_RECORD_REPORT=/path/to/ordinary-python311.json
export LEAN_BRIDGE_REVIEWED_FIN_RECORD_REPORT=/path/to/reviewed-python311.json
node --test --test-concurrency=1 \
  --test-name-pattern='^(relocated source-free native packages check Fin inside record fields and the active variant case|independently reviewed native packages check record and variant field bounds after source-free installation)$' \
  tests/native-fin-records.test.mjs
```

Both runs used CPU 3 and Lean at
`/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2`. This archive
does not promote new support-table claims or close #1442. Remaining host,
PHP-Wasm and affected callback/container installed checks, recurring CI,
and the complete original-scope audit remain required.
