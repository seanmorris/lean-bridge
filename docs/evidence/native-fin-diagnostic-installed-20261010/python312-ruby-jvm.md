# Python 3.12, Ruby, Java and Kotlin diagnostic acceptance

Producer: `af1dcbf8fe5e96dada23948b545c063b3e251dcc`, the same frozen
checkout as the [reviewed C/C++ and Python 3.11 batch](../native-fin-diagnostic-installed-20261010.md).

| Public consumer | Ordinary checks | Reviewed checks |
| --- | ---: | ---: |
| Python | 2,053 | 2,053 |
| Ruby | 2,053 | 2,053 |
| Java | 2,053 | 2,053 |
| Kotlin | 2,053 | 2,053 |

The [original TAP](python312-ruby-jvm.tap) records two passing installed
tests, with no failures or skips, in 449.8 seconds. Each route built the
packages at two independent author roots and reproduced their archive
hashes. The harness removed author/build roots before offline installation.
Host compilers build Java/Kotlin consumers; consumer PATH excludes the Lean
compiler. These runs do not measure source or adapter dispatch.

The public consumers require exact nested Fin field, case, structural and
element-index diagnostics. Their hashes, thirteen export refinement trees,
package/IR/model identities and source-removal facts remain in each report.
The native JVM record checks here do not exercise the separate #1454 JVM
container-edge installation guard, which is on an isolated branch.

Runtime selections were Python **3.12.14** at
`/app/.toolchains/python312/bin/python3.12`, Ruby **3.3.12** at
`/app/.toolchains/ruby33/bin/ruby`, and OpenJDK **22.0.2** at
`/app/.toolchains/jdk22/bin/java`. Kotlin used the pinned
`/app/.toolchains/kotlin-2.2.0/kotlinc/bin/kotlinc` distribution. Local glibc
and the explicitly configured package floor were 2.36. This does not prove
the newer hosted Python patch version or hosted glibc floor.

| Original artifact | SHA-256 |
| --- | --- |
| [Ordinary report](ordinary-python312-ruby-jvm.json) | `3942636105684e9117380c71bb2b1cd7cc9ba495266cb3f3dc8dc374ab369b7f` |
| [Reviewed report](reviewed-python312-ruby-jvm.json) | `765f31c3e58734d75e2f2a4f51c5b9d26c318a6d3e31189b4f5c01156625d14c` |
| [TAP](python312-ruby-jvm.tap) | `aeeec9e995a99154f67e9946e744d725fadbc2b8d94b8f068c70e63ce8d99c08` |

The command used CPU 3, Lean 4.32.2, and these settings in addition to the
explicit runtime paths above:

```sh
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36
export LEAN_BRIDGE_FIN_RECORD_PROFILES=python,ruby,java,kotlin
export LEAN_BRIDGE_REVIEWED_FIN_RECORD_PROFILES=python,ruby,java,kotlin
export LEAN_BRIDGE_FIN_RECORD_REPORT=/path/to/ordinary-python312-ruby-jvm.json
export LEAN_BRIDGE_REVIEWED_FIN_RECORD_REPORT=/path/to/reviewed-python312-ruby-jvm.json
node --test --test-concurrency=1 \
  --test-name-pattern='^(relocated source-free native packages check Fin inside record fields and the active variant case|independently reviewed native packages check record and variant field bounds after source-free installation)$' \
  tests/native-fin-records.test.mjs
```

The report bytes are unchanged. Binary archives were removed by the
harness; their digests and sizes remain in the reports. This archive adds
no support-table promotion and does not close #1442. Remaining hosts,
PHP-Wasm, affected callback/container gates and hosted acceptance remain.
