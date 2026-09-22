# Native constructor allocation checks

VO 1219, 22 September 2026. Native component builds now check every constructor
allocation in freshly compiled Lean module and adapter C against the headers of
the verified shared runtime.

The pinned mimalloc configuration routes Lean constructors through
`mi_malloc_small`. Its maximum is `MI_SMALL_SIZE_MAX`, 1,024 bytes on the supported
64-bit native target. Lean's separate object-field and scalar-byte limits do not
guarantee that an allocation fits this allocator. The recursive transport stress
test exposed a constructor that exceeded that limit and crashed inside mimalloc.

The [allocation guard](../../src/build/native-allocation-guard.mjs) uses the C
compiler to check the actual emitted object count, scalar bytes, object header
size and allocation alignment. It does not infer Lean layouts from source types.
Nonconstant sizes and sizes beyond the allocator or Lean field limits fail the
build. Valid allocations still call Lean's unchanged allocation function.
Closures use `lean_alloc_object` and do not have this constructor-specific limit.
Foreign C inputs and precompiled runtime code are outside this call-site check.

An unsupported allocation reports `native-constructor-allocation-unsupported`.
Authors can reduce the fields stored directly in that constructor, for example
by putting repeated data in an Array. The build removes its partial component.
This diagnostic does not change the recursive transport's separate value-depth,
node and per-call copy limits.

Native component receipts use schema version 2 and bind the generated
`allocation-guard.h`. Projection verifies its exact contents independently of
the artifact inventory; changing the header and rehashing the inventory and
receipt still rejects. All native package ecosystems retain the header beside
the component's other provenance files. Earlier component receipts must be
rebuilt before projection; historical installed-package evidence remains intact.

Run the checks with:

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_RECURSIVE_TEST=1 \
  node --test tests/native-allocation-guard.test.mjs
```

Tests cover exact aligned allocation boundaries, Lean's field limits, negative
and overflowing sizes, nonconstant sizes, a fresh 255-field Lean component, an
oversized counterpart, atomic cleanup and receipt tampering. The performance
workflow runs this suite alongside the compiled recursive transport tests.

The guarded transport still passes 169,840 assertions. The allocation and
installed C/C++ suites pass all seven tests, including identical archives after
source relocation, compiler-free consumers, CMake and pkg-config. A focused CPAN
build/install test also passes. Full contracts pass 1,842 tests with 71 explicit
toolchain skips; documentation tests pass 78 and site tests pass 111. Lint and
repository typechecks pass. Runtime include paths are normalized so assertion
strings do not make component binaries depend on their build directory.

Installed recursive C/C++ acceptance is still required. These checks remove one
native integration hazard and do not promote installed type coverage.
