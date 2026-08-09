# PHP-Wasm Shared Runtime Composition Evidence

Status: verified for two independently compiled Lean components in the PHP-Wasm 0.1.0 host. Alpha creates a retained Lean value. Beta reads that value and returns its canonical PHP object. The eager and lazy profiles use one runtime initialization, one memory, one function table, one Lean heap, one component initialization domain, and one PHP identity domain.

## PHP surface

The generated Composer package exposes direct functions and classes:

```php
$box = new LeanAlpha\Box(41);

assert(LeanBeta\read($box) === 41);
assert(LeanBeta\identity($box) === $box);

$box->close();
```

Alpha and Beta are separate `.so.wasm` components. PHP receives no Wasm handle, Lean pointer, numeric identity, loader object, dispatcher, `ccall`, or `cwrap`. The generated Zend adapter performs component loading, initialization, argument adaptation, and wrapper lookup.

## Runtime observations

The integration gate records these values before the first Beta call:

| Observation | Value |
|---|---:|
| runtime initializations | 1 |
| component initializations | 1 |
| attached components | 1 |
| live retained identities | 1 |

After Beta reads the Alpha value and returns it:

| Observation | Value |
|---|---:|
| runtime initializations | 1 |
| component initializations | 2 |
| attached components | 2 |
| live retained identities | 1 |

The runtime instance ID and identity domain ID remain unchanged. `LeanBeta\identity($box)` returns the same PHP object by strict identity. Closing the object reduces the live identity count to zero.

The host rejects a second graph whose Lean runtime patch identity differs from the attached graph. It reports `shared-runtime-conflict` before component initialization.

## One memory and one table

The PHP-Wasm main module owns the WebAssembly memory and function table. The shared Lean runtime, Alpha, Beta, Gamma, and the generated PHP extension each import exactly:

```text
env.memory
env.__indirect_function_table
```

None of those side modules exports another memory or table. The integration gate compiles and inspects every binary before PHP execution. This structural check proves that the loaded components resolve through the main module's memory and table.

PHP-Wasm 0.1.0 exposes its memory buffer to the host bootstrap, so the gate also checks that the Lean host records the same buffer. That release does not publish the table object through its JavaScript API. The table claim therefore rests on the module import and export audit, not an unavailable JavaScript identity comparison.

## Startup and lazy loading

Both profiles come from one capsule graph and preserve the same PHP API.

The `side-startup` extension declares this `dylink.0` dependency closure:

```text
liblean_bridge_runtime.so
alpha.so.wasm
beta.so.wasm
gamma.so.wasm
```

Emscripten loads that closure before PHP calls Beta.

The `side-lazy` extension declares only:

```text
liblean_bridge_runtime.so
alpha.so.wasm
```

The package mounts Beta's bytes at `/beta.so.data`. The generated private Emscripten adapter instantiates Beta on the first `LeanBeta` call, merges its exports into the existing module, and registers it with the shared runtime. The `.data` suffix prevents Emscripten's preload plugin from treating the file as an eager dynamic library. Only the lazy extension enables Asyncify.

## Current measured artifacts

These measurements came from the pinned PHP-Wasm composition fixture. They establish a local POC baseline, not a general performance claim.

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| shared Lean runtime | 8,913,483 | `9277b01bae94c01e80e90632db52efab8de086093b461950051f5673a2ac4980` |
| Alpha component | 4,658 | `707b37be0dbcd96794c815a32a94a07961a8381596623feeb19ca859c984aa7a` |
| Beta component | 632 | `c0974acd932e10eaf93c46661aa6e62db9714377811caa8e96f5b8b854d33c05` |
| Gamma component | 633 | `7ef7c6511cf56be2da63f580163fe4836fd521f59b03aa9499588611dcc72071` |
| lazy PHP extension | 28,489 | `7bf01a032ecd33b92edf5970acd77dcb6d9394126145a9a7faab316fca43ae24` |
| startup PHP extension | 25,162 | `9c8372546466e6f12b7eac2786e43aa85d115ba84ba43135b3e57aa18354616e` |

The PHP-Wasm host allocated 134,217,728 bytes of linear memory in each tested profile. Node 953 will add startup, first-call, warm-call, callback, throughput, cleanup, and cross-transport measurements.

## Reproduce

Run:

```sh
npm run test:php-wasm-composition
```

The command builds both profiles from the same locked graph, executes each package in the published PHP-Wasm host, audits every side module, tests a conflicting runtime graph, and writes machine-readable and human-readable reports below `build/php-wasm-composition`.
