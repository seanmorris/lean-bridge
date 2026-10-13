# Nominal native PHP package harness

The PHP harness covers ordinary-source and independently reviewed packages,
each with a full API or a standalone result-only API. It preserves all 26 full
exports and all 13 result-only exports from the shared nominal Subtype fixture.
The source, caller and registration controls in this milestone do not count as
installed Lean execution. The support inventory remains unchanged.

## Source and caller controls

PHP reserves `echo`. The [fixture helper](../../tests/helpers/nominal-subtype-php-fixture.mjs)
changes that one Lean export to `echoEnvelope`, producing the PHP function
`echo_envelope`. Tests reverse the rename and recover the complete original
Lean source, ordinary configuration and independently authored reviewed IR.
No constructor choice, field, variant, alias or result export is removed.

The [public caller](../../tests/fixtures/nominal-subtype-consumers/php-native.php)
checks exact large `Nat` values, distinct constructors at individual input
sites, normalization, repeated records, active variant branches, aliases,
mixed `Fin` refusal order, malformed and null values, caller-input preservation
and recovery after late rejection. Its snapshots compare actual classes,
array keys and payloads without using generated equality or serialization.

The separate [behavioral model](../../tests/helpers/nominal-subtype-php-model.php)
uses genuine generated PHP value classes but does not call Lean. All eight
source/API/weak-strict configurations passed. They reject 96 deliberately
faulty model variants across those configurations. The first model run caught
an extra property dereference in the stand-in; its failed output is retained
in `build/vo1466-php-contracts-r1-0.log`.

## Installed producer

The [gated producer](../../tests/helpers/nominal-subtype-php-installed-tests.mjs)
requires committed, unchanged source inputs and an unused output directory.
It builds the package in two independent author directories and compares
complete package bytes and compiler metadata. It removes both author/build
directories before offline Composer installation, then runs weak and strict
callers before and after moving the installed tree. PHP callers remain present
because PHP executes their source at runtime.

The [tool inspector](../../tests/helpers/nominal-subtype-php-tools.mjs) requires
absolute PHP and Composer commands and exact expected version strings. The
local preflight verified PHP 8.2.33, Composer 2.5.5 and eight binary identities,
including six loaded extensions. Both incorrect-version controls rejected.
These tool distributions remain trusted inputs. Package runs must separately
record the selected glibc floor and actual host runtime.

The existing closed Composer installer authenticates original ZIP members,
dependency files, autoload inputs and the complete vendor tree. The
[package inspector](../../tests/helpers/nominal-subtype-php-package.mjs)
reconstructs native loader identities from component, adapter and runtime
receipts, regenerates all PHP package sources, and retains original non-native
members and Composer discovery records. Full ZIPs remain in the retained
handoff. No constructor/source entry-count or memory claim follows from these
checks.

## Registration and validation

The [registration ledger](nominal-subtype-php-registration-source-history-20261013.json)
records three exact transitions from
`befe459ccb133fe463367cdef48d77bd5b75acdc`. It connects the PHP helpers to the
existing component-refinement test root while preserving earlier authenticated
source views. No support inventory or earlier evidence file changes.

Nine direct contract/history tests passed without failures or skips. A separate
19-root regression passed all 148 tests without failures or skips; its TAP
SHA-256 is
`39573eaa3337dce709e3e0f7a2956346f34fca819c41aef394e4fb30b2faaa10`.
Full ESLint, checked-JavaScript typecheck, all 16 generated reference pages
and both PHP syntax checks passed. The registered component-refinement root
ran the nine selected PHP contract/history tests with no failures or skips;
its TAP SHA-256 is
`8eab37e863cc43cc1367b6f828ef77ef819cf06444f810738b94c8be8c1d9fb5`.
This named selection does not claim the whole component-refinement suite ran.
Each phase verified all 5,491 source fingerprints remained unchanged.
The staged audit verified the exact 15-file milestone, all three reversible
source transitions, an unchanged inventory and byte-identical preservation of
all 13,026 earlier evidence files. Both native PHP nominal-field cells remain
unaudited. The committed audit runs after the milestone is recorded in Git.

VO #1466 owns the four installed selections, original archive and corruption
controls, support-inventory/docs promotion, and required recurring PHP CI.
Constructor/source-entry measurements remain under #1470. PHP-Wasm acceptance
is separate work under #1457.
