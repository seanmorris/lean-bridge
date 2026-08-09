# PHP-Wasm Release Package Evidence

Status: one manifest now builds a PHP 8.4 extension, one shared Lean runtime, three independently compiled Lean components, an ordinary Composer package, PHP-Wasm loader metadata, capsule records, proof-aware Binding IR, provenance, and artifact hashes. Two isolated output roots contain 61 byte-identical files. The published `php-wasm@0.1.0` host executes the package successfully.

## Consumer result

PHP application code loads the generated Composer package and uses ordinary classes and functions:

```php
use LeanAlpha\Box;
use LeanAlpha\Bytes;
use LeanAlpha\Payload;
use function LeanAlpha\roundTrip;

$box = new Box(41);
$payload = roundTrip(new Payload(
    false,
    8,
    'wasm',
    Bytes::fromString("\x00\x7f\xff"),
    [1, 5, 13],
));

assert($box->read() === 41);
$box->close();
```

The public call contains no Wasm URL, loader handle, dispatcher name, symbol prefix, numeric object handle, reference-count operation, `ccall`, or `cwrap`.

The host test observed:

- the generated extension loaded under PHP 8.4;
- one Lean runtime initialization and one component initialization;
- canonical PHP object identity for one retained Lean object;
- typed `Bool`, `UInt32`, `String`, `ByteArray`, and `Array UInt32` values crossing without JSON;
- a PHP callback invoked from Lean;
- a Lean closure projected as an invokable PHP object; and
- zero live identities after deterministic cleanup.

## Locked dynamic-link target

PHP-Wasm 0.1.0 ships a PHP 8.4.1 main module built with Emscripten 3.1.68. Emscripten side modules share internal table layout and relocation conventions with their main module. A component built with Emscripten 6.0.6 can validate as WebAssembly and still fail when its relocated function pointers execute inside the 3.1.68 host.

The capsule graph therefore declares a separate `php-wasm-emscripten-3.1.68` artifact target. The package manifest locks:

- PHP-Wasm source commit `bd9a46bf4984bfbdfef4bb6f5b04b7dcd6264c89`;
- npm package `php-wasm@0.1.0` and its integrity hash;
- emsdk commit `54ef088329e5a329614b3659a579d2ccd31fd621`;
- Emscripten source commit `ceee49d2ecdab36a3feb85a684f8e5a453dde910`;
- Emscripten version 3.1.68;
- the Lean source commit and runtime patch set;
- every capsule and component artifact hash; and
- maintained `weaker@0.0.10` with its source and npm identities.

The ordinary browser and threaded capsule targets remain separate. The build refuses to substitute one target for another.

## One runtime and one address space

PHP-Wasm loads this flat closure into its existing main module:

1. `liblean_bridge_runtime.so`
2. `alpha.so.wasm`
3. `beta.so.wasm`
4. `gamma.so.wasm`
5. `php8.4-lean-alpha.so`

Each binary imports the PHP-Wasm memory and function table. None exports another memory or table. Alpha registers its compiled function pointers with the shared runtime during side-module construction. The PHP extension calls stable runtime symbols, so independently built components keep their own constructors while all PHP packages use one runtime broker, one Lean heap, and one identity domain.

The generated host uses Vrzno's paired identity-index model with the maintained Weaker implementation. A native `WeakMap` maps host objects to identities. `WeakerMap` provides weak reverse lookup. Request shutdown invalidates callbacks and releases request-owned wrappers without shutting down the shared Lean runtime.

## Reproducibility gate

Run:

```sh
npm run test:php-wasm-package:release
```

The gate builds the package twice in separate temporary roots, compares every file, executes one build in the published PHP-Wasm host, and writes:

- `build/php-wasm-release-evidence/reproducibility.json`
- `build/php-wasm-release-evidence/reproducibility.md`

The comparison covers generated Composer sources, PHP stubs, C and Zend sources, the shared runtime, all component side modules, the compiled PHP extension, loader descriptors, capsule metadata, Binding IR, package documentation, provenance, release manifests, and SHA-256 inventories.

Current selected artifact sizes and hashes:

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| shared Lean runtime | 8,912,945 | `99ca4b92a22f49c3191ecefa180333e38155ac550c344d1cb16bb3894a4e1141` |
| PHP 8.4 extension | 23,174 | `8dcef8509576d555d205146ab2bf819d9450085a5842f8b74c320e2261f0eac6` |
| Alpha component | 4,658 | `707b37be0dbcd96794c815a32a94a07961a8381596623feeb19ca859c984aa7a` |
| Beta component | 632 | `c0974acd932e10eaf93c46661aa6e62db9714377811caa8e96f5b8b854d33c05` |
| Gamma component | 633 | `7ef7c6511cf56be2da63f580163fe4836fd521f59b03aa9499588611dcc72071` |

Any differing path blocks the gate. The machine report records both hashes and likely entropy sources.

## Current target boundary

This release target supports the Lean component behavior exercised by the Alpha package. Browser PHP does not provide the full libuv operating-system surface expected by a general Lean application. The generated compatibility library returns `UV_ENOSYS` for unsupported filesystem, process, terminal, networking, and thread operations. A component that requires those effects MUST declare them, and the package analyzer MUST reject this target until a host implementation exists.

The current host gate runs through `PhpNode`. Browser execution, additional PHP versions, ZTS, signed provenance, registry publication, and independent third-party rebuild attestations remain release work.
