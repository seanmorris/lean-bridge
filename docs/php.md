# PHP

Install the package for the PHP runtime that executes your application. Ordinary native packages load their bundled Lean runtime automatically. Ordinary PHP-Wasm packages can load at startup or on the first API call. Consumers do not build Lean.

## Use a prepared release

| Application | Installation | Tested runtime |
| --- | --- | --- |
| Ordinary native PHP CLI package | [Composer archive](#ordinary-project-packages) | PHP 8.2+ NTS CLI, Linux x86-64, FFI enabled, glibc 2.38 or newer |
| Ordinary PHP-Wasm package | [npm and optional Composer archive](#ordinary-php-wasm-packages) | Node 22 or Chromium, PHP 8.4, `php-wasm` 0.1.0, startup or first-call loading |
| Native PHP CLI or deployment | [Native PHP](#native-php) | PHP 8.2 NTS, x86-64 Linux, glibc 2.38 or newer |
| PHP hosted by Node | [PHP-Wasm](#php-wasm) | Node 22, PHP 8.4, `php-wasm` 0.1.0 |

The Alpha native package includes an extension, Lean runtime, and Composer library. Its PHP-Wasm profile uses an npm archive containing side modules and loader metadata, tested in Node. Ordinary PHP-Wasm packages also run in Chromium with the same startup and lazy descriptors.

### Ordinary project packages

Use PHP 8.2 or newer (below 9), NTS CLI on Linux x86-64 with glibc 2.38 or newer. PHP's FFI extension must be installed and enabled. The default `ffi.enable=preload` permits CLI use. This package path does not yet cover FPM, Apache, PHP's development server, ZTS or PHP-Wasm. [PHP FFI configuration](https://www.php.net/manual/en/ffi.configuration.php).

Authenticate your publisher's archive using [Use a prepared release](consume/receive-package.md). This example uses the Clover acceptance package. Put `example-clover-api-2.0.0-RC.1-linux-x86_64.zip` in a `releases/` directory. Use Composer 2 with its ZIP extension for the local artifact repository. Save this as `composer.json`:

```json file=php-native/ordinary/composer.json
{
  "name": "example/lean-php-consumer",
  "repositories": [
    { "type": "artifact", "url": "./releases" }
  ],
  "require": { "example/clover-api": "2.0.0-RC.1" }
}
```

Run `composer install --no-plugins --no-scripts --prefer-dist`. Composer reads the package metadata from the ZIP and installs the PHP files and native libraries together. A registry installation uses your publisher's repository and exact package version instead. [Composer artifact repositories](https://getcomposer.org/doc/05-repositories.md#artifact).

Save this as `main.php`:

```php file=php-native/ordinary/main.php
<?php
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use Brick\Math\BigInteger;
use function LeanClover\{array_u32, echo_nat, echo_text, echo_u32};

$large = BigInteger::of('184467440737095516160000000001');
if (echo_u32(42) !== 42
    || (string) echo_nat($large) !== (string) $large
    || echo_text("Lean λ\0") !== "Lean λ\0"
    || array_u32([0, 4294967295]) !== [0, 4294967295]) {
    throw new RuntimeException('Lean returned an unexpected result');
}
echo '42; exact integers and copied arrays', PHP_EOL;
```

Run `php main.php`. Expected output is `42; exact integers and copied arrays`. You do not need Lean, C headers, a package-specific extension or runtime paths. Keep the installed package directory intact; it can move with your application.

Ordinary native packages support pure functions over 19 primitive types, arrays, Lists, acyclic records, concrete copied variants, options, results and nested binary products. `Unit` is `null`, and `Char` is a UTF-8 string containing exactly one Unicode scalar. Fixed-width integers use PHP `int`, except `UInt64`, which uses `BigInteger`; `Nat`, `Int`, and `USize` use it too. `ISize` uses PHP `int`. Platform words follow the compiled Lean target: 64 bits for native PHP and 32 bits for PHP-Wasm. Composer installs the pinned `brick/math` 1.0.0 dependency. Use `Brick\Math\BigInteger::of` to construct exact integers. Lean Bridge accepts values up to 16,384 decimal digits. `Bytes::fromString` preserves arbitrary binary data. Arrays are consecutive-key lists, and records are final readonly classes. Results own independent copied values.

Parameters use `mixed` with precise PHPDoc so generated checks can reject numeric coercion even in weak caller mode. Invalid types raise `TypeError`; range and conversion limits raise `ValueError`; native failures raise the package's `LeanBridgeError`. `Float32` rounds PHP floats to binary32; floating-point conversions preserve NaN classification, infinities and signed zero.

`BigInteger` is the standard Brick Math class. Its arithmetic methods work on returned values, and two Lean Bridge packages accept the same integer object. For example, `$large->plus(1)` returns another exact integer. For untrusted text, use `BigInteger::parse($text, allowedSyntax: [], maxDigits: 16384)` to bound parsing before calling Lean. See the [Brick Math API](https://github.com/brick/math/tree/1.0.0) and [installed integer checks](evidence/php-brick-math-20260918.md).

Validation, PHP conversion and native copying each have a 16 MiB accounting limit. PHP lists count at least 32 bytes per element. These limits do not bound Lean working memory. `finally` releases native outputs after conversion errors. Compatible packages share one process runtime; post-fork calls and already loaded foreign Lean runtimes are rejected. Loading needs readable `/proc/self/maps` to detect foreign runtime mappings. See [installed PHP evidence](evidence/native-php-copied-20260915.md).

### Arrays and records

Native Composer packages expose nested `Array` values as consecutive-key PHP
arrays and records as final readonly classes. Field names keep their Lean
spelling, including keywords that PHP permits as properties. A record name that
is a PHP keyword gains a trailing underscore: `Records.Empty` becomes `Empty_`.
Names that collide after conversion reject during generation.

For the collection acceptance package, save this as `collections.php` beside
your installed `vendor` directory:

```php
<?php
require __DIR__ . '/vendor/autoload.php';

use LeanCollections as Collections;

$input = [[1, 2, 3], []];
$reversed = Collections\array_reverse_uint32($input);
echo json_encode($reversed), PHP_EOL;

$reversed[1][0] = 99;
echo $input[0][2], PHP_EOL;

$pair = Collections\record_make();
echo $pair->first, PHP_EOL;
echo $pair->equals(new Collections\Pair(42, "\u{feff}🌱\0"))
    ? 'equal' . PHP_EOL : 'different' . PHP_EOL;
```

Run `php collections.php`. It prints `[[],[3,2,1]]`, `3`, `42`, and `equal`,
each on its own line. Returned arrays and records have independent storage.
Record constructors accept exactly their declared fields and validate values
without weak-mode coercion. Extra arguments and uninitialized records reject.

Generated records, variant cases, `Some`, `Ok`, `Err`, and `Bytes` provide
`equals($other)` for exact nested content comparison and `hashCode()` for a
matching hexadecimal value hash. Numeric strings remain distinct, NaNs compare
equal, and positive and negative zero differ. PHP's `==` and `===` operators
keep their built-in meanings. A hash is not a proof of equality or a serialized
value. Comparisons and hashing enforce a 32-level nesting bound and a 16 MiB
traversal budget. Cycles, foreign objects, uninitialized fields, resources, and
non-list arrays reject. Do not mutate referenced payloads while using their hash
as a lookup key.

The [native collection checks](evidence/php-native-collections-20260922.md) run
this exact example from original offline-installed Composer packages, alongside
nested arrays, all nineteen primitive field types and failure-cleanup probes.

### Options, results and products

Prepared native and PHP-Wasm packages generate the branch classes they need inside
their public namespace:

| Lean type | PHP value |
| --- | --- |
| `Option T` | `null` for none, `new Some($value)` for some |
| `Except E T` | `new Ok($value)` or `new Err($error)` |
| `A × B` | Exactly two consecutive-key array elements, `[$a, $b]` |

For the compound acceptance package, whose `classify` function takes
`Option (Option Unit)`:

```php
use LeanCompounds\Some;
use function LeanCompounds\{classify, tuple_string};

echo classify(null);                     // 0: None
echo classify(new Some(null));           // 1: Some None
echo classify(new Some(new Some(null))); // 2: Some (Some Unit)
$swapped = tuple_string(['left', 'right']); // ['right', 'left']
```

Every branch exposes `$value`. A declared domain error returns `Err`; bridge
failures throw `LeanBridgeError`. Success and error remain distinct even when
their payload types match. Products preserve binary nesting: `(A × B) × C`
is `[[$a, $b], $c]`, not a three-element array.

`Some`, `Ok` and `Err` are final readonly classes. Their constructors accept one
payload; each call validates that payload against the concrete Lean signature,
including in weak caller mode. A wrapper does not make an arbitrary object
payload deeply immutable. Returned arrays, records, buffers and wrappers own
independent copies. Use `equals($other)` to compare generated values by their
nested contents. PHP `===` compares object identity; `==` uses PHP's property
comparison rules.

These constructors compose with supported primitives, arrays, records and each
other. Type nesting stops at 32 levels; the existing conversion budgets apply.
Both PHP transports also accept the [named variants](#named-copied-variants) below.
Native packages also accept these types in [structured callbacks](#structured-callback-values).
Both PHP transports accept these constructors in synchronous callbacks.
Resources inside values require the [explicit ownership profile](#resource-containing-values).
Recursive native and PHP-Wasm packages use the [bounded graph conversion](#recursive-values)
described below. See the
[native compound checks](evidence/php-native-compounds-20260920.md) and
[PHP-Wasm compound checks](evidence/php-wasm-compounds-20260920.md).

### Named copied variants

Native Composer and PHP-Wasm packages expose a copied Lean variant as an
abstract readonly family class and a final readonly class for each constructor.
For the native `LeanVariants` acceptance package, save this as `variants.php`:

```php
<?php
require 'vendor/autoload.php';

use LeanVariants\{SignalData, SignalIdle};
use function LeanVariants\echo_signal;

$result = echo_signal(new SignalData(count: 42, label: 'ready'));
if (!$result instanceof SignalData || $result->count !== 42
    || $result->label !== 'ready') {
    throw new RuntimeException('Unexpected Signal payload');
}
$idle = echo_signal(new SignalIdle());
echo $result->label, PHP_EOL;
```

Run `php variants.php`. Constructor arguments can be named or positional, with
the original Lean field names. The family itself cannot be constructed.
Calls accept exact generated cases and reject unknown subclasses and objects
with uninitialized fields, including objects made through reflection. Weak
callers receive the same type and range checks as strict callers. An empty case
and a case containing `Unit` remain distinct.

Payloads can contain all nineteen primitives and the admitted copied arrays,
Lists, records, options, results, products and other variants. Returned values
have independent storage. Readonly properties cannot be reassigned; contained
objects still follow their own PHP semantics. `===` compares object identity,
and `==` applies PHP's comparison rules. Use `equals($other)` for exact nested
content comparison. PHP does not check match exhaustiveness.

Native tags and union layouts stay private. The acyclic adapter uses a 32-level
schema limit and separate 16 MiB conversion budgets. Native recursive packages
use the limits below. Generic, indexed, proof-bearing, callable and
identity-bearing payloads need further support.

PHP-Wasm uses the same named cases with its 32-bit payload mappings. Inside
PHP code loaded through the package's [installed descriptor](#ordinary-php-wasm-packages),
construct the `UInt32` count with `BigInteger`, even for small values:

```php
use Brick\Math\BigInteger;
use LeanVariants\SignalData;
use function LeanVariants\echo_signal;

$result = echo_signal(new SignalData(count: BigInteger::of(42), label: 'ready'));
if (!$result instanceof SignalData || !$result->count->isEqualTo(42)) {
    throw new RuntimeException('Unexpected Signal payload');
}
echo $result->label;
```

The embedded npm declarations and companion Composer package expose the same
PHP API with startup or first-call loading. Invalid inputs reject before a lazy
component loads. [Native PHP checks](evidence/php-native-variants-20260921.md)
and [PHP-Wasm checks](evidence/php-wasm-variants-20260921.md) cover both source
paths, all constructors, independent copied results and failure cleanup.

### Recursive values

Native Composer and PHP-Wasm packages can expose recursive records and variant families.
The generated classes keep their named fields and constructor identity. Calls
accept shared acyclic subvalues, reject cycles and return independent copies.
[Installed recursive acceptance](evidence/recursive-managed-acceptance-20260924.md) covers copied inputs, results and fields on ordinary Lean source and reviewed IR. PHP-Wasm also has
[installed npm/Composer checks](contributing/testing.md#recursive-php-wasm-packages)
and [separate conversion and cleanup tests](contributing/testing.md#recursive-php-wasm-conversions).

For the native recursive acceptance package, save this as `recursive.php`
beside your installed `vendor` directory:

```php
<?php
require __DIR__ . '/vendor/autoload.php';

use LeanRecursive\{SpineLeaf, SpineNext};
use function LeanRecursive\{spine, grow};

$input = new SpineNext(new SpineLeaf(7));
$copy = spine($input);
echo $copy->equals($input) ? 'equal' : 'different', PHP_EOL;
echo $copy === $input ? 'same object' : 'independent copy', PHP_EOL;

$longer = grow($input);
echo $longer->value->equals($input) ? 'one level longer' : 'unexpected', PHP_EOL;
```

Run `php recursive.php`. Composer handles Brick Math, and the package loads
its compiled Lean libraries automatically. Recursive values can contain all
nineteen primitive types, arrays, Lists, options, results and nested products.
Aliases retain their target PHP values without extra wrappers.

Calls allow 128 value levels and 262,144 visited values. Native copies and
accounted PHP storage each have a 16 MiB budget. These limits do not measure
Lean working memory or every PHP allocation overhead. Invalid inputs reject
before Lean loads. Native output is released even if conversion fails;
malformed native output retires the shared runtime. Copied values returned
before retirement remain usable.

See the [Composer acceptance commands](contributing/testing.md#recursive-composer-packages).

For PHP-Wasm, use the prepared npm descriptor and its companion Composer
package as described in [ordinary PHP-Wasm packages](#ordinary-php-wasm-packages). The descriptor mounts all five
generated PHP files. Startup and first-call loading use the same public API;
invalid inputs do not fetch a lazy component. No FFI extension or compiler is
needed by the consumer.

Use `new SpineLeaf(BigInteger::of(7))` in the PHP-Wasm version of this example,
after importing `Brick\Math\BigInteger`. `UInt32`, `UInt64`, `Int64`, `Nat`,
`Int`, and `USize` use `BigInteger` on that 32-bit host. `ISize` uses a signed
32-bit PHP integer. The graph API keeps the same 128-level and 262,144-visit
limits, with separate 16 MiB PHP, Zend and native-copy accounting budgets.

The [installed PHP-Wasm record](evidence/php-wasm-recursive-packages-20260924.md)
covers direct and bundled npm descriptors, Composer applications, Node and
Chromium. [Independent rebuilds and shared-package checks](evidence/php-wasm-recursive-loading-20260924.md)
reproduce the archives and verify one runtime across recursive and acyclic
packages, including duplicate descriptors, conflicting builds, failed lazy
loads and permanent retirement. [Compatibility checks](evidence/php-wasm-shared-regressions-20260924.md)
also run the original verifier and packager against fresh nonrecursive builds.
Native-backend regression closure and final cross-language acceptance remain open.

### Lean Lists

Native Composer and PHP-Wasm packages accept `List T` as consecutive-key PHP arrays and
return independently copied arrays. Generated PHPDoc uses `list<T>`. Empty
Lists, order, duplicates and nesting are preserved, including List fields in
records and combinations with arrays, options, results and products.

For the native List acceptance package:

```php
use function LeanLists\{reverse_uint32, mix};

$reversed = reverse_uint32([1, 2, 1, 3]); // [3, 1, 2, 1]
$nested = mix([[1, 2], [], [3]]);        // [[3], [], [2, 1]]
```

`List` and `Array` retain distinct Lean and native types even though PHP uses
arrays for both. Weak and strict callers get the same type and copy-budget
checks. Associative arrays, sparse arrays, iterator objects and invalid elements
are rejected. Changing a result cannot change inputs or sibling results.
The existing 32-level type and 16 MiB conversion limits apply.

PHP-Wasm applies its 32-bit mappings inside Lists: `List UInt32` and `List Int64`
contain `Brick\Math\BigInteger` values. These mappings differ from native PHP;
do not pass PHP integers in their place.

[Native List checks](evidence/php-native-lists-20260921.md) and
[PHP-Wasm List checks](evidence/php-wasm-lists-20260921.md) cover ordinary source
and reviewed contracts. PHP-Wasm runs in Node and Chromium with startup or
first-call loading. Native and PHP-Wasm packages also accept Lists in callbacks
and returned functions.
The [native FFI follow-up](evidence/php-native-lists-ffi-20260921.md) records
the PHP 8.5 deprecation fix and repeated installed checks.

### Named copied aliases

Native Composer and PHP-Wasm packages preserve Lean alias names, original targets
and chains in installed metadata and API documentation. Callers pass ordinary
PHP target values. Aliases do not create wrapper classes. Native packages use
`binding-manifest.json`; PHP-Wasm packages also include a shared
`lean-bridge/aliases.json` catalog in their npm and Composer archives.

For a package exporting `Scores.Count := UInt32` and
`Scores.Counts := List Count`, save this as `aliases.php`:

```php
<?php
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use function LeanScores\{increment, reverse};

echo increment(41), PHP_EOL;          // 42
print_r(reverse([1, 2, 1, 3]));       // [3, 1, 2, 1]
```

For native PHP, run `php aliases.php`. Generated PHPDoc records the target types, such as `int`
and `list<int>`. The `@lean-bridge-param`, `@lean-bridge-return` and
`@lean-bridge-contract` annotations retain the original Lean names at API sites
and record fields. Alias chains remain in the manifest, including aliases used
only in return types.

In PHP-Wasm, `Count` uses `Brick\Math\BigInteger` because UInt32 does not fit
the host's signed 32-bit integer. Inside the PHP code loaded by your
[installed descriptor](#ordinary-php-wasm-packages), call:

```php
use Brick\Math\BigInteger;
use function LeanScores\{increment, reverse};

echo increment(BigInteger::of(41));                 // 42
$counts = array_map(BigInteger::of(...), [1, 2, 1, 3]);
$reversed = reverse($counts);                      // BigInteger values: 3, 1, 2, 1
```

The catalog is available beside the mounted package's `src` directory with
either embedded declarations or Composer. Startup and first-call loading use
the same declarations and target checks.

Weak and strict callers receive the same checks: Nat requires a nonnegative
`BigInteger`, integer ranges remain enforced, Unit uses `null` and Char requires
one Unicode scalar. Copied containers retain their target's ownership and
conversion limits. The [native PHP](evidence/php-native-aliases-20260921.md) and
[PHP-Wasm alias checks](evidence/php-wasm-aliases-20260921.md) cover both source
paths and caller modes. Native and PHP-Wasm callbacks accept concrete copied
aliases through their resolved target type.

### Resource-containing values

Native Composer and PHP-Wasm packages can expose resources inside records,
variants, arrays, Lists, options, results, products and finite recursive values.
Install a native publisher's ZIP with the [same Composer setup](#ordinary-project-packages).
For the [author example](publish/php.md#export-resource-containing-values), require
`example/owned-values` version `1.0.0` and save this as `owned.php`:

```php
<?php
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use Brick\Math\BigInteger;
use LeanOwnedAggregates\{Bundle, Bytes, Payload};
use function LeanOwnedAggregates\{callback_record, new_ticket, serial};

$ticket = new_ticket(BigInteger::of(42), 'order');
$result = null;
$retained = null;
try {
    $bundle = new Bundle($ticket, null, [], [],
        new Payload(BigInteger::of(7), Bytes::fromString('payload')));
    $result = callback_record($bundle, static function(Bundle $borrowed) use (&$retained): Bundle {
        $retained = $borrowed->primary->retain();
        return $borrowed;
    });
    echo serial($result->primary), PHP_EOL;
    $result->primary->close();
    echo serial($retained), PHP_EOL;
} finally {
    $result?->primary->close();
    $retained?->close();
    $ticket->close();
}
```

Run `php owned.php`. It prints `42` twice. Composer autoloading supplies the API
and loads the bundled native libraries on the first valid call.

Each returned resource wrapper owns a checked lease. `retain()` creates an
independently closable wrapper; assigning a wrapper to another PHP variable does
not. `close()` is idempotent, and calls through a closed wrapper fail. Close the
resources contained in a result, including array elements and optional fields.
Destruction and request shutdown provide fallback cleanup. Resource wrappers
cannot be constructed, cloned or serialized by application code.

Callback resources and Lean closures are borrowed for that callback invocation.
Call `retain()` inside the callback to keep one afterward, as above. A borrowed
PHP callback still expires with its enclosing call. Returned Lean closures are
invokable and support the same `retain()` and `close()` operations. PHP
exceptions return as the original `Throwable` after native cleanup. Callbacks
without a type-safe automatic recovery value require
`with_recovery($callback, $fallback)`, using a valid result of the declared type.

The [native PHP callback-result acceptance](evidence/owned-php-callback-results-20261003.md)
covers ordinary and reviewed packages in no-host, host, and combined modes. Two
independent builds per mode produce matching Composer handoffs. Offline,
source-free consumers run 24 relocated weak and strict calls with 3,344 public
assertions, plus 180 cold and warm asset-tamper cases. The receipt records
result-slot, state, and broker-identity cleanup. It does not claim a native
allocation ledger, sanitizer coverage, retained host callbacks, or asynchronous
delivery.

Records remain readonly, arrays and Lists use consecutive-key PHP arrays,
`Option` uses `null` or `Some`, and `Except` uses `Ok` or `Err`. Aliases keep
their underlying PHP values. The existing nineteen primitive mappings apply.
Validation rejects cycles, foreign resource classes and invalid fields before
native entry. Conversions allow 128 value levels, 262,144 visits and separate
16 MiB storage budgets; exact integers allow up to 16,384 decimal digits.

Native packages require the main NTS CLI execution context. Calls from Fibers
and inherited post-fork processes reject. PHP-Wasm packages use the main PHP
execution context in Node or Chromium. Compatible owned and copied packages
share their bundled runtime automatically.

For PHP-Wasm, install the publisher's npm component and runtime archives using
the [descriptor setup](#ordinary-php-wasm-packages). The companion Composer ZIP
is optional. Run the same PHP operations inside that interpreter, using its
descriptor's autoloader or your mounted Composer autoloader. No FFI extension,
GMP extension or native-library paths are needed. The target's 32-bit integer
mappings apply inside records and callbacks as well as at top level.

Load any lazy peer package before a callback first calls it, or register its
startup descriptor. First-use loading inside a synchronous Lean callback throws
before downloading an extension; the peer remains usable from a normal call.
After `php.refresh()`, require the autoloader again and initialize lazy peers
outside callbacks. Do not reuse resource wrappers from an earlier request.
Native and PHP-Wasm packages also support
[owner-anchored results](#owner-anchored-results). Asynchronous callbacks remain
unsupported in both transports.

### Consuming inputs

Native PHP and PHP-Wasm packages can expose functions that consume
resource-containing arguments. The generated function documentation names those
arguments. Pass the same PHP values you use for borrowed arguments; no transfer
wrapper is needed for packages without owner-anchored results. In
packages with that result contract, consuming inputs use the
[whole-value owners](#owner-anchored-results) described below.

With the [consuming author configuration](publish/php.md#export-consuming-inputs),
save this as `consume.php`:

```php
<?php
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use Brick\Math\BigInteger;
use LeanOwnedAggregates\{Bundle, Bytes, LeanBridgeError, Payload};
use function LeanOwnedAggregates\{callback_record, new_ticket, serial};

$ticket = new_ticket(BigInteger::of(42), 'order');
$alias = $ticket;
$kept = $ticket->retain();
$result = null;
try {
    $bundle = new Bundle($ticket, null, [], [],
        new Payload(BigInteger::of(7), Bytes::fromString('payload')));
    $result = callback_record($bundle, static fn(Bundle $value): Bundle => $value);
    echo serial($result->primary), PHP_EOL;
    echo serial($kept), PHP_EOL;
    try {
        serial($alias);
    } catch (LeanBridgeError $error) {
        if ($error->getCode() !== 4) throw $error;
        echo 'closed', PHP_EOL;
    }
} finally {
    $result?->primary->close();
    $kept->close();
    $ticket->close();
}
```

Run `php consume.php` for a native package. For PHP-Wasm, mount the Composer
`vendor` directory and run the same file inside the interpreter, or replace the
Composer `require` with the descriptor's autoloader. It prints `42`, `42`, then
`closed`. The Lean call consumes `$ticket` and its alias; the independent
`retain()` result stays open.

Validation and snapshot failures before the Lean call preserve the inputs.
Once Lean receives them, their shared result owners close even if a callback
throws or result conversion fails. This also closes sibling fields that share
an owner. Two consuming parameters cannot share one owner. Resources borrowed
inside a callback cannot be consumed; call `retain()` first. Records and arrays
remain PHP values, but their consumed resource fields are no longer usable.

### Owner-anchored results

A publisher can tie a function's result to an input's lifetime in native PHP or
PHP-Wasm. In those
packages, resource-containing results return a `Value`, including empty arrays,
empty Lists and `None`. Use `get()` to access the PHP payload. Anchored and
consuming parameters take the whole `Value`; ordinary borrowed parameters take
its payload.

With the [anchored author configuration](publish/php.md#anchor-a-result-to-an-input),
save this as `borrowed.php` beside your installed `vendor` directory:

```php
<?php
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use Brick\Math\BigInteger;
use LeanOwnedAggregates\{Bundle, Bytes, LeanBridgeError, Payload};
use function LeanOwnedAggregates\{callback_record, copy_value, new_ticket, serial};

$ticket = new_ticket(BigInteger::of(42), 'order');
$owner = $view = $kept = null;
try {
    $owner = copy_value(new Bundle($ticket->get(), null, [], [],
        new Payload(BigInteger::of(7), Bytes::fromString('payload'))));
    $view = callback_record($owner, static fn(Bundle $value): Bundle => $value);
    $kept = $view->retain();
    echo serial($view->get()->primary), PHP_EOL;
    $owner->close();
    try {
        $view->get();
    } catch (LeanBridgeError $error) {
        if ($error->getCode() !== 4) throw $error;
        echo 'expired', PHP_EOL;
    }
    echo serial($kept->get()->primary), PHP_EOL;
} finally {
    $view?->close();
    $kept?->close();
    $owner?->close();
    $ticket->close();
}
```

Run `php borrowed.php`. It prints `42`, `expired`, then `42`. The retained result
owns an independent lifetime. Composer handles loading and dependencies.
For PHP-Wasm, mount the same file beside the installed Composer `vendor`
directory and run it with the [prepared npm descriptor](#ordinary-php-wasm-packages).
The descriptor handles the shared runtime and extension; no FFI setup is needed.

`share()` creates another root for the same owner. Closing or destroying the
last root expires its borrowed descendants. A saved resource from `get()` does
not keep that root open. `close()` is idempotent; `closed()` reports expiration.
Call `retain()` on a whole value or a resource leaf to keep an independent owner.
`equals()` compares structured values using native resource identity, and equal
values have equal `hashCode()` results. Expired values reject both operations.
Resource `sameIdentity()` compares the underlying Lean identity, not PHP object
identity or resource fields.

`copy_value($payload)` infers nominal record, variant and resource types. For
containers, select a declared function result with
`copy_value([], resultOf: 'echo_array')`, or a parameter with
`copy_value([], parameterOf: ['bundle', 2])`. A parameter selector also accepts
the declared parameter name. These names come from the installed API; no native
type identifiers are needed.

Consuming calls invalidate the original whole owner and every borrowed
descendant at the native handoff. Independent retained values survive. Validation
failures before handoff preserve the owner; callback or conversion failures
afterward do not restore it. A borrowed result must be retained before passing
it to a consuming parameter. Callback-result-anchored lifetimes use the
callable's authenticated argument and result owners.

### Callback-result lifetimes

A callback result may borrow resources from one of that callback's arguments.
The publisher names the anchor in the contract; the generated closure enforces
it. Create the whole argument with `copyArg()`, invoke the closure with that
whole value, and keep or close the returned view like any other `Value`:

```php
<?php
declare(strict_types=1);

use LeanOwnedAggregates\Bundle;

/** @var LeanOwnedAggregates\Value $factory */
/** @var Bundle $payload */
$closure = $factory->get();
$argument = $closure->copyArg(0, $payload);
$view = $closure($argument);
$kept = $view->retain();

$argument->close();
assert($view->closed());
assert(!$kept->closed());

$view->close();
$kept->close();
$factory->close();
```

`copyArg($index, $payload)` accepts only a public callback argument index and
the value declared at that position. `copyResult($payload)` creates the matching
whole result owner. Both methods belong to the installed generated API; callers
do not pass internal type identifiers. Closing their source closure prevents
new copies but does not close an already independent copy.

A PHP callback may return either an ordinary generated payload or a compatible
whole `Value`. The bridge pins a whole reply until Lean has accepted it, so a
temporary return value cannot disappear during handoff. A borrowed value saved
from the callback argument still expires when the callback returns. Call
`retain()` inside the callback when that resource must escape.

Packages built with `targets.php-wasm.hostCallbacks: false` reject PHP
callables and omit `with_recovery()`. They still accept returned Lean closures
and expose `copyArg()` and `copyResult()`. PHP-Wasm executes the same ownership
rules in Node and Chromium with startup or lazy loading. The
[installed acceptance record](evidence/owned-php-wasm-callback-results-20261003.json)
covers ordinary-source and reviewed-IR packages in no-host, host, and combined
ownership modes.

### Methods and properties

Native PHP and PHP-Wasm packages can expose methods and read-only properties on generated
owner classes. For the [author example](publish/php.md#export-methods-and-properties),
install `example/owned-values` and save this as `members.php`:

```php
<?php
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use Brick\Math\BigInteger;
use LeanOwnedAggregates\{Bundle, Bytes, Payload, LeanBridgeError};
use function LeanOwnedAggregates\{new_ticket, copy_value};

$ticket = new_ticket(BigInteger::of(42), 'order');
$owner = $view = $kept = null;
try {
    echo $ticket->serial, PHP_EOL;
    $owner = copy_value(new Bundle($ticket->get(), null, [], [],
        new Payload(BigInteger::of(7), Bytes::fromString('payload'))));
    $view = $owner->callbackRecord(static fn(Bundle $value): Bundle => $value);
    $kept = $view->retain();

    $owner->close();
    try {
        $view->get();
    } catch (LeanBridgeError $error) {
        if ($error->getCode() !== 4) throw $error;
        echo 'expired', PHP_EOL;
    }
    echo $kept->get()->primary->serial, PHP_EOL;
} finally {
    $kept?->close();
    $view?->close();
    $owner?->close();
    $ticket->close();
}
```

Run `php members.php`. It prints `42`, `expired`, then `42`. `$ticket` is a
`TicketValue`; `$owner`, `$view`, and `$kept` are `BundleValue` owners. `get()`
returns the PHP payload. Closing the original owner expires its borrowed
results, while an independent `retain()` remains usable.

Properties cannot be assigned or unset. Methods use camelCase names; the
snake_case public functions remain available. `share()`, `retain()`, and
`copy_value()` preserve the nominal class. A consuming method closes every
alias of the original owner at handoff. Invalid arguments rejected before
handoff leave that owner open.

`equals()` compares structured payloads using native identity for resources.
Independent retained wrappers for the same resource compare equal and produce
the same `hashCode()`. Separate resources with identical fields remain distinct.
Comparing a closed owner raises an exception.

In PHP-Wasm, run the same file inside your PHP instance with the installed
Composer `vendor/` directory mounted beside it. Use the npm package's
`extensions` descriptor for startup loading, or `lazy.extensions` for first-call
loading, as shown in [Ordinary PHP-Wasm packages](#ordinary-php-wasm-packages).
Both transports preserve the same receiver and argument lifetimes.

### Native callbacks and returned functions

Native Composer packages support synchronous callbacks and returned Lean functions across all 19 primitive types, from ordinary source or a compiler-checked reviewed contract. Pass a PHP callable directly. For the Clover package:

```php
echo LeanClover\call_word(40, fn($value) => $value + 1); // applies twice: 42
$add = LeanClover\make_word(2);
try {
    echo $add(40);                                  // 42
    echo LeanClover\call_word(40, $add);             // 44
} finally {
    $add->close();
}
```

The returned `LeanClosure` is invokable with exactly its declared positional arguments. `close()` is idempotent; `isClosed()` reports closure. Saved callable aliases share its lifetime and reject calls after closing. Destruction releases abandoned closures, but `finally` gives deterministic cleanup. You cannot construct, clone or serialize a Lean closure.

Callbacks accept one to sixteen arguments with primitive, acyclic copied or [finite recursive payloads](#recursive-callback-values). Their PHPDoc states the signature, and the bridge validates inputs and results in weak and strict callers. `Nat`, `Int`, `UInt64` and native `USize` remain `Brick\Math\BigInteger`. Unit uses `null`, including a callback with a `void` return. Callback arguments are independent copies. The callback itself is borrowed for one synchronous call; Lean cannot invoke it afterward. Exceptions return as the same `Throwable`, preserving its trace and previous exception. Later callbacks in a failed call do not run.

Reference parameters, reference returns and generators reject. Creation and invocation require the main NTS CLI execution context; calls from a Fiber reject. A Fiber can close a closure. Close defers native release until an active call returns. Start a fresh process after fork. Each native adapter permits 64 nested calls per thread, and the shared runtime permits 4,096 closure identities. Existing conversion limits still apply. [Resource-containing callbacks](#resource-containing-values) use the explicit ownership profile; asynchronous functions remain unsupported. See the [installed native PHP callable checks](evidence/php-callables-20260919.md).

### Structured callback values

Native Composer and PHP-Wasm packages accept arrays, Lists, options, results, products,
acyclic records, variants and concrete copied aliases in callbacks and returned
functions. They use the same PHP values as ordinary arguments and results.

For the structured acceptance package, save this as `structured.php` beside
the installed `vendor` directory:

```php
<?php
require __DIR__ . '/vendor/autoload.php';

use LeanStructured\Some;
use function LeanStructured\{call_array, make_option};

$result = call_array([new Some('source'), null],
    fn($rows) => [new Some('copied'), $rows[1]]);
echo $result[0]->value, PHP_EOL;

$choose = make_option(new Some(null));
try {
    $captured = $choose(true, null);
    if (!$captured instanceof Some || $captured->value !== null
        || $choose(false, null) !== null) {
        throw new RuntimeException('Option presence changed');
    }
    echo 'Some None', PHP_EOL;
} finally {
    $choose->close();
}
```

Run `php structured.php`. It prints `copied` and `Some None`. The closure keeps
its captured copy; later changes to the original array do not change it.
Callback inputs and replies also have independent storage. Original PHP
exceptions survive native cleanup, and a failed call does not prevent the next
valid call. Separate validation, PHP conversion and native-copy budgets each
account for at most 16 MiB; the PHP budgets include callback replies for the
enclosing call. These are conversion limits, not total process-memory limits.

The [native checks](evidence/php-structured-callables-20260925.md) and
[PHP-Wasm checks](evidence/php-wasm-structured-callables-20260925.md) exercise
weak and strict callers on both source paths. PHP-Wasm uses the same example
inside its host after loading the package's autoloader. Native packages also
support the recursive callback values below, as do PHP-Wasm packages.
Resource-containing payloads remain separate work.

### Recursive callback values

Native Composer and PHP-Wasm packages accept finite recursive records and variants in
callbacks and returned functions. Use the same generated classes as ordinary
copied arguments. For the [publisher example](publish/php.md#export-recursive-callbacks),
save this as `recursive-callbacks.php` beside `vendor`:

```php
<?php
require __DIR__ . '/vendor/autoload.php';

use Brick\Math\BigInteger;
use LeanStructured\{Tree, TreeLeaf, TreeBranch};
use function LeanStructured\{call_recursive, make_recursive};

function raiseLeaves(Tree $tree): Tree {
    if ($tree instanceof TreeLeaf) {
        return new TreeLeaf($tree->value->plus(22));
    }
    return new TreeBranch(array_map(raiseLeaves(...), $tree->children));
}

$original = new TreeBranch([new TreeLeaf(BigInteger::of(20))]);
$updated = call_recursive($original, raiseLeaves(...));
echo $updated->children[0]->value, PHP_EOL;

$choose = make_recursive($original);
try {
    echo $choose(true, $updated)->children[0]->value, PHP_EOL;
    echo $choose(false, $updated)->children[0]->value, PHP_EOL;
} finally {
    $choose->close();
}
```

Run `php recursive-callbacks.php`. It prints `42`, `20` and `42` on separate
lines. The callback receives an independent tree. The returned function owns
its captured copy until you close it or PHP destroys it.

For PHP-Wasm, run the same file inside the [Node or browser host](#ordinary-php-wasm-packages)
with the companion Composer package installed. The npm-only descriptor also
loads the same public API; omit the Composer `require` when using that descriptor.
Use the [32-bit PHP mappings](#type-conversions) throughout the tree, including
`BigInteger` for `UInt32`, `UInt64`, `Int64`, `Nat`, `Int` and `USize`.

Recursive conversion allows at most 128 levels and 262,144 visited values, with
separate 16 MiB host and native accounting budgets. Replies share the enclosing
call's PHP storage budget and stay alive until Lean finishes copying them.
Cyclic PHP objects and arrays reject before native loading. A malformed native
result retires the shared runtime; existing closures can still close, and already
copied PHP values remain usable. The [closure lifetime rules](#native-callbacks-and-returned-functions)
apply here too. The [installed native callback checks](evidence/php-recursive-callables-20260926.md)
cover both source paths and weak and strict callers. The
[installed PHP-Wasm checks](evidence/php-wasm-recursive-callables-20260926.md)
cover Node, Composer autoloading and Chromium with startup and lazy loading.
PHP-Wasm uses a private
Zend resource for each owned function, so its 64-bit identity never passes
through a 32-bit PHP integer. Its borrowed callback identities expire with the
call and cannot be reused after exhaustion.

For native PHP and PHP-Wasm, a synchronous host callback returning a selected
`Subtype` or checked record must be wrapped with the generated namespace's
`with_recovery($callback, $value)` function. A checked-record recovery is the
generated proof-free readonly value object. The package validates the callable
and the recovery's exact result shape before application execution. Lean uses
that recovery only to finish a call whose actual callback reply fails the
selected constructor; it is not successful output. Returned `LeanClosure`
objects validate selected `Subtype` and checked-record arguments before invoking
Lean and remain usable after rejection.

The [native PHP workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/callback-checked-record-remaining.yml)
builds ordinary-source and independently reviewed Composer packages, removes
the author source, installs offline, and runs the same 30 checks through weak
and strict PHP callers before and after relocation. The
[PHP-Wasm callback Subtype qualification](evidence/callback-subtype-php-wasm-local-qualification-20261022.md)
reproduces Composer API, npm component and npm shared-runtime archives from two
author roots, removes the source, installs offline, relocates the installation,
and passes 28 checks in each of eight Node and four Chromium startup/lazy,
weak/strict contexts per route. The
[recurring PHP-Wasm workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/callback-subtype-php-wasm.yml)
retains the hosted handoffs. General copied checked-record callbacks in
PHP-Wasm remain covered separately from this selected `Subtype` boundary.

### Refinement support and entry measurements

The support statements on this page come from unmodified prepared packages.
Those packages contain the generated checks that enforce `Fin`, `Subtype` and
checked-record contracts, but they do not contain diagnostic entry counters.

Entry measurements use separate instrumented fixture packages. The 24 copied,
owned and indexed routes count named validator, constructor, adapter and
Lean-source entries; the four callback routes record callback control totals.
Together they form 28 ordinary/reviewed routes in 26 retained artifacts. These
measurements do not change a consumer package or widen its supported types. The [promotion
workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/php-wasm-refinement-entry-promotion.yml)
is configured to rebuild the complete matrix at one revision and recheck the
retained artifacts. Until a completed run publishes that verified summary, the
documentation makes no hosted entry-count claim.

### Bounded integers

In native PHP packages, a Lean `Fin n` parameter or result is a `Brick\Math\BigInteger`, the same as `Nat`. For `Library.mirror (value : Fin 10) : Fin 10`, `mirror(BigInteger::of(3))` returns 6. `mirror(BigInteger::of(10))` throws `LeanBridgeError` with code 1 and the message `arg0 is not below its Fin 10 bound`. A negative value throws `ValueError` and a non-BigInteger argument throws `TypeError`, as they do for `Nat`. The package checks the bound before it calls Lean, so caller data is unchanged and a later valid call still works. `Fin 0` parameters reject every value, and bounds wider than 64 bits are compared exactly. PHPDoc on each function and the package README state the bound. Top-level parameters and results are supported, including inside `Array`, `List` and `Option` (for example `Array (Fin 10)` or `Option (List (Fin 10))`): every element is checked before Lean is called, an empty array or `none` is valid even for `Fin 0`, and a rejection names the parameter and the bound of the element that failed. See the [installed scalar checks](evidence/native-fin-hosts-20261006.md) and the [container checks](evidence/native-fin-containers-20261006.md). Both ordinary-source and independently reviewed native PHP packages also check Fin inside pairs, active `Except` branches and plain record or variant fields, including Array/List/Option compositions. The [hosted product and field checks](evidence/fin-native-hosted-20261010/receipt.json) exercise those shapes through installed Composer packages. These reports do not add PHP-Wasm or Fin callback coverage.

The separate [scalar entry-counter receipt](evidence/php-fin-dispatch-20261008/receipt.json) records ordinary-source and reviewed-IR native PHP Composer packages after source removal, offline installation and relocation. Rejected `mirror`, `impossible` and `label` calls entered neither the Lean source nor its C adapter. Valid calls, including those after rejected ones, entered their own source and adapter once. Both consumers passed 2,028 checks on PHP 8.2.33 with FFI on x86-64 Linux and a glibc 2.36 package floor. An `LD_PRELOAD` interposer counted the entries without changing the installed package. It covers these top-level scalar calls, not nested refinements, PHP-Wasm or other platforms.

### Bounded integers in PHP-Wasm

PHP-Wasm plain copied packages preserve `Fin` bounds in scalar parameters and
results, `Array`, `List`, `Option`, pairs, active `Except` branches and copied
record/variant fields. Use `Brick\Math\BigInteger`, including for bounds wider
than 64 bits. Empty arrays and lists of `Fin 0`, and `none` for `Option (Fin 0)`,
are valid; a present `Fin 0` value is rejected. Both weak and strict callers
retain their input values and can call the package again after a rejection.

The [direct-value checks](evidence/php-wasm-fin-direct-20261010/index.json)
execute seven scalar exports with 2,028 checks and twelve container exports with
14,089 checks per execution. Ordinary-source and independently reviewed packages
each run in twelve Node/Chromium configurations. These separate runs use
Node 22.23.2, Chromium 152.0.7977.75, PHP 8.4.1 and php-wasm 0.1.0. They cover
direct and nested containers, `Fin 0`, bounds wider than 64 bits, invalid
element positions, unchanged inputs and repeated rejection/recovery. Six
fresh-Lean checks reject altered or omitted review bounds before producing a package.

The [ordinary](evidence/php-wasm-fin-20261008/receipt.json) and
[reviewed](evidence/reviewed-php-wasm-fin-20261008/receipt.json) package tests
each execute 11 product exports and 13 record/variant exports. Every fixture
runs in eight Node configurations (embedded or Composer, startup or lazy,
weak or strict) and four Chromium bundled configurations. These runs use
Node 22.23.3, Chromium 154.0.8037.57, PHP 8.4.1 and php-wasm 0.1.0.
Those earlier fixtures do not execute bare top-level `Fin` or direct
`Array (Fin n)`, `List (Fin n)` or `Option (Fin n)` exports.
Source-dispatch counters were not measured in these unmodified package runs.
The separate instrumented matrix described above measures named fixture entries
without changing the consumer packages. Refined callbacks and refinements
combined with graph or owned transports remain unsupported.

### Checked records in native PHP

Prepared packages expose checked Lean records as generated records containing
only runtime payload fields. Pass those fields without proofs. Lean runs the
constructor selected for each parameter; it can reject or normalize the input.
A rejected call leaves your record unchanged and names the parameter and
constructor. Results contain copied payloads with proofs erased.

The [installed checked-record tests](evidence/checked-record-native-promotion-20261011.md)
cover ordinary-source and independently reviewed packages, including packages
that only return checked records. They test `Interval`, `Sized 3` and
`Bounded 0 101`.

The [closed value-index archive](evidence/checked-record-value-index-php-promotion-20261019.md)
adds top-level copied records indexed by closed `Bool`, `String`, and `Nat`
values on the same native-PHP path. `Brick\Math\BigInteger` carries Nat payload
fields; the index remains authenticated Lean metadata rather than a PHP field.

The [nested checked-record archive](evidence/nested-checked-record-php-20261016/index.json)
adds the acyclic `Packet`, `Holder` and `ChoicePacket` forms. The nested `Packet`
contains a `Fin 10` digit and a checked `Nat` word, both represented by
`Brick\Math\BigInteger`. Installed packages check direct and repeated inputs,
arrays, lists, options, products, both `Except` branches, `Holder::packet`, and
the active `ChoicePacket::value` field. Constructor-free results return arrays
and options of `Packet` without proof fields or input-constructor metadata.

Both source routes and both API modes reproduce complete Composer ZIPs from two
author roots. After author and build removal, offline installations run unchanged
weak and strict callers before and after relocation, for four executions per
selection. The retained local runs use PHP 8.2.33 and Composer 2.5.5 on Linux
x64/glibc 2.36. Invalid nested fields preserve the complete PHP object graph,
and a later valid call succeeds. [Inherited checked-record acceptance](evidence/inherited-checked-record-promotion-20261018.md)
separately covers the tested proof-free `Span → Ticket → Stamped` chain. Generic
or recursive checked records, value-carrying receiver-dependent inherited fields,
other index kinds, open dependent or zero-payload records, callbacks and owned
positions remain separate work. Consumer PHP source remains required at runtime.
These results apply to native PHP, not PHP-Wasm.
The [native PHP recurring workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/nested-checked-record-php.yml)
rebuilds all four selections on Ubuntu 24.04.

### Checked records in PHP-Wasm

PHP-Wasm packages expose the same payload-only generated records. Use
`Brick\Math\BigInteger` for every `Nat` field, including small values. `Interval`
has `lo` and `hi`; `Triple`, the alias for `Sized 3`, has a consecutive-key
`data` array of `BigInteger` values; `Percent`, the alias for `Bounded 0 101`,
has `value`. Do not supply proof fields.

Lean runs the constructor selected for each parameter. It may normalize the
payload or throw `LeanBridgeError` with code 1 naming the parameter and
constructor. Both weak and strict callers retain their original records and can
make another valid call after rejection. Results contain copied payload fields.

The [installed PHP-Wasm checks](evidence/checked-record-php-wasm-promotion-20261011.md)
cover ordinary and independently reviewed packages, including standalone
result-only packages. Each route runs in twelve Node/Chromium configurations on
32-bit PHP 8.4.1: embedded or Composer installation, startup or lazy loading,
and weak or strict callers. The checks reproduce two author builds, remove
author sources before offline installation, then move the installation and
replay unchanged callers. Wide results remain exact, including `2^80 + 1`
and `2^100`.

The [closed value-index archive](evidence/checked-record-value-index-php-wasm-promotion-20261020.md)
adds top-level copied records indexed by closed `Bool`, `String`, and `Nat`
values. The indices remain authenticated Lean metadata rather than PHP fields;
`Brick\Math\BigInteger` carries Nat payload fields on wasm32. Full packages
check parameters and results, while standalone result-only packages expose
only proof-free results.

The [nested checked-record archive](evidence/nested-checked-record-php-wasm-20261016/index.json)
adds the acyclic `Packet`, `Holder` and `ChoicePacket` forms. The nested `Packet`
contains a `Fin 10` digit and checked `Nat` word represented by
`Brick\Math\BigInteger`. Installed packages check direct and repeated inputs,
arrays, lists, options, products, both `Except` branches, `Holder::packet`, and
the active `ChoicePacket::value` field. Constructor-free results return arrays
and options of `Packet` without proof fields or input-constructor metadata.

All four ordinary/reviewed and full/result-only selections reproduce complete
Composer API, npm component and npm shared-runtime archives from two author
roots. After author and build removal, offline installations are physically
relocated before unchanged weak and strict callers run in eight Node and four
Chromium startup/lazy contexts, for twelve executions per selection. The runs
use wasm32 PHP 8.4.1, Node 22.23.2 and Chromium 152.0.7977.75. Invalid nested
fields preserve the complete caller graph, and a later valid call succeeds.
Consumer PHP source remains required at runtime. [Inherited checked-record
acceptance](evidence/inherited-checked-record-promotion-20261018.md) separately
covers the tested proof-free `Span → Ticket → Stamped` chain. Generic or recursive
checked records, value-carrying receiver-dependent inherited fields, other index
kinds, open dependent or zero-payload records, callbacks and owned positions
remain separate work. These runs do not establish other PHP or browser versions.
The [PHP-Wasm recurring workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/nested-checked-record-php-wasm.yml)
rebuilds all four Node/Chromium selections on Ubuntu 24.04.

### Checked values

Reviewed native PHP packages support top-level primitive-base `Subtype`
parameters and results. The [reviewed native checks](evidence/reviewed-subtype-native-promotion-20261010.md)
ran twelve exports with 2,024 checks in weak and strict PHP callers, including
constructor selection, normalization, rejection recovery and replay after moving
the installed package. Errors use the reviewed parameter names. These runs did
not measure dispatch counts or establish nested and callback Subtypes.

In native PHP packages, a Lean `Subtype` parameter or result over a primitive base uses the base's usual type. The package runs the author's checked constructor from the export contract before the exported function; a rejected value throws `LeanBridgeError` with code 1 and a message naming the parameter and constructor (`arg0 was rejected by Library.checkedWord`), and caller data stays unchanged. The exported function receives the constructed value, which a normalizing constructor may change. The package README names each constructor. These earlier checks cover top-level parameters and results; see the [installed checks](evidence/native-subtype-20261007.md).

Plain copied PHP-Wasm packages support top-level `Subtype` parameters and results
over primitive bases on ordinary and reviewed routes. Use `Brick\\Math\\BigInteger`
for `Nat` and `Int`, strings for `String`, `Bytes` for `ByteArray`, and integers
for `UInt8`. Lean checks the selected constructor and passes its constructed
value to the export, including any normalization. Rejection throws
`LeanBridgeError` with code 1 naming the parameter and constructor. Results use
the base representation.

The [installed PHP-Wasm Subtype checks](evidence/php-wasm-subtype-installed-20261010.md)
run twelve exports in twelve Node/Chromium configurations per source route, with
2,024 checks in each execution. They cover weak/strict PHP, embedded/Composer
Node loading, bundled Chromium loading, startup/lazy loading, rejection recovery,
input preservation and two constructor choices for one generic function. These
local runs use Node 22.23.2, Chromium 152.0.7977.75 and PHP 8.4.1 on wasm32.
Constructor and dispatch counts were not measured in these unmodified package
runs. The separate instrumented matrix described above measures named fixture
entries without changing the consumer packages. The later structural checks
below add containers. Refined callback and owned transports remain rejected.

PHP-Wasm copied-graph packages also accept selected `Subtype` constructors and
`Fin` bounds inside finite recursive records and variants. The adapter validates
all `Fin` leaves before running any selected constructor. It checks only the
active variant case and every present occurrence in arrays and options. A
rejection names the actual path, such as
`arg0[1]?.node.tail.node.value`, preserves the caller's graph and leaves the
runtime available for another call. Recursive results project the base values
without asking the caller for a constructor.

The [recursive installed checks](evidence/recursive-subtype-php-wasm-20261015.md)
compile ordinary and independently reviewed Lean, reproduce the npm component,
npm shared runtime and Composer API, remove the author roots, install offline,
relocate the installed trees and run startup and lazy weak/strict callers in
Node and Chromium. The fixture covers two constructor choices for one recursive
type, normalization, a late nested rejection, a shared input subgraph, inactive
branches, mixed `Fin 3`, caller preservation, recovery and a constructor-free
recursive result. Refined callbacks and owned graph values remain unsupported.

### Ordinary PHP-Wasm packages

Use `php-wasm` 0.1.0 with PHP 8.4's default variant, hosted in Node 22 or Chromium. Obtain the publisher's archives, `package-set-receipt.json`, and its `.json.sha256` sidecar through your trusted release channel. [Verify the package set](consume/receive-package.md#verify-a-local-package-set) before installation. It contains two npm archives, one component and its shared runtime, plus a companion Composer ZIP. No Lean tools, PHP headers or Emscripten installation are needed.

The npm descriptor includes Brick Math 1.0.0 and loads its classes automatically. No Composer installation or GMP/BCMath extension is required. A Composer application uses the generated package's exact `brick/math` dependency instead. Include dependencies in your application lockfile; offline Composer installs need that locked dependency in their repository or cache.

Options, results and nested products use the [same public PHP types](#options-results-and-products) as native packages. They compose with all nineteen primitives, arrays and copied records. The 32-bit integer mappings still apply inside every payload: for example, `Option UInt32` accepts `new Some(BigInteger::of('4294967295'))`. Weak-mode callers do not coerce integers, strings or branch values. Validation, Zend conversion and native copying each have a 16 MiB accounting limit; PHP array elements count at least 32 bytes. The adapter releases native output owners on conversion errors and PHP bailouts.

PHP-Wasm also accepts synchronous primitive, [structured](#structured-callback-values) and [recursive callbacks](#recursive-callback-values), and returns invokable `LeanClosure` objects with `close()` and `isClosed()`. Use the same lifetime rules as native PHP. On this 32-bit target, `UInt32`, `UInt64`, `Int64`, `Nat`, `Int` and `USize` use `Brick\Math\BigInteger`; `ISize` uses PHP `int` in -2147483648..2147483647. Callback arguments and results use those same types, including inside copied payloads. For example, a `UInt32 → UInt32` callback can be `fn(BigInteger $value) => $value->plus(1)`.

The private Zend adapter preserves callback `Throwable` identity after Lean cleanup and owns returned functions through PHP resources. It keeps nested reply storage alive until Lean finishes copying it. Closing a function releases its native state; destruction provides a fallback. Keep functions within their originating PHP instance and close them before disposing that instance. The pinned PHP-Wasm host cannot start Fibers; use the main execution context. Resource-containing payloads use the [explicit ownership profile](#resource-containing-values). Asynchronous delivery is not supported. [Primitive callable checks](evidence/php-wasm-callables-20260919.md) and [structured callable checks](evidence/php-wasm-structured-callables-20260925.md) cover both source paths and loading modes.

`exit` ends the current PHP request. Before running PHP again, call `await php.refresh()`, require the package's autoloader again and recreate PHP values and closures. A zero return code from `php.run()` after `exit` does not by itself show that another program executed.

Install the two npm `.tgz` files from your release directory along with the host:

```sh
npm install --ignore-scripts --no-audit --no-fund \
  ./releases/lean-bridge-php-wasm-copied-runtime-*.tgz \
  ./releases/example-willow-php-wasm-2.0.0-RC.1.tgz \
  php-wasm@0.1.0
```

Keep only the reviewed runtime archive in that directory. From a registry, install your publisher's exact component version and `php-wasm@0.1.0`; npm resolves the exact runtime dependency automatically.

For the Willow acceptance package, save this as `main.mjs`:

```js file=php-wasm/ordinary/main.mjs
/**
 * Execute an installed ordinary Lean API in PHP-Wasm.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { PhpNode } from 'php-wasm/PhpNode.mjs';
import api from '@example/willow-php-wasm';

const php = new PhpNode({ version: '8.4', sharedLibs: [api] });
php.addEventListener('output', event => {
  for(const part of event.detail) process.stdout.write(part);
});
php.addEventListener('error', event => {
  for(const part of event.detail) process.stderr.write(part);
});
const status = await php.run(String.raw`<?php
require_once '${api.autoload}';
use Brick\Math\BigInteger;
echo LeanWillow\echo_u32(BigInteger::of('4294967295'));
`);
assert.equal(status, 0);
```

Run `node main.mjs`. Expected output is `4294967295`. Register every component in `sharedLibs` before accessing `php.binary` or running PHP. Compatible packages share one runtime; duplicate registration does not reload an extension. Different runtime identities fail before startup.

#### Arrays and records on wasm32

PHP-Wasm uses the same consecutive-key arrays and final readonly record classes
as native PHP. `UInt32`, `UInt64`, `Int64`, `Nat`, `Int` and `USize` values use
`Brick\Math\BigInteger`, including array elements and record fields. `ISize`
uses a 32-bit PHP integer. The generated record keeps its original Lean property
names; keyword class names gain an underscore, such as `Empty_`.

After loading your package's descriptor or Composer autoloader, run a file such
as `collections.php`. This example uses the collection acceptance package:

```php
<?php
use Brick\Math\BigInteger as BigInt;
use LeanCollections as Collections;

$input = [array_map(BigInt::of(...), ['1', '2', '3']), []];
$reversed = Collections\array_reverse_uint32($input);
echo json_encode(array_map(fn($row) => array_map('strval', $row), $reversed)), PHP_EOL;
echo Collections\array_size([null, null, null]), PHP_EOL;

$pair = Collections\record_make();
echo $pair->first, PHP_EOL;
$copy = new Collections\Pair(BigInt::of(42), $pair->second);
echo $pair->equals($copy) && $pair->hashCode() === $copy->hashCode() ? 'equal' : 'different', PHP_EOL;
```

The output is `[[],["3","2","1"]]`, `3`, `42` and `equal`, each on its own line.
Returned arrays, records and byte buffers own independent copies. Use `equals`
for nested value comparison and `hashCode` for value-based lookups. PHP's `==`
and `===` retain their built-in meanings. NaNs compare equal; signed zeros differ.
Comparison and hashing enforce the same 32-level and 16 MiB limits described
under [arrays and records](#arrays-and-records).

#### Load on the first call

The same package exports a `lazy` descriptor. In `main.mjs`, replace the component import and host construction with:

```js
import { lazy as api } from '@example/willow-php-wasm';
const php = new PhpNode({ version: '8.4', dynamicLibs: [api] });
```

Keep the rest of the file unchanged. Loading the PHP declarations does not fetch Lean libraries. The first valid API call fetches the shared runtime and that component's extension. Calling another component fetches only its extension. Unused components stay unloaded; invalid inputs fail before loading.

Register the default descriptor in `sharedLibs` for startup loading, or `lazy` in `dynamicLibs` for first-call loading. Different components can choose different modes. Do not register the same component in both modes. npm handles the same runtime dependency in either case.

The pinned PHP host supports asynchronous library downloads through `dl()`. Keep `enable_dl=1`, its default, and await each `php.run()` before starting another. A failed extension load raises the package's `LeanBridgeError`; create a new PHP instance before trying again. The loader does not retry a partially linked library.

A synchronous Lean callback cannot perform a package's first extension load.
Use that package's startup descriptor or make its first call before entering the
callback. This rejection happens before linking and does not require replacing
the PHP instance. Repeat the initialization after `php.refresh()` when using a
lazy descriptor.

#### Run in a browser

Use the same installed component with `PhpWeb`. This example selects first-call loading. For a new Vite application, install the tested Vite version and copy the pinned PHP host into its public directory:

```sh
npm install --save-dev --save-exact vite@8.2.1
mkdir public
cp -R node_modules/php-wasm public/php-host
```

Serve `public/php-host/` at `/php-host/`, even when the application lives under a nested URL. Keep the PHP package's internal directory layout intact. Save these three files in the application root.

`index.html`:

```html file=php-wasm/ordinary/index.html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" href="data:,">
    <title>Lean in PHP-Wasm</title>
  </head>
  <body>
    <output id="result" aria-live="polite"></output>
    <script type="module" src="./browser.mjs"></script>
  </body>
</html>
```

`browser.mjs`:

```js file=php-wasm/ordinary/browser.mjs
/**
 * Execute an installed ordinary Lean API in browser-hosted PHP.
 *
 * @file
 */
import { PhpWeb } from '/php-host/PhpWeb.mjs';
import { lazy as api } from '@example/willow-php-wasm';

const output = globalThis.document.querySelector('#result');
try
{
	const php = new PhpWeb({ version: '8.4', autoTransaction: false, dynamicLibs: [api] });
	let stderr = '';
	php.addEventListener('output', event => {
		for(const part of event.detail) output.textContent += part;
	});
	php.addEventListener('error', event => {
		for(const part of event.detail) stderr += part;
	});
	const status = await php.run(String.raw`<?php
require_once '${api.autoload}';
use Brick\Math\BigInteger;
echo LeanWillow\echo_u32(BigInteger::of('4294967295'));
`);
	if(status !== 0 || stderr) throw new Error(stderr || `PHP exited with status ${status}`);
	output.dataset.state = 'ready';
} catch(error)
{
	output.textContent = error.message;
	output.dataset.state = 'error';
	throw error;
}
```

`vite.config.mjs`:

```js file=php-wasm/ordinary/vite.config.mjs
/**
 * Bundle the Lean package and serve the pinned PHP host unchanged.
 *
 * @file
 */
export default {
	base: './'
	, build: {
		assetsInlineLimit: 0
		, rollupOptions: { external: ['/php-host/PhpWeb.mjs'] }
	}
};
```

Run `npx vite build`, then `npx vite preview` and open the printed localhost address. The page displays `4294967295`. Vite bundles the Lean descriptor and copies its libraries and PHP files to asset URLs. The external import leaves the PHP host unchanged. `autoTransaction: false` disables automatic filesystem persistence for this stateless example.

The [first-call acceptance](evidence/php-wasm-lazy-20260915.md) runs these exact files, plus two installed components together, with external requests blocked. It checks both loading modes and browser responsiveness during delayed library downloads. Other browser engines and browser workers need separate acceptance.

#### Copied type conversions

These mappings apply to ordinary copied packages. The Alpha tables later on this page retain their separate profile.

| Lean type | PHP-Wasm value | Rules |
| --- | --- | --- |
| `Unit` | `null` | Arguments, results and fields |
| `Bool` | `bool` | No integer coercion |
| `UInt8`, `UInt16`, `Int8`, `Int16`, `Int32` | `int` | Exact width and range checks |
| `UInt32`, `UInt64`, `Int64`, `Nat`, `Int` | `Brick\Math\BigInteger` | Canonical decimal input; exact values across the 32-bit host boundary |
| `Float32`, `Float` | `float` | Binary32 rounding for `Float32`; NaN, infinities and signed zero preserved |
| `String` | `string` | Valid UTF-8, including embedded NUL |
| `ByteArray` | Generated `Bytes` | Arbitrary binary data |
| `Array T` | PHP list | Consecutive keys; recursively checked copied elements |
| Acyclic Lean record | Generated readonly class | Named fields and independent copied results |

Invalid types raise `TypeError`; out-of-range values and conversion limits raise `ValueError`. Native conversion failures raise the package's `LeanBridgeError`. Converted input and output have separate 16 MiB accounting limits; those limits do not bound Lean's working memory.

Use `Brick\Math\BigInteger::of` for every `UInt32`, `UInt64`, `Int64`, `Nat` and `Int` argument, including small values. Numeric PHP strings, integers and floats are not substitutes. Brick normalizes the number; Lean Bridge checks its canonical value and limits it to 16,384 decimal digits. Use quoted decimal strings for values above `PHP_INT_MAX`, never PHP floating-point literals. The same mapping applies to array elements and record fields, with `strict_types` either enabled or disabled.

The [installed boundary checks](evidence/php-wasm-primitive-boundaries-20260918.md) cover both halves of `UInt32`, signed bounds, values beyond JavaScript's exact-number range, and large `Nat`/`Int` values. They also check floating-point rounding, signed zero, NaN classification, Unicode, embedded NUL and arbitrary bytes in Node and Chromium. The [Alpha example API](#alpha-example-api) uses the same `BigInteger` representation for its `UInt32` resources, callbacks and returned functions.

#### Use the companion Composer API

Install the matching Composer ZIP using the [artifact-repository setup](#ordinary-project-packages), with its own coordinate, `example/willow-php-wasm:2.0.0-RC.1`. When Composer runs on a native host, set `config.platform.php` to `8.4.1` for this Wasm application. Use the npm descriptor's `extensions` export in `sharedLibs`, mount your installed `vendor/` directory into the PHP virtual filesystem, then require that mounted `vendor/autoload.php`. The default descriptor already supplies the PHP files and needs no Composer install; do not preload a second copy.

For first-call loading, import `lazy` and pass `lazy.extensions` in `dynamicLibs` instead. The [installed tests](evidence/php-wasm-lazy-20260915.md) execute both loading modes with embedded PHP files, Composer autoloading and Vite-bundled assets in Node. Chromium executes bundled PHP sources in both modes.

## Native PHP

### Native PHP prerequisites

Use PHP 8.2 NTS on x86-64 Linux with glibc 2.38 or newer, plus Composer 2. The extension targets PHP module API `20220829`. ZTS, other PHP versions, and other native platforms require a different build and are not covered by this package's acceptance tests.

Check the PHP executable that will run the application:

```sh
php -n -v
php -n -r 'echo PHP_VERSION, " NTS=", PHP_ZTS ? "no" : "yes", PHP_EOL;'
getconf GNU_LIBC_VERSION
```

### Obtain the package

Request the native Alpha package `poc/lean-alpha-php-native@0.0.0`. For a distributed archive, follow [Use a prepared release](consume/receive-package.md) before extracting it or loading native code. Set `LEAN_ALPHA_PHP_PACKAGE` to the extracted directory containing `lib/` and `share/`:

```sh
export LEAN_ALPHA_PHP_PACKAGE=/absolute/path/to/extracted-native-package
test -f "$LEAN_ALPHA_PHP_PACKAGE/lib/php/lean_alpha.so"
test -f "$LEAN_ALPHA_PHP_PACKAGE/share/php/component/composer.json"
```

### Install the Composer files

Create a new directory outside the extracted package:

```sh
mkdir lean-alpha-php-example
cd lean-alpha-php-example
cp -R "$LEAN_ALPHA_PHP_PACKAGE/share/php/component" ./component
chmod -R u+w ./component
composer dump-autoload \
  --working-dir ./component \
  --no-interaction --no-scripts --quiet
```

Composer generates the autoloader for the included sources. The shared runtime and extension remain in the package directory; keep its `lib/` layout intact.

### Run the program

Save this as `main.php` beside `component/`:

```php file=php-native/main.php
<?php
declare(strict_types=1);

require __DIR__ . '/component/vendor/autoload.php';

use LeanAlpha\Box;
use LeanAlpha\Bytes;
use LeanAlpha\Payload;
use function LeanAlpha\makeAdder;
use function LeanAlpha\roundTrip;
use function LeanAlpha\withCallback;

$box = new Box(41);
$addTwo = null;
try {
    $payload = roundTrip(new Payload(
        false, 8, 'consumer', Bytes::fromString("\x00\x7f\xff"), [1, 5, 13],
    ));
    $addTwo = makeAdder(2);
    $result = [
        'box' => $box->read(),
        'identity' => $box->identity() === $box,
        'payload' => [
            $payload->enabled, $payload->count, $payload->label,
            bin2hex($payload->bytes->toString()), $payload->values,
        ],
        'callback' => withCallback(40, static fn(int $value): int => $value),
        'closure' => $addTwo(40),
    ];
    $expected = [
        'box' => 41,
        'identity' => true,
        'payload' => [true, 9, 'consumer', '007fff', [1, 5, 13]],
        'callback' => 42,
        'closure' => 42,
    ];
    if ($result !== $expected) {
        throw new RuntimeException('Lean Alpha returned an unexpected result');
    }
    echo json_encode($result, JSON_THROW_ON_ERROR), PHP_EOL;
} finally {
    try {
        $addTwo?->close();
    } finally {
        $box->close();
    }
}
```

Load the extension and execute the file:

```sh
php -n -d "extension=$LEAN_ALPHA_PHP_PACKAGE/lib/php/lean_alpha.so" main.php
```

Expected output:

```json
{"box":41,"identity":true,"payload":[true,9,"consumer","007fff",[1,5,13]],"callback":42,"closure":42}
```

The program uses explicit checks, so it fails even when PHP assertions are disabled. Alpha's `roundTrip` flips the Boolean and increments the count. `withCallback(40, identity)` returns `42`; `makeAdder(2)` returns a callable that adds two.

### Native PHP ownership and errors

`Payload` is a copied PHP value. Its text remains UTF-8 text, `Bytes` preserves binary data, and `values` is a typed list. The transport does not encode the record as JSON; this example uses JSON only to print its result.

`Box` owns a Lean resource. `identity()` returns the same PHP wrapper, so closing either reference closes that resource. The returned callable also owns a Lean value. Close both in `finally`; their destructors provide fallback cleanup. Repeated `close()` calls are allowed, and using a closed wrapper raises `LeanAlpha\DisposedResource`.

Generated validators reject incorrect PHP types and out-of-range values. Callback exceptions cross back to the PHP caller. Catch errors at your application boundary and keep cleanup in `finally`.

### Native PHP troubleshooting

- **Unable to load the extension:** check the PHP version, NTS setting, CPU architecture, and glibc version. Keep `lib/php/lean_alpha.so` beside the packaged `lib/liblean_bridge_native.so` layout.
- **The `LeanAlpha` classes are missing:** run Composer in `component/` and require `component/vendor/autoload.php` from the application.
- **No output from an older example:** run the complete program above. It prints results and uses unconditional comparisons instead of PHP's configurable `assert()`.


## PHP-Wasm

### PHP-Wasm prerequisites

Use Node 22 and npm with `php-wasm` version `0.1.0`. This guide selects PHP `8.4`, the version covered by the PHP-Wasm consumer profile. Browser-hosted PHP and other PHP versions need separate acceptance work.

The application uses a completed package and needs no Emscripten or PHP compiler.

### Obtain and install the package

Request the Alpha npm archive `php-wasm-lean-alpha@0.0.0`. [Authenticate the archive](consume/receive-package.md) before installation. The lazy and startup builds share the npm coordinate but have distinct archive subjects and graph profiles in their release receipts. Choose one profile and verify its exact archive.

The following commands expect an authenticated archive at an absolute path:

```sh
export LEAN_ALPHA_PHP_WASM_ARCHIVE=/absolute/path/to/php-wasm-lean-alpha-0.0.0.tgz
mkdir lean-alpha-php-wasm-example
cd lean-alpha-php-wasm-example
```

Create `package.json`:

```json file=php-wasm/package.json
{
  "name": "lean-alpha-php-wasm-example",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node main.mjs"
  }
}
```

Install the exact host version and the archive, with lifecycle scripts disabled:

```sh
npm install --save-exact --ignore-scripts --no-audit --no-fund \
  php-wasm@0.1.0 "$LEAN_ALPHA_PHP_WASM_ARCHIVE"
```

Keep the resulting lockfile with your application.

### Write the PHP program

Save this as `main.php`:

```php file=php-wasm/main.php
<?php
declare(strict_types=1);

require_once '/vendor/autoload.php';

use LeanAlpha\Box;
use Brick\Math\BigInteger;
use LeanAlpha\Bytes;
use LeanAlpha\Payload;
use function LeanAlpha\makeAdder;
use function LeanAlpha\roundTrip;
use function LeanAlpha\withCallback;

$box = new Box(BigInteger::of('41'));
$addTwo = null;
try {
    $payload = roundTrip(new Payload(
        false, BigInteger::of('8'), 'consumer', Bytes::fromString("\x00\x7f\xff"),
        array_map(BigInteger::of(...), ['1', '5', '13']),
    ));
    $addTwo = makeAdder(BigInteger::of('2'));
    $result = [
        'box' => (string) $box->read(),
        'identity' => $box->identity() === $box,
        'payload' => [
            $payload->enabled, (string) $payload->count, $payload->label,
            bin2hex($payload->bytes->toString()), array_map(strval(...), $payload->values),
        ],
        'callback' => (string) withCallback(BigInteger::of('40'), static fn(BigInteger $value): BigInteger => $value),
        'closure' => (string) $addTwo(BigInteger::of('40')),
    ];
    $expected = [
        'box' => '41',
        'identity' => true,
        'payload' => [true, '9', 'consumer', '007fff', ['1', '5', '13']],
        'callback' => '42',
        'closure' => '42',
    ];
    if ($result !== $expected) {
        throw new RuntimeException('Lean Alpha returned an unexpected result');
    }
    echo json_encode($result, JSON_THROW_ON_ERROR), PHP_EOL;
} finally {
    try {
        $addTwo?->close();
    } finally {
        $box->close();
    }
}
```

The package loader places its Composer files in PHP's virtual filesystem. `/vendor/autoload.php` belongs to that filesystem, not the Node process's host filesystem.

### Start the host and capture output

Save this as `main.mjs`:

```js file=php-wasm/main.mjs
/**
 * Runs the Alpha PHP program inside the installed PHP-Wasm host.
 *
 * @file
 */

import { readFile } from "node:fs/promises";
import { PhpNode } from "php-wasm/PhpNode";
import leanAlpha from "php-wasm-lean-alpha";

const php = new PhpNode({ version: "8.4", sharedLibs: [leanAlpha] });
let stdout = "";
let stderr = "";
php.addEventListener("output", event => {
	for(const chunk of event.detail) stdout += chunk;
});
php.addEventListener("error", event => {
	for(const chunk of event.detail) stderr += chunk;
});

await php.binary;
const source = await readFile(new URL("./main.php", import.meta.url), "utf8");
await php.writeFile("/main.php", source);
const status = await php.run("<?php require '/main.php';");
if(status !== 0 || stderr !== "")
{
	throw new Error(`PHP failed with status ${status}: ${stderr || stdout}`);
}
process.stdout.write(stdout.endsWith("\n") ? stdout : `${stdout}\n`);
```

Run it:

```sh
npm start --silent
```

Expected output:

```json
{"box":41,"identity":true,"payload":[true,9,"consumer","007fff",[1,5,13]],"callback":42,"closure":42}
```

Register the output listeners before awaiting initialization. `php.run()` returns an exit status; its return value does not contain the PHP output.

The host copies `main.php` into PHP's virtual filesystem and requires it as a file. This preserves PHP's `strict_types` declaration; passing the entire file directly to `php.run()` places it inside the host's evaluation wrapper.

### PHP-Wasm ownership and errors

PHP-Wasm exposes the same copied `Payload`, binary `Bytes`, canonical `Box` identity, PHP callbacks, and invokable Lean closures as [native PHP](#native-php-ownership-and-errors). Alpha changes the record's Boolean and count; the callback and returned callable each produce `42` in this example.

The `finally` blocks close the returned callable and the box even when a call fails. Closing a resource twice is allowed; using a closed wrapper raises `LeanAlpha\DisposedResource`. Keep each resource in the PHP-Wasm instance that created it. A second instance owns a separate Lean heap and identity domain.

Handle both JavaScript initialization failures and PHP failures. The host example throws on a nonzero PHP exit status or PHP error output. Explicit PHP comparisons keep the example's checks active when assertions are disabled.

### PHP-Wasm troubleshooting

- **The process prints nothing:** add the `output` listener and forward the captured text as above. Waiting for `php.run()` alone does not print PHP output.
- **The extension or a side module fails to load:** use PHP `8.4`, `php-wasm@0.1.0`, and the complete generated package. Do not mix assets from lazy and startup archives.
- **The autoloader is missing:** pass the imported descriptor in `sharedLibs` before awaiting `php.binary`. Node's `vendor/` directory is not PHP's virtual `/vendor/` directory.


## Values and cleanup

The copied-package examples above use exact `BigInteger` values where PHP-Wasm's 32-bit integers cannot hold the full Lean range. The table distinguishes ordinary-source packages from the separately checked Alpha resource and callback API.

### Arrays of generic records

Native PHP packages also accept Array-valued fields and arrays of alias-named generic records. Use the generated record types and the array representation listed below; no Lean type arguments are passed at runtime. The [native Array acceptance](evidence/generic-record-array-rollout-20261009.md) covers round trips, empty arrays, invalid members and recovery while retaining the original List, Option and specialization checks. These are local installed-package results; the page records their exact runtime scope.

### Subtypes inside containers

Ordinary-source and reviewed packages also accept checked `Subtype` leaves
inside `Array`, `List`, `Option`, products and `Except`. Use the base value
inside each generated host container listed in the conversion table. The package
runs the selected Lean constructor for each present leaf; absent options, empty
containers and inactive branches need no value or proof. Accepted normalization
reaches the Lean export. Rejection leaves the caller's input unchanged, and a
subsequent valid call can use the same package.

The [installed structural checks](evidence/structural-subtype-promotion-20261011.md)
cover primitive `Nat`, `String` and `UInt8` bases, mixed `Fin`, transparent
aliases with distinct constructor choices, and one closed `List` specialization.
They cover both author routes in native PHP and PHP-Wasm.
These local runs do not measure dispatch counts or establish hosted
release-floor acceptance.

### Subtypes in copied records

Native PHP and PHP-Wasm packages accept the tested `Nat` Subtype fields in acyclic copied
records and variants. Use the generated final readonly classes, such as
`Envelope`, `AliasPair`, `EventBox` and `EventChoices`, with
`Brick\Math\BigInteger` payloads. Do not supply Lean proofs. The generated
package validates weak and strict callers alike, including wrong classes,
uninitialized properties, negative values and malformed nested payloads.

Each input site keeps the constructor chosen by the Lean author. In the installed
fixture, the same `Envelope` containing `40` produces `41` through `first` and `42`
through `second`. Rejection preserves the caller's input, and a later valid
call can use the same package. Copied results need no input constructor;
standalone result-only packages retain records, variants, aliases and exact
100-bit `Nat` results.

The [installed native PHP checks](evidence/nominal-subtype-php-20261013.md)
cover both author routes with PHP 8.2.33 and Composer 2.5.5 on
Linux x64/glibc 2.36. Each package is reproduced in two author roots, installed
offline after both author/build roots are removed, then used by weak and strict
consumers before and after relocation. PHP consumer source remains required
at runtime.

The [nineteen-base native PHP checks](evidence/nominal-primitive-subtype-php-20261015/index.json)
extend those records, variants, aliases, nested copied containers and
constructor-free results to all nineteen primitive bases. The full API checks
per-site constructor selection and normalization, fixed-width overflow, signed
zero, non-finite float rejection where required, Unicode scalars, embedded NUL
text, binary bytes, active variant branches, mixed `Fin` guards, unchanged
caller values and recovery after rejection. The standalone result-only API has
no input constructor selections. All four author/API selections reproduce a
complete Composer ZIP from two author roots, install it offline after removing
the author and build roots, then run weak and strict callers before and after
relocation on PHP 8.2.33 and Composer 2.5.5 with 64-bit machine words and Linux
x64/glibc 2.36. Consumer PHP source remains required at runtime. The retained
archive records the local 8.0 load-admission ceiling. The
[recurring workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/nominal-primitive-subtype-php.yml)
owns hosted release-floor acceptance.

The [installed PHP-Wasm checks](evidence/nominal-subtype-php-wasm-promotion-20261014.md)
cover both author routes on wasm32 PHP 8.4.1, Node 22.23.2 and
Chromium 151.0.7922.34. Node callers use embedded and Composer installations;
browser callers use bundles. Each arrangement passes startup and lazy loading
with weak and strict callers twice after relocation. Two author roots
reproduce the API, component and shared-runtime archives before removal and
offline installation.

The [nineteen-base PHP-Wasm checks](evidence/nominal-primitive-subtype-php-wasm-20261015/index.json)
extend those records, variants, aliases, nested copied containers and
constructor-free results to all nineteen primitive bases. `UInt32`, `UInt64`,
`Int64`, `Nat`, `Int` and 32-bit `USize` use `Brick\Math\BigInteger`; `ISize`
uses a signed 32-bit PHP integer. The full API checks per-site constructor
selection and normalization, fixed-width overflow, signed zero, refused
non-finite floats, Unicode scalars, embedded NUL text, binary bytes, active
variant branches, mixed `Fin` guards, caller snapshots and recovery. The
standalone result-only API has no input constructor selections. All four
author/API selections reproduce the Composer API, npm component and npm shared
runtime from two author roots, install offline after removing author and build
roots, and run twelve startup/lazy, weak/strict Node and Chromium contexts twice
after relocation on wasm32 PHP 8.4.1, Node 22.23.2 and Chromium 152.0.7977.75.
Consumer PHP source remains required at runtime. The retained archive records a
2 GiB memory floor and a local load-admission ceiling of 8. The
[recurring workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/nominal-primitive-subtype-php-wasm.yml)
owns hosted current-revision acceptance.

The [recursive PHP-Wasm checks](evidence/recursive-subtype-php-wasm-20261015.md)
add checked `Nat` fields and `Fin 3` bounds to a recursive variant, its alias and
`Array (Option ...)` carriers. Ordinary and independently reviewed packages
retain separate constructor choices, validate every reachable occurrence and
project proof-backed recursive results. Exact late failures name the nested
field path; rejected calls preserve shared caller values and later calls recover.
Both routes reproduce all three packages and run the twelve Node and Chromium
loading, installation and strictness arrangements after offline installation
and relocation on wasm32 PHP 8.4.1.

Installed native refined-callback acceptance, owned, dependent and broader generic Subtypes remain
pending. Recursive checked-record combinations remain separate work. The
local PHP-Wasm checks do not measure constructor/source entry counts or dispatch.

### Type conversions

Profiles: Native PHP, PHP-Wasm. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `null` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Unit is null in arguments, results and fields. Unit is null for arguments and results, including callbacks; a PHP void callback returns null. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `bool` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Native PHP: Exact bool, including when the caller has strict_types disabled. PHP-Wasm: Exact bool in weak and strict callers; numbers and strings are not Boolean inputs. Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | Native PHP: `int` (input, result, field, callback input, callback result); PHP-Wasm: `Brick\Math\BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | PHP-Wasm: The compiled copied API uses Brick\Math\BigInteger for the full 0..4294967295 range, even for values below PHP_INT_MAX. PHP ints, floats and numeric strings are rejected. The 32-bit PHP host requires Brick\Math\BigInteger for the full 0..4294967295 range, even for small values; PHP ints, floats and numeric strings reject. Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `Brick\Math\BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Brick\Math\BigInteger::of preserves the full unsigned range without conversion through PHP float. Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -128..127; reject overflow before narrowing. |
| `Int16` | `int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | Native PHP: `int` (input, result, field, callback input, callback result); PHP-Wasm: `Brick\Math\BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | PHP-Wasm: The compiled copied API uses Brick\Math\BigInteger for the full -9223372036854775808..9223372036854775807 range on the 32-bit host. Exact Brick\Math\BigInteger preserves both signed 64-bit endpoints on the 32-bit host. Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `Brick\Math\BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Brick\Math\BigInteger accepts nonnegative integer values up to 16384 decimal digits. Exact Brick\Math\BigInteger; negative Nat inputs and callback results reject. No native integer narrowing. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `Brick\Math\BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Brick\Math\BigInteger accepts signed integer values up to 16384 decimal digits. Exact signed Brick\Math\BigInteger including multi-thousand-bit captured values. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `float` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Native PHP: PHP float input rounds to binary32. NaN classification, infinities and signed zero are preserved. PHP-Wasm: PHP float input rounds to binary32 in scalar, array and record positions. NaN classification, infinities, subnormals and signed zero are checked. Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `float` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Native PHP: Exact PHP float inputs preserve NaN classification, infinities and signed zero. PHP-Wasm: Binary64 values, NaN classification, infinities, subnormals and signed zero are checked in scalar, array and record positions. Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `string` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Validated UTF-8 PHP strings preserve embedded NUL. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `Bytes` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Bytes::fromString and toString preserve arbitrary binary bytes. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `list<T>` (input, result, field); `list<T> (consecutive-key PHP array)` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Native PHP: Consecutive-key PHP lists with recursive element validation; nested results own independent copies. Callback and captured values preserve constructor identity, Option presence, exact integers and independent storage. Weak and strict callers receive the same validation. Original Throwable objects survive cleanup; borrowed host callbacks expire with their call and returned Lean functions own explicitly closeable leases. Closure release defers during an active invocation. Consecutive-key PHP arrays preserve all nineteen primitives, order, empty rows, duplicates and nested arrays or records. Every call validates element types and nesting, including weak-mode callers, and returns independent copies. Native lengths, missing buffers, alignment, canonical scalar markers and copy budgets are checked before reads or allocation. PHP-Wasm: Consecutive-key PHP lists with recursive element validation; nested results own independent copies. Callback and captured values preserve constructor identity, Option presence, exact integers and independent storage. Weak and strict callers receive the same validation. Original Throwable objects survive cleanup; borrowed host callbacks expire with their call and returned Lean functions own explicitly closeable leases. Closure release defers during an active invocation. Consecutive-key PHP arrays preserve every primitive element, empty rows, order, duplicates and nested arrays or records. UInt32, UInt64, Int64, Nat, Int and USize use Brick\Math\BigInteger on wasm32; ISize uses a signed 32-bit PHP integer. Weak and strict calls validate every element and return independent copies. Sequence lengths, null buffers, alignment and Wasm memory bounds are checked before reads or allocation. Invalid scalar markers, integer magnitudes and output buffers reject with cleanup and recovery. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `null or Some` (input, result, field); `null \| Some<T>` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | None is null; new Some($value) retains presence. Some(null) preserves present Unit or an outer Some containing None, according to the declared payload type. Some(Some(null)) preserves two layers. Generated final readonly branch classes expose one value property. Concrete payloads are validated on every call, without weak-caller coercion. Callback and captured values preserve constructor identity, Option presence, exact integers and independent storage. Weak and strict callers receive the same validation. Original Throwable objects survive cleanup; borrowed host callbacks expire with their call and returned Lean functions own explicitly closeable leases. Closure release defers during an active invocation. Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | `Ok or Err` (input, result, field); `Ok<T> \| Err<E>` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Lean Except E T becomes new Ok($value) or new Err($error), each exposing a readonly value property. Branch identity is preserved even for same-typed payloads. Domain errors return Err; bridge failures throw. PHP === compares object identity; PHP == property comparison is not generated Lean equality. Callback and captured values preserve constructor identity, Option presence, exact integers and independent storage. Weak and strict callers receive the same validation. Original Throwable objects survive cleanup; borrowed host callbacks expire with their call and returned Lean functions own explicitly closeable leases. Closure release defers during an active invocation. Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `Two-element consecutive-key array (nested binary products)` (input, result, field); `array{A, B} (nested two-element lists)` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly two consecutive integer-key array elements preserve binary nesting and per-position validation. Nested arrays, records and branch payloads are copied independently. Validation, host conversion and native copying each have a 16 MiB accounting limit, not a bound on all PHP or Lean allocations. Payloads use the selected target's integer mappings. Callback and captured values preserve constructor identity, Option presence, exact integers and independent storage. Weak and strict callers receive the same validation. Original Throwable objects survive cleanup; borrowed host callbacks expire with their call and returned Lean functions own explicitly closeable leases. Closure release defers during an active invocation. Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Generated readonly class` (input, result, field); `Named final readonly class` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Native PHP: Final readonly typed classes, including empty and scalar-represented records. Input checks also validate objects made without their constructors. Callback and captured values preserve constructor identity, Option presence, exact integers and independent storage. Weak and strict callers receive the same validation. Original Throwable objects survive cleanup; borrowed host callbacks expire with their call and returned Lean functions own explicitly closeable leases. Closure release defers during an active invocation. Final readonly classes preserve original Lean field names, order and declared types, including empty and single-field records. Keyword class names gain a trailing underscore, with collision checks. Constructors require exactly their declared fields. Wrong classes, invalid payloads and uninitialized fields reject. equals and hashCode compare nested contents; private FFI layouts are not part of the public API. PHP-Wasm: Final readonly typed classes, including empty and scalar-represented records. Nested fields are checked and results own independent copies. Callback and captured values preserve constructor identity, Option presence, exact integers and independent storage. Weak and strict callers receive the same validation. Original Throwable objects survive cleanup; borrowed host callbacks expire with their call and returned Lean functions own explicitly closeable leases. Closure release defers during an active invocation. Final readonly classes preserve original Lean field names, order and declared types, including empty and single-field records. Keyword class names gain an underscore, with collision checks. Constructors require exactly their declared fields; wrong classes, invalid payloads and uninitialized fields reject. equals and hashCode compare nested contents. Returned record arrays and byte buffers are independent copies; numeric tags and native layouts remain private. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | Native PHP: `PHP target value; named Lean contract in installed manifest and PHPDoc` (input, result, field); `Resolved copied target type with retained PHPDoc alias metadata` (callback input, callback result); PHP-Wasm: `PHP target value; named Lean contract in installed catalog and PHPDoc` (input, result, field); `Resolved copied target type with retained PHPDoc alias metadata` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Native PHP: Aliases preserve exact target conversion rules, original names and independently copied results. Weak and strict callers get the same checks: Nat requires nonnegative Brick\Math\BigInteger, integer ranges remain enforced, Unit uses null and Char requires one Unicode scalar. List/Array identity, Option/Result presence, 32-level schema depth and existing 16 MiB conversion budgets remain unchanged. Callback and captured values preserve constructor identity, Option presence, exact integers and independent storage. Weak and strict callers receive the same validation. Original Throwable objects survive cleanup; borrowed host callbacks expire with their call and returned Lean functions own explicitly closeable leases. Closure release defers during an active invocation. PHP-Wasm: Aliases retain exact wasm32 target rules and independent copies. UInt32, UInt64, Int64, Nat, Int and USize use Brick\Math\BigInteger; ISize uses a 32-bit PHP int. Weak and strict callers get the same checks. Unit uses null and Char requires one Unicode scalar. List/Array identity, Option/Result presence, 32-level schema depth and existing 16 MiB conversion budgets remain unchanged. Callback and captured values preserve constructor identity, Option presence, exact integers and independent storage. Weak and strict callers receive the same validation. Original Throwable objects survive cleanup; borrowed host callbacks expire with their call and returned Lean functions own explicitly closeable leases. Closure release defers during an active invocation. Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | `abstract readonly family and final readonly constructor classes` (input, result, field); `Named readonly family and final constructor classes` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Native PHP: Construct named cases with positional or named payloads using original Lean field names. All nineteen primitive and admitted copied compound payloads preserve their checks in weak and strict callers. Empty cases and Unit payloads stay distinct. Calls require exact initialized generated cases and return independent copies. Native discriminants and union layouts remain private; invalid output tags reject before payload reads. Scoped cleanup releases partial conversions and clears owned output on failure. Callback and captured values preserve constructor identity, Option presence, exact integers and independent storage. Weak and strict callers receive the same validation. Original Throwable objects survive cleanup; borrowed host callbacks expire with their call and returned Lean functions own explicitly closeable leases. Closure release defers during an active invocation. PHP-Wasm: Named readonly cases preserve source field names, constructor identity, empty cases and Unit payloads. All nineteen primitive and admitted copied compound payloads retain exact checks in weak and strict PHP. UInt32, UInt64, Int64, Nat, Int and USize require Brick\Math\BigInteger on wasm32; ISize uses a signed 32-bit PHP int. Calls require exact initialized generated cases and return independent copies. Private tags and field counts reject before payload reads. Native owners and Zend scratch clear on partial failures and request bailouts; invalid inputs do not load lazy components. Callback and captured values preserve constructor identity, Option presence, exact integers and independent storage. Weak and strict callers receive the same validation. Original Throwable objects survive cleanup; borrowed host callbacks expire with their call and returned Lean functions own explicitly closeable leases. Closure release defers during an active invocation. Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | Native PHP: `LeanAlpha\Box` (result); PHP-Wasm: `Generated payload or authenticated Value owner` (callback input); `Value view anchored to a declared callback argument` (callback result); `LeanAlpha\Box` (result) | Ordinary source: Native PHP: Not audited; PHP-Wasm: Not audited (input, result, field); Installed checks passed (callback input, callback result). Reviewed IR: Native PHP: Not audited (input, field, callback input, callback result); Generator inspected (result); PHP-Wasm: Not audited (input, field); Generator inspected (result); Installed checks passed (callback input, callback result) | PHP-Wasm: A borrowed callback result expires with its authenticated argument owner. retain creates an independent owner; copyArg and copyResult validate public positions and generated types. A host callback may return a generated payload or whole Value; whole replies remain pinned until Lean accepts them. Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `callable` (input) | Ordinary source: Installed checks passed (input); Not audited (result, field, callback input, callback result). Reviewed IR: Installed checks passed (input); Not audited (result, field, callback input, callback result) | Synchronous PHP callable with generated signature PHPDoc. Mixed bridge parameters prevent weak-caller coercion; callback failures preserve the same Throwable, trace and previous exception after cleanup. Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | `list<T> (consecutive-key PHP array)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Native PHP: Consecutive-key PHP arrays preserve empty Lists, order, duplicates and nesting. Element-specific PHPDoc accompanies recursively checked mixed parameters, preventing weak-mode coercion. Results own independent mutable copies. Calls reject associative or sparse arrays, iterator objects, invalid payloads and oversized copies. Typed Lean helpers avoid cons-cell layout assumptions. Native output lengths, missing buffers and alignment are checked before element reads; finally clears owned results after conversion errors. Callback and captured values preserve constructor identity, Option presence, exact integers and independent storage. Weak and strict callers receive the same validation. Original Throwable objects survive cleanup; borrowed host callbacks expire with their call and returned Lean functions own explicitly closeable leases. Closure release defers during an active invocation. PHP-Wasm: Consecutive-key PHP arrays preserve empty Lists, order, duplicates and nesting. Element-specific PHPDoc accompanies recursively checked mixed parameters, preventing weak-mode coercion. UInt32, UInt64, Int64, Nat, Int and USize payloads use Brick\Math\BigInteger on wasm32; ISize uses a 32-bit PHP integer. Results own independent mutable copies. Typed Lean helpers retain distinct List/Array identities without cons-cell layout assumptions. Native sequence lengths, null buffers, element alignment and Wasm memory bounds are checked before allocation or element reads. Native owners are released after conversion errors and PHP bailouts. Callback and captured values preserve constructor identity, Option presence, exact integers and independent storage. Weak and strict callers receive the same validation. Original Throwable objects survive cleanup; borrowed host callbacks expire with their call and returned Lean functions own explicitly closeable leases. Closure release defers during an active invocation. Required: Preserve order, duplicates and nesting with a distinct list constructor. Validate all elements and copying limits; never expose Lean cons cells. |
| `Char` | `string` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly one Unicode scalar, 0..0x10FFFF excluding surrogates. NUL, supplementary characters, combining scalars, noncharacters and line endings are preserved without normalization. Multi-scalar grapheme clusters require String. One UTF-8 Unicode scalar, including NUL and supplementary values. Malformed text and multiple scalars reject. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | `Brick\Math\BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Native PHP: 64-bit compiled Lean target, 0..18446744073709551615. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Exact Brick\Math\BigInteger for the 64-bit compiled Lean target, checked in 0..2^64-1. PHP-Wasm: 32-bit compiled Lean target, 0..4294967295. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Exact Brick\Math\BigInteger for the 32-bit compiled Lean target, checked in 0..4294967295. Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | `int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Native PHP: 64-bit compiled Lean target, -9223372036854775808..9223372036854775807. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. PHP int for the 64-bit compiled Lean target; both signed endpoints are preserved. PHP-Wasm: 32-bit compiled Lean target, -2147483648..2147483647. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. PHP int for the 32-bit compiled Lean target, checked in -2147483648..2147483647. Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | Native PHP: `Brick\Math\BigInteger checked against the declared bound` (input); `BigInteger below the declared bound` (result); `Brick\Math\BigInteger checked against the field's closed bound` (field); PHP-Wasm: `Brick\Math\BigInteger checked against the declared closed Fin bound` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Native PHP: Use Brick\Math\BigInteger with the exact closed bound, including inside Array/List/Option/Prod/Except compositions, plain records and active variant fields. Empty containers, absent options and inactive Fin 0 branches are valid; present Fin 0 values are rejected. Rejections preserve caller values and name the failing path and bound. PHP-Wasm: Use Brick Math integers with exact closed bounds for scalar Fin, direct Array/List/Option compositions, pairs, active Except branches and copied record/variant fields. Empty Array/List (Fin 0) and absent Option (Fin 0) are valid; present Fin 0 values reject. Bounds wider than 64 bits stay exact on wasm32. Weak and strict callers retain inputs and can recover after rejection. Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | Native PHP: `Brick\Math\BigInteger, string and Bytes, checked by the exported Lean validator and constructed by the adapter before dispatch; also in generated structural containers; also in tested acyclic records and variants` (input); `the base value projected from the proof-backed Lean result; also in generated structural containers; also in tested acyclic records and variants` (result); `corresponding native PHP primitive value in generated final readonly records and active variant cases across all nineteen tested bases; no proof field` (field); `base values checked by the selected constructor in returned-closure inputs` (callback input); `base values from a host callback checked by Lean with an explicit typed recovery` (callback result); PHP-Wasm: `null, bool, PHP int, Brick\Math\BigInteger, float, string or generated Bytes, checked and constructed by the selected Lean constructor across all nineteen tested primitive bases; also in generated structural containers, acyclic records and active variant cases; generated recursive Chain values also check the selected constructor at every present value field and the Fin 3 bound at every digit field, including aliases and nested Array/Option carriers` (input); `the corresponding PHP-Wasm primitive value projected from the proof-backed Lean result across all nineteen tested bases; also in generated structural containers, acyclic records and active variant cases; generated recursive Chain values project constructor-free proof-backed payloads through aliases and nested Array/Option carriers` (result); `corresponding PHP-Wasm primitive value in generated final readonly copied records, active variant cases, and the tested acyclic owned Bundle; no proof field; selected Subtype fields are checked at their declared public site before a transfer consumes any resource` (field); `base values checked by the selected constructor in returned-closure inputs` (callback input); `base values from a host callback checked by Lean with an explicit typed recovery` (callback result) | Ordinary source: Native PHP: Installed checks passed (input, result, field); Generation tested; compilation unaudited (callback input, callback result); PHP-Wasm: Installed checks passed. Reviewed IR: Native PHP: Installed checks passed (input, result, field); Generation tested; compilation unaudited (callback input, callback result); PHP-Wasm: Installed checks passed | Native PHP: Pass the primitive base value, including inside Array, List, Option, Prod and Except containers using their generated host representations. Each present Subtype leaf uses the selected checked Lean constructor; accepted normalization reaches the export. A rejected leaf fails the call without changing the input; later valid calls still work. Results expose the proof-backed base values. Transparent aliases and the tested closed List specialization keep their constructor choices. In native PHP, checked nominal values preserve all nineteen tested primitive representations: null for Unit; bool; int for the bounded integers through UInt32 and Int64; Brick\Math\BigInteger for UInt64, Nat, Int and USize; float for Float32 and Float64; string for String and Char; Bytes for ByteArray; and int for 64-bit ISize. Generated final readonly classes carry record and active-variant fields without proof fields. Each input site retains its selected checked constructor and accepted normalization; only the active variant branch is checked. Fixed-width overflow, invalid Unicode scalars, malformed Bytes, non-finite floats where the contract refuses them, wrong classes and invalid Fin siblings reject before Lean dispatch. Rejection preserves the complete caller value, including signed zero and embedded NUL data, and later valid calls succeed. Copied results project proof-backed payloads without input constructor selections, including standalone result-only packages. In native PHP, checked nominal values preserve all nineteen tested primitive representations: null for Unit; bool; int for the bounded integers through UInt32 and Int64; Brick\Math\BigInteger for UInt64, Nat, Int and USize; float for Float32 and Float64; string for String and Char; Bytes for ByteArray; and int for 64-bit ISize. Generated final readonly classes carry record and active-variant fields without proof fields. Each input site retains its selected checked constructor and accepted normalization; only the active variant branch is checked. Fixed-width overflow, invalid Unicode scalars, malformed Bytes, non-finite floats where the contract refuses them, wrong classes and invalid Fin siblings reject before Lean dispatch. Rejection preserves the complete caller value, including signed zero and embedded NUL data, and later valid calls succeed. Copied results project proof-backed payloads without input constructor selections, including standalone result-only packages. .NET and JVM use generated WithRecovery values; native PHP uses with_recovery(callback, value); WIT typed registration takes an owned copied recovery. Recovery is validated before application execution and is never successful output. Returned Lean closures validate selected Subtype inputs before invoking their body. PHP-Wasm: Pass the primitive base value, including inside Array, List, Option, Prod and Except containers using their generated host representations. Each present Subtype leaf uses the selected checked Lean constructor; accepted normalization reaches the export. A rejected leaf fails the call without changing the input; later valid calls still work. Results expose the proof-backed base values. Transparent aliases and the tested closed List specialization keep their constructor choices. In PHP-Wasm, checked nominal values preserve all nineteen tested primitive representations on wasm32: null for Unit; bool; PHP int for UInt8, UInt16, Int8, Int16, Int32 and ISize; Brick\Math\BigInteger for UInt32, UInt64, Int64, Nat, Int and USize; float for Float32 and Float; string for String and Char; and generated Bytes for ByteArray. USize and ISize use 32-bit ranges. Generated final readonly classes carry record and active-variant fields without proof fields. Each input site retains its selected checked constructor and accepted normalization; only the active variant branch is checked. Fixed-width overflow, wrong host types, invalid Unicode scalars, malformed Bytes, refused non-finite floats and invalid Fin siblings reject before Lean dispatch. Rejection preserves the complete caller value, including signed zero and embedded NUL data, and later valid calls succeed. Copied results project proof-backed payloads without input constructor selections, including standalone result-only packages. Recursive Chain values use generated variant classes. PHP-Wasm traverses only the active case, checks each present Subtype with the constructor selected for that parameter, checks each Fin 3 digit, preserves shared caller graphs on rejection, and rejects cycles or values deeper than 128 copied levels. Results omit proof fields and input constructor choices. In PHP-Wasm, checked nominal values preserve all nineteen tested primitive representations on wasm32: null for Unit; bool; PHP int for UInt8, UInt16, Int8, Int16, Int32 and ISize; Brick\Math\BigInteger for UInt32, UInt64, Int64, Nat, Int and USize; float for Float32 and Float; string for String and Char; and generated Bytes for ByteArray. USize and ISize use 32-bit ranges. Generated final readonly classes carry record and active-variant fields without proof fields. Each input site retains its selected checked constructor and accepted normalization; only the active variant branch is checked. Fixed-width overflow, wrong host types, invalid Unicode scalars, malformed Bytes, refused non-finite floats and invalid Fin siblings reject before Lean dispatch. Rejection preserves the complete caller value, including signed zero and embedded NUL data, and later valid calls succeed. Copied results project proof-backed payloads without input constructor selections, including standalone result-only packages. Recursive Chain values use generated variant classes. PHP-Wasm traverses only the active case, checks each present Subtype with the constructor selected for that parameter, checks each Fin 3 digit, preserves shared caller graphs on rejection, and rejects cycles or values deeper than 128 copied levels. Results omit proof fields and input constructor choices. In the tested owned Bundle, PHP-Wasm exposes the refined Int payload as Brick\Math\BigInteger inside the generated Payload and Bundle classes while resource fields retain their generated Ticket owners. Borrowed calls validate without consuming the input. A transferred call validates the complete refinement tree first, so rejection leaves every resource owner usable; success consumes the original owner and returns a fresh lease. Results contain the Int payload but no proof field. Wrap a host callback that returns a selected Subtype with the generated with_recovery(callback, value). The recovery is validated before callback entry and is never successful output. Returned Lean closures validate selected Subtype inputs before invoking their body. Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Checked records and closed Nat indices` | Native PHP: `Generated PHP record with Brick\Math\BigInteger and array payload fields; also carries the tested proof-free inherited Span, Ticket and Stamped record chain with nested parent subobjects preserved; also carries the tested proof-free recursive Packet and Envelope/Step graphs with nominal identities and active variants preserved; Guarded zero-argument readonly PHP Witness object; Token keeps its null Unit field and Marker remains a distinct readonly object` (input, result); `Generated final readonly PHP Packet with Brick\Math\BigInteger digit and word fields nested inside Holder and ChoicePacket; no proof field; also carries the tested proof-free inherited Span, Ticket and Stamped record chain with nested parent subobjects preserved; also carries the tested proof-free recursive Packet and Envelope/Step graphs with nominal identities and active variants preserved` (field); `generated proof-free record values checked by the selected constructor in returned-closure inputs` (callback input); `generated proof-free record values from a host callback checked by Lean through an explicit typed recovery` (callback result); PHP-Wasm: `Generated record with BigInteger payloads and list<BigInteger> fields; also carries the tested proof-free inherited Span, Ticket and Stamped record chain with nested parent subobjects preserved; also carries the tested proof-free recursive Packet and Envelope/Step graphs with nominal identities and active variants preserved; Guarded zero-argument readonly PHP Witness object in wasm32 PHP; Token keeps its null Unit field and Marker remains a distinct readonly object The tested generated Booking and Claim values preserve copied checked fields and Ticket resource owners; each consumed site runs its selected constructor before any transfer.` (input); `Generated record with BigInteger payloads and list<BigInteger> fields; also carries the tested proof-free inherited Span, Ticket and Stamped record chain with nested parent subobjects preserved; also carries the tested proof-free recursive Packet and Envelope/Step graphs with nominal identities and active variants preserved; Guarded zero-argument readonly PHP Witness object in wasm32 PHP; Token keeps its null Unit field and Marker remains a distinct readonly object The tested generated Booking and Claim values project copied payloads and Ticket resource owners without proof fields.` (result); `Generated PHP-Wasm Packet with Brick\Math\BigInteger digit and word fields nested inside Holder and ChoicePacket; no proof field; also carries the tested proof-free inherited Span, Ticket and Stamped record chain with nested parent subobjects preserved; also carries the tested proof-free recursive Packet and Envelope/Step graphs with nominal identities and active variants preserved` (field); `Generated proof-free Claim with a live Ticket owner` (callback input); `Generated Claim checked by the selected Lean constructor with an explicit typed recovery` (callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Native PHP: Pass the generated record's runtime payload fields, without proof values. The selected Lean constructor checks each input and may normalize it; rejection identifies the parameter and constructor and preserves caller data. Results contain copied payload fields with proofs erased. Both ordinary and independently reviewed packages, including standalone result-only packages, passed installed checks. The tested final readonly Packet carries a Fin 10 digit and a checked Nat Subtype word as Brick\Math\BigInteger values. Holder nests Packet, and ChoicePacket carries it in the active Choice branch. Generated native PHP adapters apply the exact Packet and nested Word constructors selected at each direct, repeated, Array, List, Option, Product, Except, Holder and Choice input site. Rejected calls preserve the complete caller graph and later valid calls recover. Packet arrays and options returned by Lean contain proof-free payloads without input-constructor selections. The tested Span, Ticket and Stamped inheritance chain remains a chain of nested parent subobjects rather than flattened fields. Generated adapters preserve the parent aliases and public nominal identities, erase the ordered, linked and stamped proof fields, apply the exact per-site Span, Word, Ticket and Stamped constructors in dependency order, retain independent choices for repeated parameters, check the nested Fin 8 mark, preserve rejected caller values and recover on the next valid call. Full packages check inputs and proof-free results; result-only packages project the same inherited payloads without input-constructor metadata. The tested checked-record graphs preserve nominal identity through a self-recursive Packet and a mutually recursive Envelope ↔ Step pair, including aliases, Array and Option wrappers, active variant branches, exact Nat Subtype constructors and Fin 3 fields. Generated adapters validate every selected input site in dependency order, erase proof fields, expose constructor-free copied results, preserve rejected caller graphs and recover on the next valid call. Closed Bool, String and Nat indices remain authenticated metadata rather than PHP fields. Native PHP uses `Brick\Math\BigInteger` for `count`, `size` and every `EmptySized.data` element. Full packages exercise both weak and strict callers, generated constructor-time `ValueError` for negative Nat inputs, unchanged rejected values, recovery and proof-free results; standalone result-only packages expose the same copied records without checked-input metadata. Proof-only Witness crosses as a guarded zero-argument readonly PHP class. Token retains its null Unit field, Marker remains a distinct readonly class, and Option presence, list length and both Mark branches remain distinct. Full Composer packages validate the nullary checked constructor, exact-class failures and recovery; result-only packages project Lean-produced proof-erased values without input-constructor metadata. Pass the generated record's runtime payload fields, without proof values. The selected Lean constructor checks each input and may normalize it; rejection identifies the parameter and constructor and preserves caller data. Results contain copied payload fields with proofs erased. Both ordinary and independently reviewed packages, including standalone result-only packages, passed installed checks. The tested final readonly Packet carries a Fin 10 digit and a checked Nat Subtype word as Brick\Math\BigInteger values. Holder nests Packet, and ChoicePacket carries it in the active Choice branch. Generated native PHP adapters apply the exact Packet and nested Word constructors selected at each direct, repeated, Array, List, Option, Product, Except, Holder and Choice input site. Rejected calls preserve the complete caller graph and later valid calls recover. Packet arrays and options returned by Lean contain proof-free payloads without input-constructor selections. The tested Span, Ticket and Stamped inheritance chain remains a chain of nested parent subobjects rather than flattened fields. Generated adapters preserve the parent aliases and public nominal identities, erase the ordered, linked and stamped proof fields, apply the exact per-site Span, Word, Ticket and Stamped constructors in dependency order, retain independent choices for repeated parameters, check the nested Fin 8 mark, preserve rejected caller values and recover on the next valid call. Full packages check inputs and proof-free results; result-only packages project the same inherited payloads without input-constructor metadata. The tested checked-record graphs preserve nominal identity through a self-recursive Packet and a mutually recursive Envelope ↔ Step pair, including aliases, Array and Option wrappers, active variant branches, exact Nat Subtype constructors and Fin 3 fields. Generated adapters validate every selected input site in dependency order, erase proof fields, expose constructor-free copied results, preserve rejected caller graphs and recover on the next valid call. .NET and JVM use generated WithRecovery values; native PHP uses with_recovery(callback, value); WIT typed registration owns a copied recovery record. Recovery is checked before callback entry or application execution and is never successful output. Returned Lean closures apply the selected record and nested field constructors before their body. PHP-Wasm: Pass generated record objects with only payload fields: Interval {lo, hi}, Triple {data} for Sized 3, and Percent {value} for Bounded 0 101. Nat payloads use Brick\Math\BigInteger, including small values; data is a consecutive-key array of BigInteger values. Lean runs the constructor selected for each parameter, including normalization. Rejection names the parameter and constructor, preserves complete caller inputs, and permits later valid calls. Results contain copied payloads without proofs. Ordinary, independently reviewed and standalone result-only packages passed weak/strict and startup/lazy Node/Chromium checks on wasm32 PHP 8.4.1. The tested PHP-Wasm Packet carries a Fin 10 digit and a checked Nat Subtype word as Brick\Math\BigInteger values. Holder nests Packet, and ChoicePacket carries it in the active Choice branch. Generated PHP-Wasm adapters apply the exact Packet and nested Word constructors selected at each direct, repeated, Array, List, Option, Product, Except, Holder and Choice input site. Rejected calls preserve the complete caller graph and later valid calls recover. Packet arrays and options returned by Lean contain proof-free payloads without input-constructor selections. The tested Span, Ticket and Stamped inheritance chain remains a chain of nested parent subobjects rather than flattened fields. Generated adapters preserve the parent aliases and public nominal identities, erase the ordered, linked and stamped proof fields, apply the exact per-site Span, Word, Ticket and Stamped constructors in dependency order, retain independent choices for repeated parameters, check the nested Fin 8 mark, preserve rejected caller values and recover on the next valid call. Full packages check inputs and proof-free results; result-only packages project the same inherited payloads without input-constructor metadata. The tested checked-record graphs preserve nominal identity through a self-recursive Packet and a mutually recursive Envelope ↔ Step pair, including aliases, Array and Option wrappers, active variant branches, exact Nat Subtype constructors and Fin 3 fields. Generated adapters validate every selected input site in dependency order, erase proof fields, expose constructor-free copied results, preserve rejected caller graphs and recover on the next valid call. Closed Bool, String and Nat indices remain authenticated metadata rather than PHP fields. PHP-Wasm uses `Brick\Math\BigInteger` for `count`, `size` and every `EmptySized.data` element on wasm32. Full packages exercise weak and strict PHP callers in Node and Chromium, exact constructor refusals, unchanged rejected values, recovery and proof-free results; standalone result-only packages expose the same copied records without checked-input metadata. Proof-only Witness crosses as a guarded zero-argument readonly PHP class inside wasm32 PHP. Token retains its null Unit field, Marker remains a distinct readonly class, and Option presence, array length and both Mark branches remain distinct. Full Composer and component packages validate the nullary checked constructor, exact-class failures and recovery; result-only packages project Lean-produced proof-erased values without input-constructor metadata. PHP-Wasm represents the tested proof-backed Booking and Claim as generated readonly PHP objects. Window is copied; Claim retains a Ticket owner. Borrowed calls preserve the caller, transferred calls validate before moving the owner, and Lean-produced results omit proofs. Pass generated record objects with only payload fields: Interval {lo, hi}, Triple {data} for Sized 3, and Percent {value} for Bounded 0 101. Nat payloads use Brick\Math\BigInteger, including small values; data is a consecutive-key array of BigInteger values. Lean runs the constructor selected for each parameter, including normalization. Rejection names the parameter and constructor, preserves complete caller inputs, and permits later valid calls. Results contain copied payloads without proofs. Ordinary, independently reviewed and standalone result-only packages passed weak/strict and startup/lazy Node/Chromium checks on wasm32 PHP 8.4.1. The tested PHP-Wasm Packet carries a Fin 10 digit and a checked Nat Subtype word as Brick\Math\BigInteger values. Holder nests Packet, and ChoicePacket carries it in the active Choice branch. Generated PHP-Wasm adapters apply the exact Packet and nested Word constructors selected at each direct, repeated, Array, List, Option, Product, Except, Holder and Choice input site. Rejected calls preserve the complete caller graph and later valid calls recover. Packet arrays and options returned by Lean contain proof-free payloads without input-constructor selections. The tested Span, Ticket and Stamped inheritance chain remains a chain of nested parent subobjects rather than flattened fields. Generated adapters preserve the parent aliases and public nominal identities, erase the ordered, linked and stamped proof fields, apply the exact per-site Span, Word, Ticket and Stamped constructors in dependency order, retain independent choices for repeated parameters, check the nested Fin 8 mark, preserve rejected caller values and recover on the next valid call. Full packages check inputs and proof-free results; result-only packages project the same inherited payloads without input-constructor metadata. The tested checked-record graphs preserve nominal identity through a self-recursive Packet and a mutually recursive Envelope ↔ Step pair, including aliases, Array and Option wrappers, active variant branches, exact Nat Subtype constructors and Fin 3 fields. Generated adapters validate every selected input site in dependency order, erase proof fields, expose constructor-free copied results, preserve rejected caller graphs and recover on the next valid call. A host callback receives a proof-free generated Claim whose Ticket is borrowed for the call. Host replies and explicit recovery values run mkClaim; an invalid explicit recovery rejects before callback entry and is never replaced by automatic recovery. Returned Lean closures validate host Claim inputs and project proof-free Claim results. Required: Construct inputs only through the selected safe Lean constructor over the exact payload fields. Preserve closed indices and per-site choices; project proof-backed results without fabricating proofs. |
| `Dependent parameters and results` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | `Named readonly PHP classes and constructor cases; consecutive-key arrays and explicit option/result cases` (input, result, field); `Named PHP value classes and constructors, consecutive-key arrays, PHP callables and invokable LeanClosure owners` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Native PHP: Readonly named classes preserve recursive constructors and aliases. Calls validate every scalar and array element under weak and strict callers, reject cycles, and return independent copies. Conversion limits are 128 value levels, 262,144 visited values and separate 16 MiB budgets. Native output owners and partial conversions are released on failure. Recursive records, variants and aliases use generated named PHP classes and independent copied storage. Weak and strict callers share explicit value validation. Reply scopes retain buffers until Lean finishes copying. Throwable identity survives cleanup. Malformed native output retires the shared runtime; owned closures can still close and copied values remain usable. PHP-Wasm: The same named PHP classes preserve recursive constructors on wasm32. UInt32, UInt64, Int64, Nat, Int and USize use Brick Math integers; ISize uses a 32-bit PHP integer. Weak and strict calls reject cycles and invalid payloads and return independent copies. Conversion limits are 128 value levels, 262,144 visited values and separate 16 MiB budgets; Zend failures release owned outputs. The same named PHP classes preserve recursive constructors, records and aliases on wasm32. UInt32, UInt64, Nat and Int use Brick Math integers as documented. Borrowed replies stay alive until Lean finishes copying; callback contexts cannot be reused after exhaustion. Owned functions retain native uint64 identities in Zend resources. Exit, Zend bailouts and partial output construction clean up before request recovery. Malformed native output retires the shared runtime; existing owners can still close and copied values remain usable. Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
| `Polymorphic exports` | Native PHP: `Concrete namespaced PHP function for each configured specialization` (signature); `Named finite specializations` (signature); PHP-Wasm: `Named finite specializations` (signature) | Ordinary source: Native PHP: Installed checks passed; PHP-Wasm: Not audited. Reviewed IR: Generator inspected | Native PHP: Each configured type application becomes a distinct monomorphic host function. The unspecialized Lean declaration is absent. Name a closed generic structure application with an abbrev to get a host record with instantiated fields. Configured functions over these records, List aliases and Option aliases use ordinary concrete signatures. Array-valued fields and arrays of alias-named records use the host's ordinary array representation with recursive element checks. Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |
| `Implicit arguments {α}` | Native PHP: `Concrete host signature with no runtime type argument` (signature); PHP-Wasm: No host mapping recorded | Ordinary source: Native PHP: Installed checks passed; PHP-Wasm: Not audited. Reviewed IR: Not audited | Native PHP: Lean elaboration supplies configured type arguments before native compilation; the host passes no placeholder value. Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |
| `Instance arguments [C α]` | Native PHP: `Concrete host signature with the Lean-selected instance dictionary erased` (signature); PHP-Wasm: No host mapping recorded | Ordinary source: Native PHP: Installed checks passed; PHP-Wasm: Not audited. Reviewed IR: Not audited | Native PHP: Lean synthesizes the selected dictionary before native compilation. The host cannot provide or replace it. Required: Specialize or supply the selected dictionary without changing runtime behavior. |
| `Prop / theorem / proof arguments` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Record theorem identity and assumptions. Erasure does not remove the need to check a runtime refinement. |
| `Optional parameter with default` | `Optional argument with declared default` (signature) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Apply only the declared default; distinguish omitted input from a supplied Option.none. |
| `Explicit nullable host value` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Select an explicit host projection; null does not stand for every missing, erased or unsupported value. |
| `IO α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Executing IO is not automatically asynchronous. Preserve effect order and exceptions. |
| `EIO ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve typed failures separately from transport validation and unexpected traps. |
| `Declared failure contract` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Project every declared error and payload; preserve trap or poisoned-runtime handling separately. |
| `Task α / asynchronous result` | `Generated Awaitable<T>` (signature) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Keep completion, rejection, cancellation and runtime lifetime distinct; do not block a browser event loop. |
| `Declared host object` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate typed members and preserve receiver identity, dynamic-access policy and lifetime. |
| `Lean function returned to the host` | `LeanClosure` (result) | Ordinary source: Not audited (input, field, callback input, callback result); Installed checks passed (result). Reviewed IR: Not audited (input, field, callback input, callback result); Installed checks passed (result) | Invokable LeanClosure with exact positional arity, close and isClosed. Saved callable aliases share its lease. Cloning, serialization and direct construction reject. Required: Preserve captured state, call signature, errors and deterministic disposal. |
| `Cancellation protocol` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specify acknowledgement and late completion; release pending work exactly once. |
| `Synchronous iterator` | `Traversable<int, T>` (signature) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve values, end-of-sequence, failure, early return and cleanup. |
| `Asynchronous iterator` | `Generated AsyncIterator<T>` (signature) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve backpressure, pending-pull cancellation and terminal cleanup. |

### Alpha example API

Alpha uses `int` for `UInt32` on native 64-bit PHP and `Brick\Math\BigInteger` on PHP-Wasm. Keep `declare(strict_types=1)` in application files so PHP does not coerce scalar arguments before the bindings validate them.

| Lean type | PHP type | Conversion rules |
| --- | --- | --- |
| `Bool` | `bool` | Pass `true` or `false`. |
| `UInt32` | Native: `int`; PHP-Wasm: `Brick\Math\BigInteger` | Full `0..4294967295` range in both profiles. In PHP-Wasm, use `BigInteger::of('4294967295')`, including for small values. |
| `String` | `string` | Valid UTF-8 text; embedded NUL is preserved. |
| `ByteArray` | `LeanAlpha\Bytes` | Use `Bytes::fromString` for binary data and `toString()` to retrieve it. |
| `Array UInt32` | `array`, documented as native `list<int>` or PHP-Wasm `list<BigInteger>` | Sequential keys starting at zero; each element uses the profile's `UInt32` representation. |
| `Payload` | `LeanAlpha\Payload` | Readonly copied value with typed fields; no JSON conversion. |
| `Box` | `LeanAlpha\Box` | Resource with canonical object identity; close it in `finally`. |
| `UInt32 → UInt32` callback | Native: `callable(int): int`; PHP-Wasm: `callable(BigInteger): BigInteger` | Synchronous PHP callback; arguments and results preserve the full unsigned range. |
| Returned Lean closure | `LeanAlpha\Transform` | Invokable resource; call it in its originating runtime and release it with `close()`. |

Alpha's `roundTrip` increments its count with Lean's `UInt32` arithmetic: `2147483647` becomes `2147483648`, and `4294967295` wraps to `0`. Both results are exact in PHP-Wasm. PHP integers, floats and numeric strings cannot substitute for `BigInteger` arguments. [Installed checks](evidence/php-alpha-uint32-boundaries-20260918.md) cover strict and weak callers, payload elements, callback arguments and results, returned closures, rejected inputs and cleanup.



### Verify the native release

[Use a prepared release](consume/receive-package.md) explains archive authentication. The [native release evidence](evidence/native-php-release-package.md) records ABI and package checks.

### Install Composer autoloading

Follow [Install the Composer files](#install-the-composer-files) above.

### PHP-Wasm alternate transport

Follow the [PHP-Wasm installation and host example](#php-wasm) above.

## Start from a raw Lean package

Follow [Build and publish PHP packages](publish/php.md) for the required inputs and package builders.

### Build the pinned native package

[Build the native package](publish/php.md#build-and-check-the-native-package) in the author workflow. Repository maintainers run the [PHP acceptance checks](contributing/testing.md#consumer-acceptance).
