# Returned Lean functions in installed Perl packages

The [Perl client](../../tests/fixtures/perl-host-closures/installed.pl) calls
`$fn->($supplied)` and compares the result to the original captured object
by reference address. It also passes a false-valued exception whose string
conversion dies. The exception caught from both the factory and the later
call is the original object.

Closing a function during its own invocation prevents another call but
lets that invocation finish. A sibling coderef remains callable.
Explicit close, dropping the last function reference, leaving the binding,
and unwinding the binding on an exception each release captures exactly
once. A forked child cannot use or close the parent's coderef; the same
check runs in a cloned interpreter on the threaded Perl builds.

The [retirement client](../../tests/fixtures/perl-host-closures/retired.pl)
uses an XS observer to retire the runtime during a member call. No further
application member runs. Weak references distinguish the object freed when
the failed function closes from the sibling capture freed on scope exit.

The [worker client](../../tests/fixtures/perl-host-closures/worker.pl)
passes the returned coderef directly as a callback, checks the exact
exception at Future settlement, and uses a second returned function to
read two versions of a file and report a typed error for a missing file.
Two independently built CPAN components share objects but own their own
functions. Exiting the peer binding cancels its pending callback, releases
its capture and prevents late invocation. The other package's callback
finishes exactly once and returns its own original object.

| Local package set | Verified receipt (SHA-256) |
| --- | --- |
| Ordinary | `f6fae9a9f63e9b0100bc075425370f63c662cf215c6c3badd181a17d2acbb4bc` |
| Reviewed | `99efb0b578ca230dfef9b1eee127cee8795279df57d6fcd41d87c3eb43d00088` |
| Worker with a filesystem grant | `bb44ac81b1d95a649affd02e1b9788ba60b45d68235287272074e8f5dc4ecf4b` |
| Independently built worker peer | `62707ccc49d7a9e4efd8a5ed1e03dd090cb2509b9799d3ddaa6ffe0ee9df1605` |

The [install test](../../tests/helpers/perl-host-closures-installed.mjs)
ran all three routes on Perl 5.36.3 and 5.38.2, threaded and unthreaded,
with prebuilt XS and locally built generated XS: **24 combinations**.
It checked the installed library hashes, relocated each prefix, and ran
the clients without build tools on their path. The publisher rejected a
wrong-owner review and a file-reading closure without a filesystem grant
before writing a release. To reproduce, run `npm run test:perl-host-closures`
with the [CPAN publisher toolchain](../publish/cpan.md) and the four Perl
interpreter paths in the JSON array `LEAN_BRIDGE_PERLS`.
