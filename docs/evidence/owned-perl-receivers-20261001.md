# Perl receiver acceptance

Perl receiver exports use nominal whole-value owners and snake_case members.
Properties are read-only, zero-argument methods. Receiver and parameter anchors
keep their original owner slots, and consuming members invalidate the original
owner at the Lean call boundary. Share, retain and copy preserve nominal types.

The acceptance command is:

```sh
LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
  LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-perl-receivers
```

The gate uses Perl 5.36.3 and 5.38.2 with and without interpreter threads. Direct
probes cover both source paths, original-owner lifetime regressions and seven
semantic mutations. Separate cases omit callbacks, result anchors, or both.

Installed CPAN checks use an offline-installed CLI, independent producer builds,
archive reassembly, runtime-only relocated execution and cold/warm native-asset
rejections. Every ABI exercises both prebuilt-only and build-xs installation.
Resource-only packages use the native build API with callback transport
disabled. The documentation test compiles the author example and executes the
exact consumer example from an installed C/CPAN release.

The complete sixteen-test gate passed with no skips, failures or cancellations.
The receipt binds all thirteen runtime, installed-package and documentation
reports to the exact producer sources and preserves predecessor source evidence.
Callback-result anchors and the final cross-language container audit remain
under VO 1219. This milestone does not promote support-matrix cells.
