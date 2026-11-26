# Keeping a function from a record in Perl

The same [Perl program](../../tests/fixtures/structured-types/tariff-fields.pl)
ran against the [ordinary](perl-function-fields-20261126/ordinary.json) and
[reviewed](perl-function-fields-20261126/reviewed.json) CPAN releases. Each
release was installed offline, in prebuilt-only mode, and relocated before
execution on threaded and unthreaded Perl 5.36.3 and 5.38.2. The eight rows
identify the actual installed component receipts; the program also checked
that its component and shared runtime modules came from the relocated install.

The client retained a Lean function from a record, repacked it, and closed the
original wrappers. Its surviving lease returned 43 directly, 42 through Lean,
and 44 when a host callback returned the function itself for Lean to apply.
In contrast, a Perl coderef passed to a call and stored by Lean in a returned
record expired on return: direct and indirect invocation both failed with
status 10, without entering the coderef. Supplying a closed field was rejected
at the Perl wrapper boundary.

Throwing a Perl exception object after allocating a second function during
callback reentry returned the original exception object to the caller.
A fresh function still returned 42. All eight installs reported **1 → 9 → 1**
live identities across acquisition and release, then **0** after shutdown.

Run `npm run test:perl-function-fields` with `LEAN_BRIDGE_PERLS` set to a JSON
array of the four interpreter paths. To retain the handoffs, point
`LEAN_BRIDGE_PERL_TARIFF_KEEP` at an existing directory. To repeat just the
consumer checks, set `LEAN_BRIDGE_PERL_TARIFF_REPLAY` to the saved directory
containing `ordinary/` and `reviewed/` instead.

New releases that accept caller-provided functions in records run each
interpreter with prebuilt XS and with locally compiled XS. In both modes
the consumer uses the same prepared Lean libraries. The installer traces
those libraries and the loaded XS binary to the package manifest and the
installation receipt. To repeat only the local compilation on a retained
handoff, also set `LEAN_BRIDGE_PERL_TARIFF_XS_ONLY=1`; those observations
are written to separate `*.generated-xs.json` files.

### A Lean function passed directly to a Perl callback

The [application](../../tests/fixtures/structured-types/tariff-incoming.pl)
ran against the original compiled Lean component on Perl 5.36.3 and 5.38.2,
with and without ithreads. It compared a callback borrow to a separately
retained lease, rejected the expired borrow after return and failure, preserved
the original Perl exception, and kept the outer callback usable after a nested
failure. An [independent observer](../../tests/fixtures/structured-types/tariff-incoming-observer.pl)
saw one live identity at baseline, three while the lease was held, one after
each of six cases, and zero after shutdown in all four processes.

That checks fresh XS against the authenticated ordinary C adapter. For
the separate installed-package check, set
`LEAN_BRIDGE_PERL_TARIFF_REQUIRE_INCOMING=1` when running
`npm run test:perl-function-fields`. Both author routes must ship the direct
callback contract, and each must pass on all four ABIs with both prebuilt
and installer-compiled XS. An older field-only archive cannot qualify.
