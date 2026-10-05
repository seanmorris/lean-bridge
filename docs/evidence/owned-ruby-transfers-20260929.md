# Ruby consuming-input acceptance

The transfer gate compiles twenty consuming contracts from ordinary Lean source
and from an independently reviewed API. Inputs include host-assembled records,
variants, arrays, lists, options, results, nested products, aliases, recursive
values, mixed copied fields and returned Lean closures.

Ruby collects the resource leases visited during conversion and prepares a
native snapshot for each transferred argument. C clears all input-owner slots
at the Lean handoff. Reentrant callbacks therefore observe caller aliases as
closed. Shared `dup`, `clone` and sibling leases close together; independently
retained resources remain usable. Callback borrows and repeated leases across
consuming arguments reject before handoff. Generated comments name each
consuming argument.

Private real-Lean probes inject Ruby and native allocation failures before and
after single- and multiple-input handoffs. They retain exceptions and check
live allocation and identity counts after each failure without relying on
garbage collection. Invalid input preserves ownership; post-handoff errors leave
inputs consumed. Callback failures preserve the original exception object after
native cleanup. Nonlocal exits and Fiber switches reject.

The installed gate builds gems, rejects forged ownership contracts and adapter
bytes, and reproduces byte-identical archives. It removes producer sources
before offline gem installation. Consumers use the public API through ordinary
`require`. Separate loader probes check cleanup, concurrent imports, isolated
GMP binding and fork rejection before lock acquisition. The documentation
example executes from the installed gem. After removing the handoff and gem
cache, the consumer runs again from a relocated installation. The reviewed build
also installs C, C++, Cargo and PyPI companion packages.

Transfer-enabled Ruby ownership contracts, private adapter receipts and package
receipts use version 2. The adapter's `ownedValues` uses version 3. Borrow-only
generated packages retain their previous bytes and versions. Local acceptance
uses glibc 2.36 to match this host and checks library symbol requirements.
Production builds retain the glibc 2.38 default.

The source-bound JSON receipt records the enabled command, observations,
compiled contracts, library identities and reversible source-history changes.
Earlier receipts remain unchanged. Other consumer transfer bindings,
owner-anchored borrowed results and owned Docker acceptance remain open.
