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
