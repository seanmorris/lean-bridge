# A Perl exception keeps the original meter alive

The [installed client](../../tests/fixtures/perl-host-meter/error-owner.pl)
first receives its meter in a returned `Err`. A second call throws a
declaration-specific exception with the same meter inside `Ok(Err(meter))`.
After leaving the throwing binding, neither the original variable nor the
returned value remains. The other package reads 23 through the exception,
changes it to 42, and sees that change through a weak reference. Dropping
the exception clears the weak reference and runs one destructor. The peer
still answers a fresh call with 37.

Both package orders passed on threaded and unthreaded Perl 5.36.3 and
5.38.2. The [ordinary records](perl-error-owner-20261126/ordinary.json)
identify the prebuilt XS libraries; the [reviewed records](perl-error-owner-20261126/reviewed.json)
identify component XS built against the prebuilt runtime. Each record pins
the archives, installed libraries and clients. These are synchronous
declared errors, not callback exceptions or fatal runtime faults.

To replay, set `LEAN_BRIDGE_PERL_ERROR_OWNER_ORIGINAL` to the directory of
five digest-prefixed archives from the [original CPAN builds](perl-host-imports-20261124.md#cpan-host-packages)
and `LEAN_BRIDGE_PERLS` to a JSON array of the four Perl executable paths.
Run `npm run test:perl-host-error-owner`. The replay checks the archive hashes
before installing. To build fresh packages and run the same client, use
`npm run test:perl-host-packages` with the original publisher inputs instead.
