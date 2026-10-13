# Installed nominal native PHP Subtypes

Producer: `39f7f06e3db8f47b554ef039dc71c4bbc42ed98b`.
Archive: `docs/evidence/nominal-subtype-php-20261013`.
Index SHA256:
`9f22ebf9f08e25f38b909690a6bc27b024f161b339eb98c6c2200e4c4039c2c2`.

## Executed acceptance

All four ordinary/reviewed, full/result-only Composer selections passed with
one test, zero failures and zero skips each. Each selection reproduced its
package in two independent author roots. After removing both author and build
roots, weak and strict PHP consumers ran from the offline-installed package
and again after physical relocation.

The 16 executions completed 50,928 checks, 8,256 native/refinement refusals,
256 host refusals and 128 snapshot controls. Full packages retain 26 exports;
result-only packages retain 13 and expose no input constructors. The checks
cover nested nominal records and variants, aliases, arrays, options, results,
mixed Fin fields, 100-bit integers, distinct constructors at each input site,
late failures, recovery and unchanged caller inputs.

The packages target Linux x64 with an explicit glibc 2.36 floor. These local
runs used glibc 2.36, PHP 8.2.33 and Composer 2.5.5. They do not establish
hosted release-floor acceptance or constructor/source entry counts. PHP
consumer source remains present because the runtime executes it.

The first reviewed/full attempt stopped at the resource guard after host load
remained at or above six for five minutes. The archive retains its original
launch, terminal and failing TAP records separately. It contributes no passing
execution. A later reviewed/full attempt passed all four installed executions.

## Retained records

The archive contains 339 files plus its index. It retains the original package
metadata, every non-native ZIP member, Composer inputs and generated autoload
files, compiler and source records, receipts, launch/terminal/TAP records,
51 producer source snapshots, eight checker sources and the original runner.
The checker restores the complete 22-module PHP generator from the producer
revision and compares its generated files with the original package members.

The archiver authenticated each complete original ZIP before retaining its
non-native members. Native binaries and complete ZIPs remain in the original
`/app/build` handoffs, outside `/tmp`. The failed attempt's handoff and build
records remain there too. The archive does not rebuild a package or replace
an original observation.

The records identify PHP, Composer and six selected extension binaries, their
probe commands, offline installation inputs and the relocated package closure.
Those tool distributions remain trusted inputs; this is not a complete operating
system closure. The launch record hashes the runner and all 5,491 producer
source inputs. Every producer attempt verifies unchanged inputs at completion.

## Verification

The archive suite passes five tests with no failures or skips. It rejects
680 missing/corrupted archive-file cases, 80 coordinated launch/terminal/TAP
changes and 830 record or semantic changes: 1,590 negative controls in total.
The controls cover tool identities, package closure, resource floors, installed
executions, constructor decisions and the separate failing attempt.

Both the focused contract suite and the registered parent test entry point
pass 14 tests with zero failures or skips. Registered TAP SHA256:
`4f881a497ce4fbbf3f2f5eeb269d39a09035df72b958a3b62457cfccc1536f82`.
The seven-root regression passes 157 tests with zero failures or skips:
`2790d6399020b9bfc94903322ac54460e970c710fe7196bd17d49b828bbed576`.
Full ESLint, checked-JavaScript type checking and all 16 generated reference
page checks pass. These validations preserve all 5,501 source fingerprints.

The milestone audit checks every staged blob, the archive index and the single
test-registration edit. It preserves all 13,028 earlier evidence files and
the support inventory's 504 evidence entries and 587 observations.

This milestone changes no production adapter or workflow. The two native PHP
nominal Subtype field cells remain unreviewed in the inventory. Required hosted
acceptance, support promotion and the corresponding documentation follow.
