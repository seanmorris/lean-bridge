# Installed aliases of refined records and variants

Both C/C++ routes passed at producer
`b8765be7c642fd7ba3349c8cc90a3857a7118b26`. The fixture adds `TileName`
and `ShapeName` aliases to the original refined record and variant. Its
public functions use those aliases; the original C and C++ callers remain
unchanged.

| Route | C checks | C++ checks | Archive reproduction |
| --- | ---: | ---: | --- |
| Ordinary Lean source | 2,064 | 2,053 | Identical across two author roots |
| Independently reviewed aliases | 2,064 | 2,053 | Identical across two author roots |

The [original TAP](fin-record-alias-native-20261010/run.tap) records two
passes, no failures or skips, in 788 seconds. Each route deletes its first
author/build root before installing and exercising its archives offline.
The second build checks reproducibility, not a second installed execution.
Host compilers remain available; the consumer PATH excludes Lean.

The reviewed input names each alias and its original nominal target.
Bounds remain on the record and variant definitions. The independent report
checker reconstructs this review, verifies the original caller hashes and
reconstructs the package-set receipt from both consumer rows.

The [archive index](fin-record-alias-native-20261010/index.json) authenticates
24 files: original reports, runner, TAP, start/end and verification records,
plus 17 selected source snapshots from the exact producer revision. Its
SHA-256 is `aa5edf80c2ef174184ce41e9185192b429d8560ae4462fe7d24f54b943d8a76a`.

This local supplement uses glibc 2.36 with configured floor 2.36. It adds
no hosted, minimum-platform or dispatch observation. It tests aliases on
C/C++; the separate nominal-field matrix covers all eleven native hosts.
The selected sources are not a full build dependency closure. The harness
removed package binaries after execution; original digests and sizes remain
in the reports.

Run the archive and malformed-report checks with:

```sh
node --test tests/helpers/fin-record-alias-archive-tests.mjs
```

The registered `tests/native-fin-records.test.mjs` root includes these checks.
