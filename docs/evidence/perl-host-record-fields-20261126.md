# Passing Perl objects inside a Lean record

Perl constructed a Gauge pair with two application meters, a byte string and a
131-bit `Math::BigInt`. Compiled Lean flipped the pair, changed its copied
fields and returned the **original Perl objects**. A Lean function captured
the pair and remained callable after its input closed. The returned record
outlived the creating binding; Inspector, an independently compiled package,
incremented its meter to 24. A weak reference cleared when the caller released
the last reference. The [client](../../tests/fixtures/perl-host-record/installed.pl)
also checks that neither mutating the constructor arguments nor mutating a
returned big integer changes the stored values, including Lean's zero.

The [failure client](../../tests/fixtures/perl-host-record/failures.pl) exceeded
the shared input budget on the second argument before the first meter's method
ran. On output, two 6 MiB copies fit but the third did not. The intermediate
meter was released, no partial result escaped, and an existing closure still
worked. An application exception retained its Perl reference identity. A forked
child could not use the parent's record, nor could a cloned interpreter close
it. These are recoverable boundary failures, not fatal runtime faults.

Both [ordinary](perl-host-record-20261126/ordinary.execution.json) and
[reviewed](perl-host-record-20261126/reviewed.execution.json) records contain
eight installs: Perl 5.36.3 and 5.38.2, threaded and unthreaded, using either
prebuilt XS or XS built at install time for the components. All use the prebuilt
runtime. Each ran both clients after relocation with no author tools on PATH.
The [installer](../../tests/helpers/perl-host-record-installed.mjs) verifies the
installed XS hashes and rejects a reviewed interface that swaps two fields of
the same type. See the [Gauge](perl-host-record-20261126/ordinary.package-set.json),
[reviewed Gauge](perl-host-record-20261126/reviewed.package-set.json) and
[Inspector](perl-host-record-20261126/peer.package-set.json) package receipts.

To reproduce, set `LEAN_BRIDGE_PERLS` to a JSON array of the four Perl
executables and run `npm run test:perl-host-records` with the native CPAN
authoring toolchain. The test writes route-specific execution records to
`build/perl-host-record` or `LEAN_BRIDGE_PERL_HOST_RECORD_OUTPUT`.
