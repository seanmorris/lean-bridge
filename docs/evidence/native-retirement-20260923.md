# Native runtime retirement

VO 1219, 23 September 2026. The shared native broker now rejects calls after
permanent runtime failure, including calls through previously initialized
components. Recursive C/C++ package admission remains disabled.

## Runtime state and cleanup

`lean_bridge_native_component_ready` checks both the process runtime and the
attached component. `lean_bridge_native_runtime_retire` permanently marks the
runtime failed. Reinitialization cannot revive it. The broker checks global
state before returning a cached component's initialization result.

Retirement prevents new identity registrations and callback registrations.
Callback lookup also rejects existing tokens. Identity release, callback
release, component detach and copied-root cleanup remain available. Retirement
does not unload the runtime or free objects that consumers still own.

These APIs add retirement capability version 1 without changing the version 1
snapshot layout. The guarded graph adapter requires that capability at compile
time. Prepared packages continue to bind the runtime's exact artifact identity.

## Guarded conversions

`generateNativeCopiedGraphAdapters` accepts the verified component initializer
to select runtime-checked calls. Input validation precedes initialization and
Lean allocation. A malformed returned carrier retires the runtime; invalid
inputs, conversion limits and bridge-allocation failures do not.

| Private graph status | Meaning | Runtime effect |
| --- | --- | --- |
| 0 | Success | None |
| 1 | Invalid input | Recoverable |
| 2 | Conversion limit exceeded | Recoverable |
| 3 | Bridge allocation failed | Recoverable |
| 4 | Malformed native result | Permanent retirement |
| 5 | Runtime unavailable or retired | Call rejected |

The graph adapter checks readiness after Lean returns and again after output
conversion. Failed calls release partial output arenas without changing the
caller's result. An already-owned root remains releasable after retirement.
The standalone transport fixture deliberately omits runtime policy so it can
exercise each malformed-result injection in one process.

Existing nonrecursive C entry points also check readiness. This covers consumers
whose wrappers cache their runtime table. Callback and closure calls hold their
results locally until final status checks pass, then publish them. Failed calls
release local copied results and newly created closure leases. Generated Perl
XS entry points and the older PHP native provider have corresponding guards;
their disposal operations remain available.

Readiness checks do not interrupt a Lean call already executing on another
thread. They reject later entry and prevent result publication when retirement
has been observed. Existing nonrecursive malformed-result classification is
unchanged; this milestone does not claim a universal native trap handler.

## Verification

The compiled broker fixture exercises cold retirement, failed core and component
initialization, cached components, normal shutdown, repeated retirement and
eight threads retaining identities and callbacks across retirement. It checks
that no initializer runs again and that retained ownership counts return to zero.

Both ordinary Lean source and an independently authored reviewed contract pass
169,840 C transport assertions, 469 C++ conversion assertions and 490 guarded
lifecycle assertions. Each builds eighteen exports. Their native component
library SHA-256 remains
`aa2db3227555cc4a790a09a6364955b64a23999ae5822cf9a8dd2968686da112`.

The installed C callable suite runs both source paths: 47,037 consumer assertions,
38 raw-C fault/lifecycle assertions and 12 GMP allocation assertions per path.
It covers retirement during a host callback, unchanged output, rejection through
cached ordinary-function and closure entry points, and retained-value cleanup.
Installed C++ regressions pass 23,896 assertions per source path, including
execution after removing author inputs and installed headers.
The installed Perl test loads a separate test-only XS module to retire the shared
broker, then confirms that its already-loaded generated component rejects
another call.

The older PHP native provider also passes its compiled two-component test.
Eight transport operations reject during or after retirement, and both native
and Zend identity counts return to zero after disposal. The test's old live
identity expectation counted only the native objects; its exact expectation
now includes the separately registered Zend wrappers.

```sh
node --test tests/native-runtime-retirement.test.mjs

source scripts/env.sh
LEAN_BRIDGE_NATIVE_RECURSIVE_TEST=1 node --test tests/native-graph-model.test.mjs
LEAN_BRIDGE_C_CALLABLE_TEST=1 node --test tests/c-callables.test.mjs
LEAN_BRIDGE_CPP_CALLABLE_TEST=1 node --test tests/cpp-callables.test.mjs
LEAN_BRIDGE_PERL_NATIVE_TEST=1 node --test \
  --test-name-pattern='shared configuration drives a compiled and installed native package' \
  tests/perl-native.test.mjs
```

On the Debian 12 test host, native package tests used
`LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36`; the Perl test also used
`LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36`. Release defaults are unchanged.

No installed recursive coverage cells are promoted. Next are the C/GMP value
facade, prepared C/C++ archives and ordinary/reviewed installed recursive
acceptance. The remaining host adapters, compound callback/closure payloads and
explicitly owned resource aggregates remain required.
