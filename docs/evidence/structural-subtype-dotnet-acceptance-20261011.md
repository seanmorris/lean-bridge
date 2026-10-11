# Installed structural Subtypes in .NET

Ordinary-source and independently reviewed NuGet packages passed at producer
`dba45a058734a0bc5e390786383000fbf4609bf7`, using .NET SDK 8.0.424 on Linux
x86-64 with the declared local glibc floor of 2.36.

| Author route | Installed test | Duration | Lowest free disk |
| --- | --- | --- | --- |
| Ordinary source | 1 passed, 0 failed, 0 skipped | 158.1 seconds | 10,137 MiB |
| Reviewed API | 1 passed, 0 failed, 0 skipped | 153.2 seconds | 10,124 MiB |

Each route reproduced its model, package-set receipt and NuGet archive in two
independent author directories. The harness removed both author/build trees
before offline installation. NuGet used only the prepared feed. Installation
compiled the downstream C# caller, not the Lean implementation. The unchanged
application passed again after the complete installed tree moved.

The installer checked the complete archive before restore, authenticated every
restored package file, checked NuGet's generated build inputs before compilation,
and pinned every deployed application file. Replay checked these inventories
before and after execution. SDK selection used an explicit host and a pinned
`global.json`. The archive retains all five restore inputs, the dependency and
runtime configuration files, feed configuration and cache metadata. Historical
absolute paths describe the original run; evidence checks do not reopen them.

Every retained execution passed 4,119 assertions, including 1,042 expected
rejections and six input-snapshot mutation controls. The twelve exports cover
`Array`, `List`, `Option`, products, both result branches, transparent aliases and
a closed generic specialization. Inputs include wide integers, `UInt8`, Unicode
and complete embedded-NUL string suffixes. Empty and absent values,
first/middle/last failures and all nine nested row/column positions are exercised.

The C# caller checks exact exception types and rejection paths, mixed-Fin
validation priority, independent alias/parameter constructor choices and
exactly-once normalization. Independent snapshots retain concrete types, array
structure, branch tags, full integer payloads and every UTF-16 string unit.
They do not call generated equality methods. The late-input loop checks both
inputs through 1,000 rejection/recovery pairs.

## Original records

The archive is
[`structural-subtype-dotnet-20261011`](./structural-subtype-dotnet-20261011/index.json).
It retains 85 originals plus its index: 56 run records, 27 exact Git producer
source snapshots, the runner and the report checker. Index SHA-256:
`ae5a5dad4552ce42e7b1003e22f6821ee89aabd37e406f0ede10d269d27b11fb`.

Ordinary TAP SHA-256:
`faa36dcbb27b822a168f672aa8ede8c016fe0dcfb412e5cff5e49857ad4c9930`.
Reviewed TAP SHA-256:
`d2ab49f7e81f1833cf4d5a960e6d4d20408426167182f3593e65fb440898d221`.

The checker authenticates both models against the independent API and per-site
constructor choices. It checks original caller/source identities, receipts,
NuGet cache and deployed-file inventories, SDK selection and both replay results.
Archive tests passed three groups, rejecting 172 missing/corrupted-original cases
and 62 altered-report cases. Controls include substituted cached archives,
missing managed libraries, altered native libraries, extra packages or deployed
files, missing SDK/build inputs and coordinated constructor changes.

An independent audit compared all originals and the 27 source snapshots with
their recorded producer. All 8,184 older evidence files and the complete
440-claim/555-observation support inventory remain unchanged. Source regression
passed 35 tests with zero failures and ten installed-only gates skipped. Full
source lint, type checking and sixteen generated reference checks passed.
The final five-root regression passed 38 tests, failed none and skipped ten
installed-only gates. Those skips are separate from the two actual NuGet runs.
The complete documentation test root passed all 43 tests without skips.

## Remaining acceptance

This is local glibc 2.36 acceptance, not a hosted glibc 2.38 observation. Package
and host identities are retained; their binaries and complete toolchain closure
are not. Constructor/source entry counts and memory behavior were not measured
for these .NET packages. This milestone does not promote support-table cells or
add recurring structural .NET CI.

The remaining native structural-Subtype profiles are Java, Kotlin, native PHP,
WIT/WASI and Perl. Browser page/React/worker and PHP-Wasm are additional
environments. Required recurring gates, support-table promotion and consumer
documentation follow acceptance. Nominal fields, callbacks, owned values and
broader generic combinations remain within VO #1444 and #1220's original scope.
