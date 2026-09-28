# Native PHP ownership runtime

Native PHP now has shared result leases, explicitly retained identities,
call-scoped borrowed leases and guarded result publication. The runtime uses
the checked public C ownership API through FFI. Composer ownership admission
and the PHP-Wasm owned Zend transport remain closed.

The generated runtime checks the creating process and main PHP execution
context before native use. Calls, retention and explicit close reject inside
a Fiber. Collection inside a Fiber leaves its native result pending until the
next main-context entry or request shutdown. Forked children reject before
calling inherited native functions. Request shutdown closes registered sessions
and releases outstanding result storage.

One returned aggregate can share a result lease among several wrappers. Closing
one wrapper leaves the others usable. `retain()` gives an identity an independent
native owner. Borrowed wrappers expire when their frame closes. Results stay
guarded until all wrappers have been created; failed conversion revokes partial
wrappers and releases their native storage immediately.

The acceptance test compiles fresh Lean fixtures from both ordinary source and
independently reviewed IR. Each source path passes 301 checks, including six
injected PHP allocation-checkpoint failures and four native allocation failures.
The checks cover shared leases, retention, expired borrows, partial-result
rollback, foreign-owner rejection, Fiber finalization, fork rejection and use
after shutdown. Both normal runs finish with zero live bridge allocations
and zero identities.

Another 32 processes per source path deliberately leave a live resource for
request shutdown. The C library's finalizer independently requires zero live
allocations and identities before process exit. All 64 shutdown processes pass.

The first shutdown probe bypassed the package loader and intermittently crashed.
A debugger showed PHP calling `dlclose` while a Lean worker thread still executed
inside the unloaded library. The final probe uses the existing authenticated
PHP package loader, which pins the Lean and broker mappings for the process
lifetime. Native package integration must retain that loading policy.

Run the native acceptance with:

```sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 \
node --test --test-concurrency=1 tests/owned-php-runtime.test.mjs
```

The accepted run passed 3/3 tests without skips in 173781 ms. The local log is
`build-owned-php-runtime-pinned.log`. Reports in
`build/owned-php-runtime/{ordinary,reviewed}.json` record the compiled source
identity, runtime and probe hashes, interpreter hash and all process observations.
The C shim converts small Nat serial numbers for this ownership test. It is not
the public aggregate conversion implementation.

The [PHP value declarations](owned-php-values-20260928.md) already pass in native
PHP and the actual 32-bit PHP-Wasm interpreter. Next are generated bounded
native conversions for the complete value surface, typed callback trampolines,
returned closures, authenticated Composer artifacts and source-free installed
acceptance. Actual native callbacks and Zend ownership need separate tests.
VO1219 also retains JS/Wasm, selected WIT/WASI, transferred inputs and anchored
results.
