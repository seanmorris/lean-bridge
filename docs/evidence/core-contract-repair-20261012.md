# Repair the remaining Core contract checks

Predecessor: `c9bb5c1a182994c6408117f278f574d1dfe9b188`.

Core run [38191944649](https://github.com/seanmorris/lean-bridge/actions/runs/38191944649)
finished with 13 failures at `875fbc9fb3191ad9eea959499abca5c01e631394`.
The [standalone CLI repair](cli-import-repair-20261012.md) addresses ten:
three CLI package checks, the documentation workflow check and six historical
borrow-receipt comparisons affected by the package allowlist.

The remaining three failures reproduced locally:

- The JavaScript ownership manifest omitted three new build modules. Each now
  has the same `strict-migration-backlog` disposition as neighboring modules.
  This change does not add them to the strict typechecked set.
- Two invalid reviewed Fin contracts fail during private ABI derivation, before
  the selection checker runs. Their tests now require that exact `TypeError` at
  derivation. All well-formed descriptor mutations still exercise selection
  rejection.
- The structural test-registration check removed its original eight additions
  from the live profile file, then compared against an older commit. Later
  registered tests made that comparison invalid. It now authenticates and
  restores its recorded source epoch before removing the eight additions. It
  still requires all eight roots in the live contract profile.

No production algorithm or runtime behavior changes in this milestone.

## Validation

The focused Core, structural registration and CLI history checks pass: 17 tests,
zero failures or skips. Scoped lint, checked JavaScript and all 16 generated
reference checks also pass.

The broader documentation, component engine, refinement, history and type
inventory regression passes 222 tests with zero failures. Thirteen explicit
compiler or installed-package gates are skipped in that source-only run; its
SHA256 is `df2ebe4f4b747a0843945de5fe6c559de2a0563002df1c2cc237fa8ff448cede`.

The six borrow-history failures from hosted Core were rerun at the predecessor
alongside two related controls: eight tests passed, zero failures or skips.
The compiled ordinary and reviewed CPAN receiver runs also passed at that
predecessor. Each independently builds twice through the installed CLI and
exercises all four pinned Perl ABIs through both installation modes, including
source removal and relocated execution. Those runs use Linux x64/glibc 2.36
with an explicit package floor of 2.36.

Local result hashes:

| Result | SHA256 |
| --- | --- |
| Focused 17-test Core repair | `e95018ccf511863269e488be454588b54c59d31499f51700d6fe912214dcc487` |
| Eight borrow-history checks | `db7d2a1293b0e25726924feaf8e664b567d6f56f54d83823590687b262b4c016` |
| Compiled CPAN receiver TAP | `d054eaed40b2b3ed9a625bd3eb8e778f24bb035a073014246f41eb86d58bc7bb` |
| Ordinary receiver report | `87a4df0bbea48c20e4dca090edc6778657cfbf7637ced8e2f99382cdc49c3d38` |
| Reviewed receiver report | `1f9b3ace3a8ca898f02d44d77917d6a508c1925ecc4a6499a26f56ec8685f6f2` |

The [source-history ledger](core-contract-repair-source-history-20261012.json)
records eight exact transitions and refreshes 18 current-source pins. Its SHA256
is `733cf2470649b606513d1d5a7faebfa12d87b3fe0437a4e3376a9288802d8c90`.
An independent audit reconstructed every predecessor file directly from the
recorded spans and compared it with Git. All 480 evidence entries and 575
observations retain their claims. Earlier archives and ledgers remain unchanged.

Hosted CI has not run these repairs yet. The useful downstream jobs on the
previous revision remain running while these local milestones are prepared.
