# Installed structural Subtypes in Ruby

Ordinary-source and independently reviewed Ruby gems passed at producer
`abb792dbcce4e83cae8bbc853a63d0cf6398145c`, using MRI 3.3.12 on Linux x86-64
with the declared local glibc floor of 2.36.

| Author route | Installed test | Duration | Lowest free disk |
| --- | --- | --- | --- |
| Ordinary source | 1 passed, 0 failed, 0 skipped | 155.1 seconds | 10,361 MiB |
| Reviewed API | 1 passed, 0 failed, 0 skipped | 139.2 seconds | 10,359 MiB |

Each route reproduced its model, package-set receipt and gem archive in two
independent author directories. The harness deleted both author/build trees
before offline installation into a fresh `GEM_HOME`. It authenticated the original
gem payload, cached gem and generated installed gemspec before package loading.
The caller ran with compiler and runtime-root variables pointing to unavailable
paths. After the entire installed tree moved, the unchanged caller passed again.
The harness checked the complete gem environment before and after each replay.

Every retained execution passed 4,119 assertions, including 1,042 expected
rejections and six input-snapshot mutation controls. The twelve exports cover
`Array`, `List`, `Option`, pairs, both result branches, transparent aliases and a
closed generic specialization. Inputs include wide `Nat`, `UInt8`, Unicode and
complete embedded-NUL string suffixes. Empty and absent values, first/middle/last
failures and all nine nested row/column positions are exercised.

The caller verifies exact rejection paths, mixed-Fin validation priority and
independent constructor choices for aliases and separate parameters. A normalizing
constructor changes the returned value exactly once. Complete snapshots retain
array structure, constructor tags, integer values, string bytes and encoding,
and mutability. The late-input loop checks both inputs through 1,000
rejection/recovery pairs.

The separate synthetic caller tests caught eight altered API/input behaviors on
both author routes. These source controls do not execute Lean. They require a
selected or locally available Ruby toolchain; contract-only jobs without Ruby
explicitly skip this source control. The actual installed tests above ran without
skips.

## Original records

The archive is
[`structural-subtype-ruby-20261011`](./structural-subtype-ruby-20261011/index.json).
It retains 58 originals plus its index: 30 run records, 26 exact Git producer
source snapshots, the runner and the report checker. Index SHA-256:
`cdddc0ea047c0bc4f58e77f2d5074143690be9fa22330223944d6d15f8d0725a`.

Ordinary TAP SHA-256:
`e9c6ba0b1718d6d5654949d0f22ba4a86d84a34fd0174234886a4ac526be33a7`.
Reviewed TAP SHA-256:
`4594f1a22e5eb05117d311613ddb1c0306e7ab330d2bad474d4f80c841407fd6`.

The checker authenticates both original models against the independent API and
per-site constructor choices. It checks caller and source identities, receipts,
the complete gem-environment inventory, Ruby selection and both replay results.
Historical absolute paths are provenance only; the checker does not reopen them.

Archive tests passed three groups. They rejected 118 missing/corrupted-original
cases and 52 altered-report cases, including a removed public file, a substituted
cached gem, an unrecorded plugin, false isolation/relocation claims and coordinated
constructor changes in both models. An independent audit compared every original
and all 26 source snapshots against their producer revision. All 8,124 older
evidence files and the complete type-support inventory remain byte-identical.

Source regression passed 26 tests with zero failures and eight explicitly gated
installed tests skipped. Full source lint, type checking and sixteen generated
reference checks passed. Archive scripts and helpers passed targeted lint.
The final five-root regression passed 33 tests, failed none and skipped eight
installed-only gates. Those skips are separate from the two real gem runs above.

## Remaining acceptance

This is local glibc 2.36 acceptance, not a hosted glibc 2.38 observation. Package
and interpreter identities are retained; their binaries and full toolchain
closure are not. Constructor/source entry counts and memory behavior were not
measured for these Ruby packages. This milestone adds neither support-table
promotion nor recurring structural Ruby CI.

Structural Subtype acceptance still needs .NET, Java, Kotlin, native PHP,
WIT/WASI and Perl, plus browser page/React/worker and PHP-Wasm. Required recurring
gates, support-table promotion and consumer documentation follow their acceptance.
Nominal fields, callbacks, owned values and broader generic combinations remain
within the original scope of VO #1444 and #1220.
