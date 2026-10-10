# Hosted native specialization checks

The [archive receipt](hosted-specializations-20261009/receipt.json) retains 38 report files from 12 GitHub Actions artifacts at commit `93c60a0487d0b2acc0b6d562cd72a3876738a666`. They contain 44 installed-consumer observations across eleven native language profiles. The archive includes each original artifact ZIP, job response, job log and 58 producer source snapshots.

The three selections exercise:

- Ten configured function specializations and one ordinary export. Lean resolves implicit and explicit type arguments, two universe parameters, aliases, and `Inhabited` and `Add` instances. A fixture-specific instance returns `37`.
- Ten direct exports using closed, alias-named generic records. The fixture distinguishes two aliases of one application, different applications of one structure, nominal phantom arguments, and `List` and `Option` combinations.
- Nine configured function specializations over those records, two namespaces, and `List` and `Option` aliases.

Each selection builds packages from two unrelated author roots and compares their archive hashes. The harness removes the author and build directories before offline installation. Consumers run without compiler tools on their runtime `PATH`; static-language caller compilation is a separate step. The reports retain source-tree, model, Binding IR, receipt, consumer and package digests. These GitHub artifacts do not contain the complete model and receipt documents or the built package archives.

## Recorded checks

| Consumer | Function specializations | Direct records | Specialized records |
| --- | ---: | ---: | ---: |
| C | 2016 | 1013 | 1029 |
| C++ | 2011 | 1012 | 1024 |
| Python | 2020 | 1019 | 1036 |
| Rust | 2011 | 1013 | 1025 |
| Ruby | 2020 | 1021 | 1036 |
| .NET | 2030 | 1018 | 1034 |
| Java | 2070 | 1018 | 1034 |
| Kotlin | 2036 | 1015 | 1030 |
| Native PHP | 2020 | 1021 | 1035 |
| WIT/WASI | 2021 | 1019 | 1036 |
| Perl, each ABI | 2019 | 1025 | 1040 |

Python's record selections run on both Python 3.11 and 3.12. The function selection runs on the default Python 3.11. Perl runs all three selections on 5.36.3 and 5.38.2, with threaded and unthreaded builds of each. The four Perl configurations have independent package identities; their archives need not match each other.

Rust, .NET, Java and Kotlin record reports also retain rejected caller diagnostics and successful recovery runs. Managed-language checks verify that those compilations leave the installed library unchanged.

## Verification and subsequent acceptance

Run the portable archive checks from the repository root:

```sh
node --test tests/hosted-specialization-evidence.test.mjs
```

The checker authenticates the receipt before reading its paths, verifies every retained file, compares each report with its decompressed ZIP member, and reconstructs each consumer's digest from the historical source snapshots. It checks the selected tests' successful, unskipped TAP results, including both Python record runs. Mutation tests reject substituted files, missing observations, changed contracts and skipped executions. No archived source is executed.

The C-family job was cancelled during later work. All three selected specialization tests had passed; neither that job nor the parent workflow is described as successful. The other eleven selected jobs succeeded. These runs use the configured hosted distribution settings, without a local libc-floor override. They do not establish execution on a machine running the minimum supported libc version.

This archive supplements the earlier [function](native-specializations-20261006.md) and [record specialization](generic-record-specializations-20261007.md) reports without replacing them. It adds no reviewed-contract, browser, PHP-Wasm, open-generic, callback or refined-generic acceptance.

The native reports in this original archive cover `List` and `Option`. The separate function fixture's `Array UInt32` alias does not establish records containing arrays. VO #1439 subsequently passed those cases across every native profile; the [hosted Array audit](generic-record-array-hosted-20261010.md) retains the successful executions. The [final specialization audit](native-specialization-closure-20261010.md) reconciles that evidence with the original #1426 requirements and closes #1455 and #1426.
