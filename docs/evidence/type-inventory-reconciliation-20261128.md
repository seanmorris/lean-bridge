# Reconcile the family results with the versioned type inventory

The candidate for [PR #11](https://github.com/seanmorris/lean-bridge/pull/11)
is `1600adc6bdbf739d58c9fcd24f36f369f40e064c`. Its Binding IR lists
eleven host targets. The type inventory still listed five, so the structural
validator stopped before counting a single cell. The follow-up adds the six
missing target names (Perl, PHP, C, C++, Rust and WIT/WASI). It changes no host
mapping, evidence state, exclusion or release archive.

With those names aligned, inventory v0.109.0 covers 49 shapes, 17 profiles,
both author routes and 6,732 required cells. There are no reviewed exclusions.
The table counts cells, not packages, CI jobs or failing tests.

| Family owner | Required cells | No host type recorded | Analysis not passed | Installed execution not passed |
| --- | ---: | ---: | ---: | ---: |
| #1218 primitive | 3,230 | 0 | 0 | 0 |
| #1219 collection | 1,530 | 0 | 0 | 0 |
| #1220 generics, checked values and proofs | 1,054 | 0 | 0 | 0 |
| [#1221 ownership and callbacks](host-lifetime-acceptance-20261127.md) | 680 | 596 | 606 | 606 |
| [#1222 effects and failures](effect-failure-crosswalk-20261126.md) | 102 | 102 | 102 | 102 |
| [#1223 async delivery](async-delivery-crosswalk-20261125.md) | 136 | 112 | 136 | 136 |
| **Total** | **6,732** | **810** | **844** | **844** |

Generation, compilation and packaging each also have 844 cells not marked
passed. Of the 844 installed cells, 691 have no observation at all.
The family reviews above record executed cases separately. A row missing
from the inventory is not evidence that its implementation failed. Conversely,
a completed family review does not prove that the current release archive
passed every stage.

- **#1213:** join each missing host mapping to its profile, shape, author
  route and position. Record the actual type, ownership and limits. A
  signature that exposes no host value needs an explicit explanation.
- **#1216:** reconcile the 844 analysis and 844 compilation states with
  the original elaboration and compiler evidence. Do not infer compilation
  or reproducibility from an installed application's output alone.
- **#1217:** join the corpus clients and their observed positive, negative
  and boundary results to the matching rows. Preserve distinct callback
  directions, failure modes, runtime profiles and author routes.
- **#1224:** independently reinstall packages from the pinned release.
  The [first npm shard](https://github.com/seanmorris/lean-bridge/actions/runs/46093749516)
  covers owned checked records. It is not a replacement for the other
  archives or for the three reconciliations above.

To reproduce these counts, load `readTypeSurfaceContract()` from
[`src/adoption/type-surface.mjs`](../../src/adoption/type-surface.mjs) and group
`typeSurfaceCells(document, contracts)` by `owner`. Count null `hostType`
and stages whose `state` is not `passed`. This checks the governing schema,
not the cited artifact bytes. Use `readTypeSurface()` for that separate check.
