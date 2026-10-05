# Perl borrowed results

Plan node: 1219. The [execution receipt](owned-perl-borrows-20261001.json)
binds compiler inputs, generated sources, installed packages and consumer
observations to this source revision. It preserves every earlier receipt.

Perl packages with anchored results expose whole `Value` owners. `get` checks
the original owner, `share` keeps a shared root, and `retain` makes an independent
owner. Closing the last shared root expires borrowed descendants, including
empty arrays and `None`. Resource views extracted through `get` borrow the
whole owner. Consuming calls hand off its original native slot.

The enabled gate runs:

```sh
source scripts/env.sh
LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
npm run test:owned-perl-borrows
```

The gate covers ordinary and reviewed Lean APIs on Perl 5.36.3 and 5.38.2,
each threaded and unthreaded. Runtime probes exercise 19 anchored exports,
four consuming functions, recursive containers, returned closures, callback
reentry, fork/thread rejection, retained exceptions and failures before and
after native handoff. Five deliberately broken XS variants must compile and
then fail semantic consumer assertions. Cleanup checks require zero live
managed allocations, native allocations and identities.

Prepared CPAN archives install through both `prebuilt-only` and `build-xs`.
Consumers run after removing the producer, package handoff and install tools,
then relocating the installed packages. The receipt records repeat runs,
changed-artifact rejection, deterministic archive reassembly and receipt
verification without the producer. A separate combined C/CPAN release executes
the published author and consumer examples without consuming-input contracts.

The CPAN ownership manifest and binding manifest use schema 3. Installers and
package verifiers compare lifetime policy with the compiled native model,
including when a tampered manifest and binding file agree with each other.
Unanchored packages retain their previous generated value API.

Receiver-anchored and callback-result-anchored contracts, other unfinished
consumer projections and the final Docker audit remain separate work. This
receipt does not promote support-table cells or claim registry publication.
