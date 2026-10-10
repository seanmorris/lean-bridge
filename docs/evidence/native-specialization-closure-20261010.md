# Finite native specialization: original-scope closure

The audit completes VO #1455 and #1426. The successful
[ff71335 downstream run](https://github.com/seanmorris/lean-bridge/actions/runs/37969725049)
contains separate installed tests for function specializations, direct generic
records, specialized records and records containing arrays. All 46 jobs passed.

The [closure receipt](native-specialization-closure-20261010/receipt.json) indexes
twelve original function reports from the ZIPs already retained in the
[hosted record archive](generic-record-array-hosted-20261010.md). It adds no
duplicate ZIPs and changes no earlier receipt. Its SHA-256 is
`2aba48bbfbd00fc3bd885e0ec5c450d16bd3e09e1eecdf5bfce72041c1ca3ce8`.

## Original requirements and evidence

| Requirement | Accepted evidence |
| --- | --- |
| Ten concrete function specializations and one ordinary export | Twelve function reports, fourteen host/runtime observations, across all eleven native profiles. Each report names all eleven concrete exports. |
| Leading type arguments, aliases and two explicit universes | The retained fixture and configuration specialize `echo`, `choose`, `first` and `duplicate` over `UInt32`, `String`, `Nat`, aliases and `Array UInt32`. The build checks each concrete signature. |
| Lean-selected instance dictionaries | Every generated public consumer checks `chooseWord(false, 5) = 37`, default string/array values, and addition specializations. Consumers repeat calls 1,000 times. Record identity tests are not used as evidence for instance selection. |
| No open generic host dispatch | The build requires empty type-parameter and assurance lists on concrete exports and rejects the presence of the open declarations in the exported Binding IR. |
| Positive generic structures through named aliases | The C-family run passes the positive `Specialized.WordPair` provenance test. Separate direct-record reports cover every native profile. The fixture preserves distinct aliases, multiple applications, explicit universes and nominal phantom arguments. |
| `List`, `Option` and nested `Array` cases | Thirteen specialized-record reports and thirteen Array reports cover fifteen runtime observations each. The Array consumers retain the original direct and nine-specialization cases. |
| Reproducible packages and installed consumers | Each fixture builds from two author roots, compares package archive hashes, removes author/build inputs before offline installation, and executes public host APIs with a compiler-free runtime PATH. |
| Static signatures, invalid inputs and recovery | C/C++/WIT compile with strict warning flags; .NET/JVM use warning-as-error settings; Rust compiles offline. Record reports retain Rust and managed-language rejection diagnostics and successful recovery. |
| Recurring CI and retained reports | Actual job transcripts contain each selected command and mandatory nonempty report check. The exact reports are present in digest-verified GitHub artifact ZIPs. |
| Inventory and documentation | All nine ordinary-source generic observations cover the eleven native profiles. Their existing installed evidence and 231 unique current file pins reconcile without changing any support state. |

The eighteen common-function producer, fixture and consumer files are byte-identical
in the older retained source snapshots, the `ff71335` producer and the `a46d3db`
closure baseline. The verifier reads those snapshots as text; it never executes
historical source.

## Runtime selections

The common function fixture runs on Python 3.11.17. Direct, specialized and Array
record fixtures also run on Python 3.12.15. All fixtures run on four Perl
configurations: 5.36.3 and 5.38.2, each threaded and unthreaded. The original logs
and report identities distinguish those selections.

The hosted runs use the configured distribution packages without the local
glibc 2.36 override. They do not measure execution on a machine running the
minimum supported libc version. Built package archives and complete model/receipt
documents are not in these GitHub artifacts; the reports retain their digests.

The [6 October report](native-specializations-20261006.md) records the earlier
rejection of generic structure instantiations. That historical report remains
unchanged. The subsequent positive alias-named record tests and this closure
audit establish the current support described in the
[author guide](../lean/existing-package.md#name-instantiations-of-generic-structures).

## Repeat the audit

From the repository root:

```sh
node --test tests/generic-record-array-ci.test.mjs
```

The registered tests authenticate both earlier archives and the closure receipt,
compare the new report files with their original ZIP members, reconstruct the
consumer identities and check successful unskipped execution. Negative controls
reject substituted record evidence, altered instance selection, missing reports,
skipped function tests and unsupported inventory promotions.

Reviewed Binding IR, open generic dispatch, callback/resource specializations
and broader recursive/refined/dependent generic work remain outside #1426's
original scope. Their existing #1220 tasks remain open where unfinished.
