# Native PHP receiver acceptance

Native PHP receiver exports use nominal whole-value owners, camelCase methods
and read-only virtual properties. Receiver and parameter anchors keep their
original owner slots. Consuming members invalidate the original owner when the
Lean call takes ownership. Share and retain preserve the nominal value type.

The acceptance command is:

```sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-php-receivers
```

Both author paths execute the full ownership probes in weak and strict PHP.
They check shared roots, independent retains, recursive and empty values,
callback reentry, allocation failures, retained exceptions and nine parsed
semantic mutations. Resource-only probes disable callback transport and result
anchors, then check canonical resource equality and retired-runtime rejection.
Separate callback probes run without result anchors.

Installed Composer checks use an offline-installed CLI, independent producer
builds, source-free installation and two runtime-only deployment locations.
They verify private GMP, automatic shutdown, cold argument validation without
FFI and rejection of changed, missing or symlinked native assets. Resource-only
packages use the native build API with callback transport disabled. The exact
author and consumer documentation examples execute from an installed C/Composer
release.

The complete acceptance run passed all 16 tests with no failures, cancellations
or skips. The source-bound JSON receipt includes all 13 runtime, installed
package and documentation reports. Both ordinary and reviewed Composer releases
passed 222 public checks per weak or strict caller in each deployment location.
The receipt preserves the preceding Perl evidence and records each changed
source file so regression checks can reconstruct the earlier milestone.

PHP-Wasm receivers, callback-result anchors and the final cross-language
container audit remain under VO 1219. This milestone does not promote
support-matrix cells.
