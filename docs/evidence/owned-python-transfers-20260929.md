# Python consuming-input acceptance

The transfer gate compiles twenty consuming contracts from ordinary Lean source
and from an independently reviewed API. Inputs include host-assembled records,
variants, arrays, lists, options, results, nested products, aliases, recursive
values, mixed copied fields and returned Lean closures.

Python collects resource leases during conversion and prepares a separate native
snapshot for each transferred argument. C clears every input-owner slot at its
Lean handoff. Reentrant callbacks therefore observe caller aliases as closed.
Shallow aliases and sibling resources sharing an owner close together;
independently retained resources remain usable. Callback borrows and duplicate
leases across consuming arguments are rejected before handoff.
Generated docstrings identify each consuming argument by its Python name.

Private real-Lean probes inject Python and native allocation failures before and
after single- and multiple-input handoffs. They retain exception tracebacks and
check live allocation and identity counts after each failure without relying on
garbage collection. Invalid input leaves caller ownership intact; post-handoff
errors leave it consumed. Callback exceptions preserve the original exception
object after native cleanup.

The installed gate creates prepared wheels, rejects forged ownership contracts
and adapter bytes, and reproduces byte-identical archives. It removes producer
sources before offline pip installation. Python 3.11 runs with both the minimum
and current typing backport; Python 3.12 uses its standard library. Consumers use
ordinary public imports. Separate loader probes check cleanup, compatible
imports, concurrent imports, runtime conflicts and post-fork rejection. The
documentation example passes strict type checking and executes from the wheel.
Installed environments execute again after relocation and removal of the handoff.
The reviewed build also installs C, C++ and Cargo companion packages.

Transfer-enabled Python ownership contracts use version 2 and wheel receipts use
version 3. The public C adapter remains version 4 with `ownedValues` version 3.
Borrow-only generated Python packages remain byte-identical. Local wheel tests
select glibc 2.36 to match this host; the builder checks library symbol versions.
Production defaults remain glibc 2.38.

The source-bound JSON receipt records the enabled test command, observed checks,
compiled contracts, library identities and reversible source-history updates.
Earlier acceptance receipts remain unchanged. This milestone adds Python input
transfers; it does not complete other consumer bindings, owner-anchored borrowed
results or owned Docker acceptance.
