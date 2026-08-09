# Generated PHP Backend Evidence

Status: the Alpha Binding IR generates one Composer package that runs through ordinary PHP values, functions, resources, and callables. It also generates a native Zend adapter over the C transport. The PHP-Wasm transport remains separate work.

## Generated package

`generatePhpBindingPackage` emits:

- namespaced PHP functions;
- readonly copied-value objects;
- canonical resource classes with deterministic `close()`;
- invokable returned-callable classes;
- native PHP callbacks;
- declared exception classes;
- typed property metadata, iterators, and awaitables;
- a private interface with one typed method per declaration;
- a generated PHP stub for static analyzers;
- Composer autoload metadata;
- reflection, assurance, capability, and binding manifests; and
- package documentation with a concrete call example.

The generated consumer surface is direct:

```php
use LeanAlpha\Box;
use LeanAlpha\Bytes;
use LeanAlpha\Payload;
use function LeanAlpha\makeAdder;
use function LeanAlpha\roundTrip;

$box = new Box(41);
$payload = roundTrip(new Payload(
    false,
    8,
    'typed',
    Bytes::fromString("\x00\x7f\xff"),
    [1, 5, 13],
));
$addTwo = makeAdder(2);

assert($box->read() === 41);
assert($addTwo(40) === 42);

$addTwo->close();
$box->close();
```

The consumer does not write an adapter, invoke a dispatcher, or handle a numeric runtime identity.

## Type and lifetime behavior

`Payload` retains distinct `bool`, checked `UInt32`, UTF-8 `string`, `Bytes`, and typed list fields. Generated code validates each field and passes the object through the typed transport. It never converts the record to JSON.

`Box` owns a private transport identity. `IdentityCache` uses PHP `WeakReference` values and a `WeakMap` reverse index. Repeated projection of the same live identity returns the same PHP object. `close()` releases the transport value once and removes both cache directions. A destructor calls `close()` as fallback cleanup.

The design follows Vrzno's canonical object, class, array, and callable wrappers. Vrzno pairs a forward `WeakMap` with a weak-value reverse map and synchronizes host liveness with PHP reference ownership. The bridge uses the maintained [Weaker](https://github.com/seanmorris/weaker) implementation as the PHP-Wasm precedent instead of copying Vrzno's embedded historical version. [Vrzno](https://github.com/seanmorris/vrzno) and [PHP-Wasm](https://github.com/seanmorris/php-wasm) remain the primary transport architecture references.

## Typed transport boundary

The private `Transport` interface contains one method for each Binding IR declaration plus generated close and returned-callable operations. Both the native Zend extension and the PHP-Wasm extension must implement this interface. They cannot rename public declarations, change ownership, expose lower-level calls, or select a different error policy.

Initialization runs once when the first public operation requests the transport. A failed initialization remains terminal. Each generated declaration validates inputs, calls its typed transport method, validates copied results, and translates declared transport error IDs into generated PHP exceptions. Unknown transport errors become `UnexpectedError`. A declaration with the `poison-runtime` policy makes every later operation fail before transport dispatch.

## Package gate

The binding manifest records the canonical Binding IR hash, generator identity, exported names, public and internal files, required transport capabilities, and every generated file hash. The audit rejects:

- edited generated files or stubs;
- public generic dispatch;
- `ccall`, `cwrap`, pointers, handles, C symbols, and Wasm objects;
- `mixed` in the generated public stub;
- export or Composer metadata drift; and
- unresolved required transport capabilities.

`tests/php-generator.test.mjs` parses every generated PHP file, builds Composer autoload metadata, and runs a consumer against a typed fixture transport. The executed path covers copied primitives, canonical object identity, callbacks passed into Lean, a returned invokable object, exactly-once initialization, deterministic close, use-after-close rejection, declared error translation, and terminal runtime poisoning after an unknown transport failure.

The userland fixture establishes the generated package contract. The compiled Zend fixture establishes that the same package can discover a native adapter and execute without consumer setup. Node 946 connects the adapter to the shared native Lean runtime. Node 943 provides the PHP-Wasm transport.
