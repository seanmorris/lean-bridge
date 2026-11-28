# Perl worker objects on four interpreter ABIs

One Lean component and one native worker ledger were used unchanged by
threaded and unthreaded Perl 5.36.3 and 5.38.2 on Linux x86-64.
The [transport test](../../tests/helpers/perl-worker-transport.mjs) compiled
the generated XS for each interpreter. All eight Perl processes passed
(two fresh processes per ABI) in a 176-second test.

| Compiled artifact | SHA-256 |
| --- | --- |
| Lean component | `ecdade10d7c66f2d18787e8b96b3032a060a93932fd17062436530b757d30054` |
| Worker ledger | `39f751ace1626f07fe8ef74b757428d6c4fc7e7b87739ab252107122d2018381` |

The [XS probe](../../tests/fixtures/perl-host-workers/private.pl) checked
ordinary completion, returned `Except`, and typed factory failure against
the original blessed object. A failed argument conversion left the live
count unchanged. After normal return and exception unwinding, the parked
token was stale and the registry count was zero.

The [Perl application](../../tests/fixtures/perl-host-workers/public.pl)
used the generated futures and cursors without probe calls. It checked
callback reentry and original exception identity, recovery in Lean,
declared factory and cursor failures, a distinct IO step failure, and
stream exhaustion. Leaving the binding cancelled pending work, released
cold cursor arguments, and kept the exception thrown by the application.
A new binding and a scalar task still worked afterward.

Run `npm run test:perl-worker-transport` with the pinned Lean SDK,
`LEAN_BRIDGE_PERLS` set to a JSON array of interpreter paths and
`LEAN_BRIDGE_PERL_TASK_DEPS` pointing to the offline Perl library directory
containing Future 0.54 and IO::Async 0.805. This check loads locally
compiled XS; it does not install or publish CPAN archives.
