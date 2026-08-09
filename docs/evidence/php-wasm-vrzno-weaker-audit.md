# PHP-Wasm, Vrzno, and Weaker Extension Audit

Status: verified source audit for the PHP-Wasm transport design.

The audit used these revisions on 2026-08-09:

- [`seanmorris/php-wasm@bd9a46bf4984bfbdfef4bb6f5b04b7dcd6264c89`](https://github.com/seanmorris/php-wasm/tree/bd9a46bf4984bfbdfef4bb6f5b04b7dcd6264c89)
- [`seanmorris/vrzno@c3aa3b9dd9de0eab88e3e3c3dc0f86d813ebb53d`](https://github.com/seanmorris/vrzno/tree/c3aa3b9dd9de0eab88e3e3c3dc0f86d813ebb53d)
- [`seanmorris/weaker@8e147cc8832589f582ab61a12b9c429dee1e15b0`](https://github.com/seanmorris/weaker/tree/8e147cc8832589f582ab61a12b9c429dee1e15b0), package version `0.0.10`

## Audited source identity

| Repository path | SHA-256 | Status | Evidence used |
|---|---|---|---|
| `php-wasm/source/resolveDependencies.mjs` | `f70c7f469d6d47ee268421e976e0f3e536f418f6b1bc8988b0c77d1c912ed08b` | verified | Direct execution with complete and nested helper fixtures |
| `php-wasm/source/PhpBase.mjs` | `d748ee69b4828dc16dc9562b104a44b0eb0136c794c0f641d43bdc9d065e6101` | read | Constructor, asset locator, preload, INI, initialization, and refresh paths |
| `php-wasm/packages/intl/8.4.mjs` | `a171cbc91210b20d2c3e3bb78d5349adefe6b06aac9bbbdce75fc12f9b21871b` | read | Representative versioned library and preload descriptor |
| `vrzno/vrzno.c` | `bae556833b8bb2b40339c66fde27ee84794652e9ef28a7f73e1affea5d2f427e` | read | Identity maps, refcount registries, value projection, request shutdown |
| `vrzno/vrzno_object.c` | `3d8b201025c2c386f69464faade28212ed2c8bc8db75115516ba8ce586bd1241` | read | Zend object creation, canonical class lookup, target access, destruction |
| `weaker/weakermap/WeakerMap.mjs` | `42250e992c7d1dedc36b5ac984c77327c6cc99e2cf002204c8a1fa8138041eff` | verified | Upstream package test suite, 11 of 11 passing |

The hashes identify the source that supports this audit. The PHP-Wasm package manifest must pin the repository revisions or released package versions in its reproducible closure.

## PHP-Wasm loader shape

PHP-Wasm package helpers expose `getLibs(wrapper)` and `getFiles(wrapper)`. Version dispatch lives in each package entry point. Version-specific modules return ordinary descriptors containing a library name, a URL relative to `import.meta.url`, and an optional `ini` flag. Support assets use a virtual filesystem path and URL.

`resolveDependencies.mjs` calls each top-level helper once. It converts its direct library result into an ordered list and a name-to-URL lookup. It also converts direct file results into preload records. `PhpBase.mjs` merges those records with caller files, routes Emscripten asset requests through `locateFile`, preloads support files, writes `extension=` entries for startup libraries, and initializes one PHP runtime.

The Lean package helper will reuse this public shape:

1. Select the PHP and runtime ABI profile.
2. Return the Lean runtime side library first.
3. Return every runtime-free Lean component in locked dependency order.
4. Return the generated PHP extension last with `ini: true` for startup loading.
5. Return graph locks, proof metadata, and other virtual filesystem assets through `getFiles`.

Asset URLs use `new URL(relativePath, import.meta.url)`. This keeps package-relative discovery visible to Node, browsers, and bundlers while allowing the existing `locateFile` override.

## Reproduced resolver boundary

The current dependency resolver does not recursively call a helper returned by another helper. A direct execution supplied a top-level helper whose result contained another `getLibs` helper. The resolver retained that nested helper as a malformed library with an `undefined` URL. A second fixture returned the complete `runtime.so`, `component.so` closure directly. The resolver preserved both entries and their order.

The capsule graph resolver must compute the transitive closure before it emits the PHP-Wasm descriptor. The descriptor then presents a flat, complete, deduplicated list to PHP-Wasm. The bridge must not patch PHP-Wasm to teach its generic resolver about Lean capsules.

## Vrzno identity and lifetime shape

Vrzno projects JavaScript classes, objects, arrays, and callables into ordinary PHP objects. Its `UniqueIndex` pairs two indexes:

- A `WeakMap` maps each JavaScript object to its integer target identity.
- A weak-value map maps the integer identity back to the JavaScript object.

Vrzno keeps additional paired caches for PHP objects, arrays, classes, and callables. A wrapper lookup reuses the cached object for a live native identity. Finalization registries synchronize JavaScript reachability with PHP refcounts and heap allocations. The Zend `free_obj` handler drops a retained target. PHP request shutdown clears wrapper caches and unregisters outstanding cross-boundary ownership records.

The Lean adapter will retain the paired-index architecture and apply the bridge ownership model:

- One process-level PHP-Wasm host owns the Lean runtime, memory, table, and native identity registry.
- One request-scoped projection cache maps runtime identities to canonical PHP wrappers.
- Explicit `close()` releases owned Lean resources. Object destruction is the fallback.
- A request shutdown hook invalidates PHP wrappers and releases request leases without destroying the shared Lean runtime.
- Callback re-entry checks the request generation before it touches PHP state.
- Copied primitives and records never enter an identity cache.

## Maintained Weaker dependency

Vrzno embeds a historical `WeakerMap` class inside `vrzno.c`. The PHP-Wasm Lean adapter will not copy that class. Its host package will import `WeakerMap` from the maintained `weaker` package and pin version `0.0.10` or the audited source revision.

The maintained implementation supplies arbitrary keys, weak object values, enumeration, deterministic deletion, and clearing. Its finalizer checks whether the current value is still live before deleting a key. Its `clear()` method replaces the finalization registry, which prevents a callback from a retired registry from mutating a reused map. The bridge's local `WeakValueMap` tests exercise the same replacement and retired-registry cases deterministically.

A host without `WeakRef` and `FinalizationRegistry` cannot claim the normal identity profile. Generation must report that capability gap or select a separately specified bounded strong-cache profile. Silent strong retention would change lifetime and memory behavior.

## Request and process boundaries

`PhpBase.refresh()` calls registered host refresh hooks, clears shared JavaScript values, then calls `pib_refresh`. The `pib_refresh` path shuts down and reinitializes embedded PHP. Vrzno performs wrapper and ownership cleanup in `PHP_RSHUTDOWN`.

The Lean transport separates those lifetimes:

| State | Owner | Reset boundary |
|---|---|---|
| Lean runtime, memory, table, loaded capsule code | PHP-Wasm host process | Host destruction |
| Loaded component state and initializer registry | Shared Lean runtime | Host destruction |
| JavaScript target identity index | Shared Lean runtime host | Host destruction |
| PHP wrapper cache and request generation | PHP request | Request shutdown or `refresh()` |
| Explicit owned Lean handle | Generated PHP object | `close()`, then destructor fallback |
| Borrowed call argument | Generated handler invocation | Return or exception |

Refreshing PHP must not instantiate another Lean runtime or reload initialized components. It must invalidate PHP-owned wrappers so a stale callback cannot enter the next request.

## Extension-point decision

The transport can use PHP-Wasm without a loader patch. The generated package helper will emit PHP-Wasm-compatible `getLibs` and `getFiles` functions, and the canonical capsule graph will supply the complete flat closure. The adapter will use the ordinary extension initialization and request shutdown hooks already demonstrated by Vrzno.

The implementation still needs Lean-specific code for capsule hash validation, runtime ABI validation, component initialization, typed marshalling frames, callback generation checks, and proof metadata. Those operations belong in the generated Lean descriptor and extension adapter. They do not require changes to PHP-Wasm's asset resolver.

## Audit commands

```sh
node scripts/audit-php-wasm-sources.mjs \
  --php-wasm /path/to/php-wasm \
  --vrzno /path/to/vrzno \
  --weaker /path/to/weaker
node --test tests/weak-value-map.test.mjs
```

The resolver reproduction used the pinned `resolveDependencies.mjs` directly. The maintained Weaker suite passed 11 of 11 tests. The bridge suite passed all five deterministic weak-value identity tests as part of the 204-test repository run.
