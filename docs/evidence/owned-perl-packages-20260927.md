# Owned Perl CPAN packages

The internal CPAN projection packages the generated ownership adapter inside
each XS image. Each component includes a private GMP 6.3.0 build and pins the
shared Lean runtime package. Installation seals the generated Perl loader with
the digest of the selected XS image. The loader also pins the Lean component
and private GMP digests in code.

The scalar package suite passed sixteen relocated installations: ordinary
source and independently reviewed IR, four Perl ABIs, and both `prebuilt-only`
and `build-xs`. Every installed consumer passed 134 checks. The fixtures cover
all nineteen primitive fields, large signed and unsigned integers, floating
point bits, optional Unit, independent retained owners and malformed inputs.
The shared broker returns to its session-only baseline after result cleanup,
then to zero identities after shutdown.

The producer directory and Lean sources are removed before installation. The
prebuilt installer cannot find a C compiler. Neither installer can find Lean,
Lake or Node. Consumers run after their installed prefixes are moved and with
an unavailable executable search path.

The 51-export callback fixture also passed sixteen installed configurations,
with 115 checks and all nineteen primitive callback signatures per consumer.
Every consumer ended with zero broker identities. The separate raw-native
regression still passes on both source paths and all four ABIs after
sharing its public-call scenarios with the installed suite. Installed checks
use the shared runtime's actual identity counter, without allocation-probe
exports or placeholder counters.

The ordinary scalar package also passed 48 installed authentication processes:
each XS, Lean component and private GMP file was changed before a cold load
and before a warm reload, across all four ABIs and both install modes. All 336
checks passed. Rejection happens before loading any component dependency on
the cold path. The warm path keeps the original native functions usable and
returns to zero broker identities after shutdown. The other three package
cases are undergoing the same additional authentication checks.

## Reproduce

```sh
source scripts/env.sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 node --test \
  tests/owned-perl-package.test.mjs
```

The scalar reports are `build/owned-perl-package/{ordinary,reviewed}.json`.
Callback reports use `{callbacks-ordinary,callbacks-reviewed}.json` in the same
directory. The four interpreters are Perl 5.36.3 and 5.38.2, each with threaded
and unthreaded builds. The glibc override describes this local test host; it
does not change the production package floor.

Public owned-CPAN admission remains disabled. Installed authentication checks,
cross-component coexistence, producer reproduction, CLI routing, release source
registration and consumer documentation still need acceptance before enabling
that path. These local results do not expand the published type-surface claims.
