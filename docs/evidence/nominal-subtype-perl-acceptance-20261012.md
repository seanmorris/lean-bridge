# Nominal Subtype acceptance in Perl packages

The [original archive](nominal-subtype-perl-20261012/index.json) records four
package selections: ordinary and independently reviewed source, each with a full
API and a separate constructor-free result-only API. Producer revision:
`875fbc9fb3191ad9eea959499abca5c01e631394`.

Each selection reproduces two author builds and installs their runtime and
component packages with Perl 5.36.3 and 5.38.2, both threaded and unthreaded.
Every ABI runs both `prebuilt-only` and `build-xs` installations. Author inputs
are removed before offline installation. The unchanged callers execute before
and after moving the installed tree, with Lean and native compilation unavailable
during execution. This gives 32 installations and 64 executions across the four
selections.

The tested Nat Subtype payloads use `Math::BigInt` inside generated record and
variant wrappers. The full API checks distinct constructor choices for repeated
uses of the same record, normalization, mixed Fin guards, transparent aliases,
active variant branches, exact error paths, unchanged caller inputs and recovery
after rejection. Result-only packages project existing Lean values without
selecting input constructors, including results larger than either constructor's
accepted input range and 100-bit values. Callers provide no proof fields.

Full executions each perform 4,212 checks, including 1,032 expected rejections
and eight independent snapshot controls. Result-only executions each perform
2,086 checks and eight snapshot controls. Total: 201,536 checks and 33,024
expected rejections.

The independent archive check reconstructs exact generated Perl modules and XS
from the producer's complete recorded module closure. It checks source identity,
compiler selections, package receipts, installed snapshots and both executions.
Its 1,914 negative controls cover missing or corrupt originals, incomplete runs,
altered compiler decisions, false replay claims and coordinated package changes.
The [archive note](nominal-subtype-perl-20261012.md) records the original files
and validation results.

These runs use Linux x64/glibc 2.36 and an explicit package floor of 2.36.
They do not establish a hosted release-floor result. Constructor/source entry
counts and memory are unmeasured. The archive retains package digests and selected
producer sources, not package binaries or a full toolchain closure.

The inventory promotion adds two Perl field cells, one per source route, and
supplements four existing parameter/result cells with the full and result-only
evidence. Earlier evidence remains attached. Other primitive-base nominal
fixtures, other hosts, refined callbacks, owned values, recursive shapes and
broader dependent or generic Subtypes require separate acceptance.

## Recurring CI

The existing four-ABI Perl checked-record job runs
`scripts/run-nominal-subtype-perl-ci.sh` after its checked-record and structural
Subtype gates. The runner requires all four nominal selections and refuses
ambient ABI or glibc-floor overrides. Hosted packages use the explicit glibc
2.38 floor. Each selection must produce complete, zero-skip TAP and retained
package, compiler and execution records. The independent checker compares the
records with the selected producer commit and the actual checker host.

The job uploads the entire output directory on success or failure for 30 days.
It remains required by the Perl summary and the parent consumer matrix. These
gates do not replace or weaken either earlier Perl acceptance run.
