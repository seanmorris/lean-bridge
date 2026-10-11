# Installed structural Subtypes in Rust

Both ordinary-source and independently reviewed Cargo packages passed at producer
`981e42d8e0ddd724e3cf001de7422dfb27f77c5d`, using Rust and Cargo 1.90.0 on Linux
x86-64 with the declared local glibc floor of 2.36.

| Author route | Installed test | Duration | Lowest free disk |
| --- | --- | --- | --- |
| Ordinary source | 1 passed, 0 failed, 0 skipped | 176.9 seconds | 10,237 MiB |
| Reviewed API | 1 passed, 0 failed, 0 skipped | 150.3 seconds | 10,091 MiB |

Each route built in two independent author directories and reproduced the model,
package-set receipt and Cargo archive bytes. The harness deleted both author/build
directories before installing from the handoff. Cargo built the consumer offline
against the vendored dependency archive. The consumer then ran with compiler and
runtime-root environment variables pointing to unavailable paths. Moving the
complete installed tree preserved the executable, caller, public API, lockfiles
and package contents, and the same consumer passed again.

Every retained execution passed 4,119 assertions, including 1,042 expected
rejections and six input-snapshot mutation controls. The independently authored
Rust caller exercises all twelve exports:

- `Array`, `List`, `Option`, pairs and both active result branches.
- Wide `Nat`, `UInt8`, Unicode strings and complete embedded-NUL suffixes.
- Empty containers, absent options and first/middle/last rejection positions.
- All nine row/column positions in the nested Subtype/Fin input. When both values
  are invalid, the public boundary reports the Fin failure first.
- Distinct constructor choices on aliases and separate arguments. The normalizing
  constructor changes the returned value exactly once.
- Complete owned snapshots of all rejected inputs and both successful late-loop
  inputs. The loop performs 1,000 rejection/recovery pairs.

The original logs are retained in
[`structural-subtype-rust-20261011`](./structural-subtype-rust-20261011/index.json).
Ordinary TAP SHA-256:
`0a186bf6b07b189f1cb4116f0cb044e98c797ad3e53c76311a2fba07e39f20c1`.
Reviewed TAP SHA-256:
`205d19732160062ec972a3e11e89e6020b8f9c391fd1530adf2d9af2f4e5e07f`.

## Retained records and regression

The archive retains 66 originals plus its index: 40 run records, 24 selected
producer-source snapshots, the runner and the report checker. Index SHA-256:
`32ba0d3e41e974f9d44adb6c5dbdbe57d00b04cf89e2c1d3f84d5044d5779aa4`.

The checker compares both original models with the independent API and per-site
constructor choices. It checks source and caller identities, package receipts,
public Rust bytes, both Cargo lockfiles, vendored registry identities, exact result
counts and installed/relocated observations. It does not reopen historical
absolute paths.

Archive tests passed three groups and rejected 134 missing/corrupted-original
cases and 56 altered-report cases. Controls include false source deletion,
missing relocation, changed toolchain selection, dropped counts, altered public
source and lockfiles, coordinated dependency-checksum changes and a substituted
constructor in both native models.

The five-root regression passed 28 tests, failed none and explicitly skipped six
installed-only gates. Those skips are separate from the two actual installed runs
above. Source regression passed 21 tests with six explicit gates skipped. Full
source lint passed; the archive scripts and helpers passed targeted lint. Type
checking and generated-reference checks also passed.

An independent audit compared every archived record with its original and all
24 source snapshots with the frozen Git commit. All 8,056 older evidence files
and the complete type-support inventory remain byte-identical. This milestone
does not promote support-table cells or add recurring structural Rust CI.

## Remaining acceptance

This is local glibc 2.36 acceptance, not a hosted glibc 2.38 observation. The
archive records package, executable and toolchain identities but does not retain
their binaries or the full dependency/toolchain closure. Constructor/source
entry counts and memory behavior were not measured for these Rust packages.

Structural Subtype acceptance still needs Ruby, .NET, Java, Kotlin, native PHP,
WIT/WASI and Perl, plus browser page/React/worker and PHP-Wasm. Required recurring
gates, support-table promotion and consumer documentation follow their acceptance.
Nominal fields, callbacks, owned values and broader generic combinations remain
within the original scope of VO #1444 and #1220.
