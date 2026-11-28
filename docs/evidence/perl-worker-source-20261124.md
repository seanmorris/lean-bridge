# Perl objects on Lean workers: compiler checks

The local Lean 4.32.2 compiler accepted [ordinary and reviewed worker
exports](../../tests/fixtures/perl-host-workers/Jobs.lean) with opaque Perl
objects. It rejected the same imported method reached indirectly from four
different locations: a task, a cursor factory, a cursor pull and a cursor
close. Each diagnostic named the offending Lean declaration. An altered host
contract was also rejected before invoking the compiler.

The positive checks compare both public APIs and verify lease ownership at
the input, return, callback and typed-error sites. A synchronous Perl member
call remains synchronous. A retained callback names the owning event loop
and its own exception type. The wire test verifies a separate Perl nominal
identity and rejects foreign runtime and incompatible wire configurations.

Run these from the repository root with the pinned Lean toolchain available:

```sh
node --test tests/helpers/perl-worker-elaboration.mjs
node --test tests/perl-host-worker-wire.test.mjs tests/dotnet-host-worker-wire.test.mjs
```

The source test passed all five TAP checks, and all four wire checks passed.
These results cover compiler and wire generation, not installation of CPAN
archives or execution of the Perl event loop.
