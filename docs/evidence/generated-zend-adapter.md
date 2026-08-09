# Generated Zend Adapter Evidence

Status: the Alpha Binding IR generates and compiles a native PHP extension that implements the Composer package's private typed transport. A focused test uses a C fixture. Shared-runtime and release-package tests execute the same adapter against real Lean code.

## Consumer boundary

The Composer package discovers `LeanAlpha\Internal\NativeTransport` when the extension is loaded. Application code does not install a transport, call a dispatcher, pass a pointer, or write a wrapper.

```php
use LeanAlpha\Box;
use LeanAlpha\Bytes;
use LeanAlpha\Payload;
use function LeanAlpha\roundTrip;

$box = new Box(41);
$payload = roundTrip(new Payload(
    false,
    8,
    'typed',
    Bytes::fromString("\x00\x7f\xff"),
    [1, 5, 13],
));

assert($box->read() === 41);
$box->close();
```

## Generated boundary

`generatePhpZendExtensionPackage` consumes the same Binding IR as the Composer and C backends. It emits:

- one Zend method for every typed transport operation;
- the generated C public and runtime headers;
- the generated C transport implementation;
- opaque PHP identity objects for resources and returned callables;
- direct lowering for booleans, checked `UInt32`, UTF-8 strings, bytes, and typed integer lists;
- PHP callback trampolines and returned invokable objects;
- declared error IDs with PHP exception causes; and
- a manifest that binds every source hash to the Binding IR hash.

The adapter does not serialize copied records. `Payload` fields cross as typed C fields. Byte strings keep their length and embedded zero bytes. Lists must be PHP lists and every element must fit `UInt32`.

## Identity and ownership

The extension stores the generated C resource wrapper inside a private Zend object. The public `Box` keeps that identity behind the generated Composer class. An identity round trip returns the existing public object. `close()` disposes the C wrapper once. The Zend object destructor provides fallback cleanup.

The internal identity's diagnostic `value()` method returns `null`. It does not reveal the C pointer or numeric Lean identity. The shared process broker assigns a generation-safe opaque cache key. Reprojection of the same live native value reuses that key, and final release advances the slot generation before reuse.

## Error and callback behavior

A declared C status becomes an internal typed transport error. The Composer layer maps its error ID to the generated public exception class. A PHP exception thrown inside a callback becomes the cause of `CallbackThrew`. The declared callback failure does not poison the runtime, so later calls still execute.

Unknown failures follow the Binding IR poison policy. The public package owns this policy. The Zend adapter cannot replace it with a transport-specific convention.

## Executed test

`tests/php-zend-extension.test.mjs` runs `phpize`, configures and compiles the generated extension, builds Composer autoload metadata, then starts PHP with only that extension and the generated package. The consumer fixture executes:

- resource construction, reading, canonical identity, and deterministic close;
- a copied record containing booleans, `UInt32`, UTF-8 text, binary bytes, and a typed list;
- a native PHP callback called through the C runtime interface;
- a Lean-shaped returned callable projected as an invokable PHP object;
- declared resource failure translation;
- callback exception chaining and continued runtime use; and
- Binding IR hash agreement between the extension and package.

The generator rejects unsupported IR shapes before it emits C. The test also rejects generic dispatch, `ccall`, `cwrap`, and JSON handling in the generated extension source.

`tests/php-native-runtime.test.mjs` replaces the C fixture with the pinned shared native Lean runtime and a generated Alpha provider. [Shared native PHP runtime evidence](shared-native-php-runtime.md) records that execution path.

`tests/php-native-package.test.mjs` builds the complete installed layout twice, compares every byte, executes a clean Composer consumer, and runs two requests through one PHP server process. [Native PHP release package evidence](native-php-release-package.md) records that gate.
