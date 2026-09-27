# Ruby and private GMP

The supported Ruby interpreter already loads system GMP 6.2.1. A native probe
confirmed that ordinary loading resolves the bridge's GMP calls to that host
library. The prepared Ruby adapter needs its authenticated GMP 6.3.0 instead.

The GMP builder now has an opt-in private library name,
libgmp-lean-bridge.so.10. Local symbol binding keeps its allocator globals
independent. The Ruby loader uses glibc's deep-binding flag to resolve verified
dependencies before existing global symbols. This behavior follows the
[Linux dynamic-loading API](https://man7.org/linux/man-pages/man3/dlopen.3.html).

The first private build failed GMP's upstream tests. Its executables copied
library data through ELF COPY relocations while GMP bound its own data locally.
Compiling those test executables as position-independent code removed that
split. The corrected build passes the full upstream make check suite.

The Ruby probe performs 500 exact large-integer round trips, interleaved with
Ruby arithmetic and GC. It checks the resolved library path, independent Ruby,
Lean and private-GMP allocator pointers, and unchanged Ruby allocator hooks.
Both tests passed with no skips. This establishes library isolation, not
installed-gem acceptance.

A separate regression compiled the previous GMP builder from commit ef9bd83
and the current builder with default options. All eight output artifacts were
byte-for-byte identical, including the library, header and build receipt.
The private library option leaves existing default builds unchanged.

The adjacent JSON records source hashes, actual observations, command output
and the default-build comparison. Reproduce the isolation test with:

```sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 \
  tests/owned-ruby-gmp.test.mjs
```
