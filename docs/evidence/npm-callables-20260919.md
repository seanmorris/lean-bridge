# npm primitive callable acceptance, 2026-09-19

VO1218 adds compiled callbacks and returned Lean functions to npm packages. A 62-export library builds from ordinary Lean source and an independently authored, compiler-checked Binding IR review. Each package executes real Lean in Node JavaScript, strict TypeScript, browser JavaScript, React and browser workers.

The [machine-readable record](npm-callables-20260919.json) contains source, package, runtime and receipt hashes. Each JavaScript consumer completes 8,084 checks per source path. Strict TypeScript separately compiles and executes all nineteen primitive mappings, with negative type checks. Browser runs cover Chromium and Firefox. WebKit could not start locally because its GStreamer system libraries are missing; this record makes no WebKit execution claim.

The producer source directory is relocated before installation. Consumers install the component and shared-runtime archives offline and run without Lean or compiler tools on `PATH`. Both source paths produce the same component Wasm and shared runtime. The existing scalar package suites also pass, including two components sharing one runtime.

## Exercised behavior

- Nineteen primitives in borrowed callbacks, repeated callbacks and captured returned functions. Includes integer endpoints, 16,385-bit Nat/Int values, NaN, infinities, signed zero, BOM/NUL text, Unicode scalars and copied bytes.
- One- and sixteen-argument callables, mixed String/UInt64 arguments and multiple callback signatures.
- Explicit disposal, alias invalidation, repeated disposal, `Symbol.dispose`, expired host borrows and invalid calls after disposal.
- Preservation of the original thrown value, suppression of later callbacks after failure, Promise rejection and successful calls after recoverable errors.
- Sixty-four nested call frames, rejection at sixty-five, 1,024 simultaneous Lean leases, registry exhaustion and cleanup, 2,050 lease slot reuses and 4,096 callback stress calls.

The separate transport and contract tests check signature and ownership mismatches, old-runtime rejection, malformed frames, reentrant disposal, stale tokens, conversion budgets, queued finalizers and trap poisoning. These use synthetic native hooks and are not counted as installed Lean checks.

## Implementation

Fresh Lean metadata determines callback signatures and configured outer arities. Generated typed Lean/C trampolines copy primitive values through scalar ABI 2 frames. Private callable ABI 3 adds signature-checked identities; public consumers receive ordinary functions, not dispatch tokens or Wasm pointers.

The shared runtime owns a bounded Lean lease registry. An invocation pins its Lean function until its typed trampoline returns. Release invalidates the lease before decrementing its reference. Monotonic tokens prevent an old alias from acquiring a reused slot. Packaging checks the required runtime exports; the loader checks descriptors, ownership and signature digests before linking the component.

## Scope and remaining work

Callables are synchronous, with one through sixteen primitive arguments and a primitive result. Host callbacks are borrowed for one call. Returned functions require disposal. Each JavaScript realm owns its runtime; workers cannot transfer functions or leases. Wasm traps poison that runtime. Copy work is bounded at 16 MiB per call, nesting at 64 frames, and each host/Lean callable registry at 1,024 entries.

Compound callable values, copied npm containers, resources and asynchronous operations remain separate work. Source-configured closure arities in combined multi-target builds also remain unsupported; build those targets separately. Multi-package callable interchange has not been installed-tested in this milestone.

The inventory adds 400 callable-position cells across five npm profiles and 288 primitive input/result cells previously lacking installed evidence. It reaches 2,990 of 6,562 installed-tested cells. All seventeen profiles now have the 80-cell primitive callable slice on both source paths. Existing historical archive hashes are retained; shared source-file hashes are refreshed without claiming those historical native packages were rebuilt here.

## Reproduce

```sh
bash scripts/build-lean-link-spike.sh --link-only
LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox \
  node --test tests/component-callables.test.mjs
node --test tests/component-callable-contract.test.mjs \
  tests/component-callable-runtime.test.mjs tests/component-scalar-codec.test.mjs
node --test tests/component-scalars.test.mjs tests/component-npm-package.test.mjs
```

Install the pinned toolchains and Playwright engines first. CI runs the installed suite and uploads `build/callables/npm/`. This milestone prepares packages; it does not publish them to npm.
