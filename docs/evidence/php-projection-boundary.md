# Shared PHP Projection and Transport Boundary

Status: implemented and contract-tested for the architecture POC.

The PHP backend compiles Binding IR into one transport-neutral projection. A native Zend extension and a PHP-Wasm extension must consume that projection without changing its public names, types, ownership rules, failures, result delivery, documentation, or assurance links.

The executable projection lives in [`src/backends/php/projection.mjs`](../../src/backends/php/projection.mjs). Its tests live in [`tests/php-projection.test.mjs`](../../tests/php-projection.test.mjs).

## Public PHP contract

| Binding IR concept | PHP projection |
|---|---|
| Immutable copied record | `readonly` value object with typed constructor properties |
| Mutable copied record | Value object with generated writable properties where declared |
| Fixed-width integer | `int` with generated range checks |
| Lean arbitrary integer and unsigned 64-bit integer | Generated `BigInteger` value object |
| UTF-8 string | `string` with boundary validation |
| Bytes | Generated `Bytes` value object, distinct from text |
| Typed array | PHP list with element adaptation and static-analysis type |
| Identity-bearing resource | Canonical PHP object scoped to one Lean runtime |
| Host callback | Normal PHP `callable` |
| Returned Lean callback | Canonical invokable PHP object with `close()` |
| Declared failure | Named exception |
| Iterator | `Traversable` |
| Asynchronous result | Generated `Awaitable` contract |

Consumers call namespace functions and class methods. They never call a generic dispatcher, pass numeric handles, identify a transport, or write marshalling code.

## Closed transport contract

The projection assigns one internal typed method to each declaration. The Alpha fixture produces these operations:

| Public call | Internal transport method |
|---|---|
| `new LeanAlpha\Box(41)` | `leanAlphaBox` |
| `$box->read()` | `leanAlphaBoxRead` |
| `$box->identity()` | `bridgeAlphaBoxIdentity` |
| `LeanAlpha\roundTrip($payload)` | `leanAlphaRoundTrip` |
| `LeanAlpha\withCallback($value, $callback)` | `leanAlphaWithCallback` |
| `LeanAlpha\makeAdder($base)` | `leanAlphaMakeAdder` |

Generated lifecycle operations add `boxClose` and `transformClose`. The interface has no `invoke`, `dispatch`, `ccall`, pointer, or public identity method. The native adapter can implement the interface over generated C. The PHP-Wasm adapter can implement it over the shared Wasm runtime and Vrzno host hooks.

Every projection declares the complete capability set required from a transport. `compilePhpTransportManifest` records each missing capability as a blocking gap. `assertPhpTransportSupported` stops package generation when any gap remains. A transport cannot publish a reduced package under the same public contract.

## Identity and lifetime design from Vrzno

The source review used these revisions:

- [`seanmorris/vrzno@c3aa3b9dd9de0eab88e3e3c3dc0f86d813ebb53d`](https://github.com/seanmorris/vrzno/tree/c3aa3b9dd9de0eab88e3e3c3dc0f86d813ebb53d)
- [`seanmorris/Weaker@8e147cc8832589f582ab61a12b9c429dee1e15b0`](https://github.com/seanmorris/Weaker/tree/8e147cc8832589f582ab61a12b9c429dee1e15b0)
- [`seanmorris/php-wasm@bd9a46bf4984bfbdfef4bb6f5b04b7dcd6264c89`](https://github.com/seanmorris/php-wasm/tree/bd9a46bf4984bfbdfef4bb6f5b04b7dcd6264c89)

Vrzno's `UniqueIndex` pairs a `WeakMap` from object to integer with a `WeakerMap` from integer to object. Its object, array, class, and callable caches reuse wrappers by native identity. Its finalization registries synchronize references held across JavaScript and PHP, and request shutdown clears the registries.

The bridge keeps that shape and tightens the contract:

1. PHP wrapper identity is canonical within one shared Lean runtime.
2. PHP uses `WeakReference` values indexed by opaque runtime identity and a `WeakMap` for reverse lookup.
3. The PHP-Wasm host adapter uses the maintained `weakermap` package. It does not copy the class embedded in `vrzno.c`.
4. Deterministic `close()` performs ownership release. Finalization only recovers a missed close.
5. A call-scoped borrow never enters the persistent identity cache.
6. Request or application shutdown invalidates the cache and releases remaining explicit leases in dependency order.

The maintained `WeakerMap` provides weak values, arbitrary keys, enumeration, clearing, and replacement-safe finalizer registration. The PHP-Wasm adapter must pin the package revision or package version in its reproducible closure. A host without real weak references must report a capability gap or use a separately reviewed strong-cache profile with explicit retention limits.

## PHP-Wasm package loading

PHP-Wasm package helpers expose version-aware `getLibs` and `getFiles` functions. `resolveDependencies.mjs` normalizes the returned assets. `PhpBase.mjs` maps shared library names to URLs, preloads the assets, writes extension entries to `php.ini`, and initializes one PHP runtime.

The Lean PHP-Wasm transport will reuse that package shape. Its package helper must return the complete ordered library closure because the reviewed dependency resolver flattens the direct helper result and does not recursively call helpers returned by another helper. The canonical Lean capsule graph remains the source of dependency order and artifact identity.

## Contract evidence

Run:

```sh
node --test tests/php-projection.test.mjs
```

The tests verify deterministic projection, immutable copied values, checked primitive types, bytes distinct from strings, canonical resources, callable adaptation, named exceptions, `Awaitable`, `Traversable`, unique typed transport methods, explicit capability gaps, and package blocking.
