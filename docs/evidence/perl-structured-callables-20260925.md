# Perl structured callbacks

Original CPAN archives support eight acyclic copied shapes in synchronous
callbacks and returned Lean closures: arrays, Lists, options, results, products,
records, variants and transparent aliases. Installed consumers run on Perl
5.36.3 and 5.38.2, each threaded and unthreaded, from both ordinary Lean source
and independently reviewed Binding IR.

Each of the eight installations passes 64,983 public assertions, 1,686 callable
invocations and 325 rejected inputs. The callers check independent copies,
captured values, retained callback arguments, repeated calls, re-entry, original
exception objects, expired borrows, explicit close and automatic destruction.
Unicode, embedded NULs, large exact integers, all constructor branches and
over-budget payloads appear in the test values.

Both original archives install offline in prebuilt-only mode. The installer
relocates the installation, removes the producer handoff and runs without
compiler tools. It verifies the installed POD and executes the exact
[consumer example](../consume/perl.md#structured-callback-values). The public
caller and example run again after the separate failure probe. The installed
files and original native libraries remain unchanged. Public operations use the
uninstrumented package; runtime snapshots check live scopes and identities.

The failure probe compiles a separate XS copy with the installed headers and
runtime. Across 160 shape/seed/path scenarios, it injects 22,362 Perl exceptions,
half messages and half original exception objects. Its 134,772 assertions check
cleanup, recovery, exception identity and four close-during-conversion cases.
The probe finishes with zero registered conversion owners, live scopes,
callbacks and identities. These are conversion-checkpoint exceptions, not
allocator failures. The ownership ledger counts scope-registered non-scalar
Lean references, not every allocation in Perl or Lean.

The installed checks exposed read-only Perl singleton scalars inside copied
containers. Generated Unit, Bool and absent-option writers now return writable,
owned scalar copies. A synthetic regression record compares seven packages
against the predecessor generator. Every file remains identical after reversing
only those three explicit scalar-storage changes. This code-generation check
does not substitute for installed execution.

Fresh primitive-callback regressions check all nineteen primitive types on both
source paths and all four ABIs. Each caller passes 8,756 assertions. Separate
installed collection, compound, List and variant regressions exercise the
updated scalar writers in ordinary copied APIs on the same ABI/source matrix.
The primitive and compound assertion helpers now require scalar arguments, so
a failed regex cannot disappear from the argument list and accidentally pass.
Negative cases distinguish rejection of a reference from a scalar's type error.
The affected installed regressions were rerun with those corrected helpers.

The [execution record](perl-structured-callables-20260925.json) retains original
archive identities, installed file hashes, failure-probe observations and
complete test logs. The [integration record](perl-structured-callable-integration-20260925.json)
binds the source changes and exactly 32 newly accepted inventory cells. Previous
execution records remain unchanged.

Recursive callback payloads, callback identities inside copied fields,
resource-containing aggregates and asynchronous delivery remain unsupported.
The copied-value conversion budget is 16 MiB per scope and schema nesting is
limited to 32 levels. These limits do not bound all Perl or Lean memory.
