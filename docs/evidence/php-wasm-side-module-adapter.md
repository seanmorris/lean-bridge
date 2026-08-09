# PHP-Wasm Lean Side-Module Adapter Evidence

Status: the generator, PHP-Wasm descriptor, shared host bootstrap, request lifecycle hooks, and source-sharing boundary are implemented and contract-tested. The packaged Emscripten extension build belongs to the next release-package gate.

## Generated library closure

`generatePhpWasmAdapterPackage` consumes a validated Binding IR and a resolved capsule graph. It emits a version-aware PHP-Wasm package helper with ordinary `getLibs` and `getFiles` functions.

For the Alpha, Beta, and Gamma graph, PHP 8.4 receives this direct library list:

1. `liblean_bridge_runtime.so`
2. `alpha.so.wasm`
3. `beta.so.wasm`
4. `gamma.so.wasm`
5. `php8.4-lean-alpha.so`

Only the generated PHP extension has `ini: true`. The runtime and component side modules remain support libraries. Emscripten resolves them into the PHP-Wasm main module, so they use its existing memory and function table. The descriptor contains no nested dependency helper. The capsule resolver computes and validates the transitive closure before generation.

Every graph capsule, the resolved graph, and the Binding IR also appear as `getFiles` preload records. PHP-Wasm mounts them below one graph-specific metadata directory. The generated manifest binds their component identities, dependency order, initializers, runtime ABI, Lean commit, patch hash, artifact hashes, and Binding IR semantic hash.

## One host bootstrap

The package helper prepares the PHP-Wasm module arguments before Emscripten creates the module. It installs three internal inputs:

- the maintained `WeakerMap` class from `weaker@0.0.10`;
- the locked Lean graph manifests requested by the application;
- one host installer function consumed by the generated extension.

This uses the same module-argument path that PHP-Wasm already passes to its Emscripten factory. Vrzno sees `Module.WeakerMap` and therefore uses the maintained package instead of its embedded fallback class.

The installer stores one non-enumerable host on the PHP-Wasm `Module`. Additional Lean packages attach compatible graph manifests to that host. A different Lean ABI, source commit, patch set, or component content hash fails before component initialization.

The host never constructs a `WebAssembly.Memory`, `WebAssembly.Table`, or runtime instance. It records the memory and table already owned by the PHP-Wasm module. Tests install the package twice and receive the same host object, memory buffer, table, runtime initialization count, component state, and identity domain.

## Identity and request lifetime

The host follows Vrzno's paired identity-index design:

- `WeakMap<object, integer>` supplies the forward object lookup.
- Maintained `WeakerMap<integer, object>` supplies weak reverse lookup and enumeration.

Alpha and Gamma receive the same integer when they project the same live object. Deterministic release deletes both directions. Copied values do not enter either map.

The generated Zend adapter receives PHP request initialization and shutdown hooks. The Emscripten hook starts one host request generation at `RINIT` and ends it at `RSHUTDOWN`. Request cleanups run in reverse ownership order. A callback captures its request generation and rejects invocation after request shutdown or `PhpBase.refresh()`.

The shared Lean runtime and initialized component set survive request shutdown. PHP wrapper state and callback permissions do not.

## Shared adapter sources

The PHP-Wasm generator reuses the same outputs as the native PHP transport:

- the generated Composer projection;
- the generated Zend value, object, callback, and exception handlers;
- the generated C binding package;
- the generated Lean component provider;
- the shared runtime broker header.

The PHP-Wasm backend adds Emscripten host hooks and request lifecycle slots. It does not maintain a second marshalling implementation. The generated package manifest records each shared generator identity.

All generic call machinery remains private. PHP consumers continue to use the same `LeanAlpha` namespace, `Box` class, `Payload` value object, functions, exceptions, callables, and `close()` behavior as the native Zend package.

## Contract evidence

Run:

```sh
npm run test:php-wasm-adapter
```

The tests verify:

- the complete dependency-first library list;
- PHP-Wasm-compatible package-relative URLs and preload files;
- one host for repeated package installation;
- one runtime initialization;
- dependency-ordered eager or lazy component initialization;
- shared memory and table identity;
- Vrzno-style canonical object identity through maintained Weaker;
- reverse-order request cleanup and stale callback rejection;
- direct reuse of the generated C binding source;
- generated Zend `RINIT` and `RSHUTDOWN` hooks;
- rejection of static graphs, duplicate asset names, and absent components;
- absence of `ccall`, `cwrap`, or a copied `WeakerMap` from generated host code.
