# Measured native Fin-container packages

Nine installed selections passed at producer commit `b70f471bdd0aa3e173e6ba75a46847ed72f4f73b`. They cover ten native profiles and both Python 3.11 and 3.12. Each selection passed one canonical installed test without failures or skips, then passed the strict raw-adapter and public-host report checker.

The [archive index](index.json) identifies all 866 original files: nine sets of reports, runners, start/end records, TAP logs and verification records; the archiver; and 811 Git source snapshots. Its SHA-256 is `7a196a4cab3b3c10fdd1a444f6ab233bf5370d66cc4e660c8e07eea884e757ce`. Reports and source snapshots retain their original bytes.

These executions used local glibc 2.36. Debugger observers used GDB 13.1. They do not establish execution on the hosted glibc 2.38 floor or resolve the separate GDB 15.1 JVM failure.

## Installed results

| Profile | Public consumer assertions | Measured public calls | Original report |
|---|---:|---:|---|
| C | 14,114 | 12,045 | [C/C++](c-cpp/report.json) |
| C++ | 14,099 | 12,044 | [C/C++](c-cpp/report.json) |
| Python 3.11.16 | 14,095 | 12,044 | [Python 3.11](python311/report.json) |
| Python 3.12.14 | 14,095 | 12,044 | [Python 3.12](python312/report.json) |
| Rust | 14,078 | 12,038 | [Rust](rust/report.json) |
| Ruby | 14,094 | 12,047 | [Ruby](ruby/report.json) |
| .NET | 14,089 | 12,047 | [.NET](dotnet/report.json) |
| Java | 14,089 | 12,046 | [Java/Kotlin](java-kotlin/report.json) |
| Kotlin | 14,088 | 12,046 | [Java/Kotlin](java-kotlin/report.json) |
| Native PHP | 14,089 | 12,047 per mode | [PHP](php-native/report.json) |
| WIT/WASI | 14,066 | 12,038 | [WIT/WASI](wit-wasi/report.json) |

PHP measures both weak and strict caller modes. Assertion counts and measured calls are different quantities: the consumer can make several assertions about one call, and instrumentation covers the six selected entrypoints.

Every profile also records a separate 42-row direct-adapter transcript. Its recovery rows aggregate 1,000 checked invalid/valid pairs per entrypoint. Those raw calls do not substitute for the profile's actual public-language calls.

## Cases and package checks

The original eight exports remain in every public consumer. They retain wide bounds through `2^70`, late-argument rejection, result checks, caller-owned input checks and 1,000 rejection/recovery cycles. The additive fixture exercises:

- Empty `Array (Fin 0)`, empty `List (Fin 0)` and absent `Option (Fin 0)`, plus nonempty/present rejection at values 0, 1 and `2^70`.
- Invalid first, middle and last positions in arrays of options, optional lists and both dimensions of nested lists/arrays.
- Absent versus present-empty values, valid endpoints, unchanged inputs after rejection and 1,000 invalid/valid recovery pairs for each selected shape.
- Host-expressible structural/type errors. C checks invalid option tags and null-data/nonzero-length spans. Dynamic and managed hosts check their available wrong-type, null or negative-value cases. Rust's typed `Option`, slices and `BigUint` cannot represent those malformed C carriers.

The direct Lean-adapter probe constructs well-formed erased values through the pinned Lean API and tests refinement rejection. It does not fabricate malformed Lean object layouts. Public C malformed-carrier checks are C observations, not evidence that another language executed a malformed byte-level ABI call.

Each selection builds matching archives from two independent author roots, verifies the package receipts, deletes the author roots before offline installation, and runs consumers without Lean or native compilers on their execution path. It then verifies installed files, relocates the complete consumer tree, repeats the public calls and checks file identities again. Runtime and package-manager inputs have host-specific identity checks, including Python virtual environments, Ruby gem load paths, Rust dependencies, .NET deployments, JVM extraction and PHP autoload files.

Observers authenticate the loaded libraries and their actual symbol definitions. They measure all six selected adapters and the two non-inlined source functions `present` and `flatten`. The four identity source functions are inlined and remain explicitly unmeasured.

## Recheck the records

```sh
node --test tests/helpers/fin-container-edge-measured-evidence-tests.mjs
```

The registered report test imports these archive checks, so repository contract runs authenticate the original bytes, run every archived selection through the strict report gate, and reject altered reports, logs, runners and source snapshots.

For a single report:

```sh
node scripts/check-fin-container-edge-report.mjs \
  python docs/evidence/fin-container-edges-measured-20261010/python311/report.json \
  --python 3.11
```

[The CI milestone](../fin-container-edge-ci-20261010.md) adds recurring producers and report gates. Hosted acceptance and the final original-requirement audit for #1427/#1454 remain open. This archive does not promote other hosts, reviewed IR, product/record refinements or type-surface support cells.

## Open original acceptance item: malformed foreign carriers

The case audit distinguishes refinement failures from malformed foreign inputs. The 42-row direct-adapter probe supplies well-formed erased Lean values; its invalid cases violate Fin bounds, not the foreign ABI's structural contract. C's public consumer separately rejects invalid option tags and null-data/nonzero-length spans. Dynamic and managed consumers exercise their host-level type errors. These are distinct observations.

The WIT/WASI edge consumer explicitly leaves malformed raw carriers to a separate required gate. Its current installed report does not establish that gate. Rust's typed public API cannot construct malformed tags or spans, but that restriction does not establish rejection at its underlying foreign ABI. The original per-host malformed-carrier acceptance therefore remains unproven.

The remaining supplement must:

1. Map each installed package's actual foreign entrypoints and representable malformed inputs, including safe invalid tags, lengths and null-data combinations. Do not fabricate Lean object layouts or use invalid dangling pointers.
2. Execute those cases against each package's receipt-verified libraries, with unchanged inputs/error outputs, no adapter/source dispatch on structural rejection, valid positive controls and recovery.
3. Preserve the existing public-host and direct-adapter observations. Give the foreign-carrier probe its own caller identity, original reports and strict CI gate.
4. Complete the original #1427 case audit before closing #1454. These supplemental observations must not be inferred from another host's C consumer.
