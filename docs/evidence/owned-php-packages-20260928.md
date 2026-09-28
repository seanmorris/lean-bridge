# Native PHP owned Composer packages

VO 1219. This milestone adds the native adapter and Composer archive builders
for resource-containing values. CLI admission and release registration remain
separate work. PHP-Wasm requires a Zend ownership transport.

## Build and installation

`projectOwnedPhp` consumes a freshly compiled, authenticated Lean component and
shared runtime. It generates the public C ownership API and PHP callback shim
in one translation unit. The adapter links an independently built GMP 6.3.0
library before the Lean component and runtime. GMP has a private SONAME and
local symbol binding. Both the adapter and loader prevent library unloading.

`ownedPhpEvidence` reconstructs generated sources from compiler metadata,
checks the complete artifact inventory, verifies the pinned GMP source and
license files, and checks the ELF dependency order and loading flags. Changing
a source and updating its recorded hash does not bypass reconstruction.

`packageOwnedPhp` generates the automatic loader, public PHP declarations,
Composer metadata, native libraries, source notices, GMP corresponding source
and a package receipt. Its ZIP uses fixed timestamps. Composer installs the
prepared archive and Brick Math without install scripts, plugins or compilers.
Consumers require `vendor/autoload.php` and call generated namespace functions.
They do not supply FFI declarations, runtime paths or manual loader setup.

The generated PHP types preserve nested Options, results, products, variants,
recursive values, aliases and exact integers. Resource and returned closure
wrappers expose `close()` and `retain()`. Callback borrows expire when the
callback returns. PHP receives the original exception after native cleanup.

## Executable acceptance

Run with the pinned Lean toolchain, a C compiler, PHP 8.2 or newer NTS CLI,
Composer 2, and the required PHP extensions:

```sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 \
  tests/owned-php-package.test.mjs \
  tests/owned-php-packaging.test.mjs \
  tests/owned-php-coexistence.test.mjs \
  tests/php-recursive-callable-contract.test.mjs
```

The ordinary and independently reviewed fixtures cover 51 public functions and
19 primitive callback types. Both strict and weak callers round-trip mixed and
deep values, all variant constructors, empty containers, nested Option states,
resources and higher-order closures. They also check invalid input, expired
borrows, retained borrows, callback exceptions and calls from Fibers.

The installation harness starts with empty Composer home and cache directories,
disables network access, creates a lockfile, repeats the locked installation,
and verifies every installed package byte. It removes the Lean project and
producer output before installation. It then relocates the vendor directory,
removes the handoff archive and Composer project, and repeats public calls with
no compilers on PATH and no PHP ini file. Deployed files must remain unchanged.

Separate loader observations check the actual mapped library paths, private GMP
symbols and runtime initialization counters. One reusable ownership session
remains after an application's resources close. A shutdown observer runs after
the generated cleanup hook and requires zero remaining native identities.
The application never calls a private runtime cleanup method.

Tamper cases change each native library, remove or symlink the adapter, alter
ownership rules, change generated source while refreshing its hash, change GMP
source or build metadata, and add unrecorded files. A preloaded foreign Lean
runtime must also reject. Source reassembly must reproduce the exact ZIP.

The coexistence fixture independently compiles the same component in two
producer roots and compares all package files and archive bytes. It installs
two distinct owned APIs and a copied recursive API together, exercises four
initial load orders and nested cross-package callbacks, rejects foreign
resources, and checks shared runtime and private GMP mappings.

Reports are generated under `build/owned-php-packaging/`. They are local
execution records, not frozen source-history receipts or published releases.

The final package/bootstrap/previous-contract run passed 15 tests with no skips
in 345.43 seconds. Each ordinary/reviewed strict/weak consumer passed 241 checks,
with repeat execution producing the same result. Both shutdown observers
reported zero native identities and one runtime initialization. All earlier
recursive PHP package-byte comparisons still pass.

The separate coexistence run passed in 383.45 seconds. Each of four load orders
passed 284 checks, including 32 nested cross-package callbacks and 64 foreign
resource rejections. All orders reported one runtime initialization, three
component initializations and zero identities after automatic shutdown. The
independent rebuild reproduced all package files and the exact archive bytes.

Initial diagnostic runs found two observer mistakes: the idle session counted
as a leaked resource, and a library-name filter omitted the owned adapter. The
final observer checks the idle session before shutdown and zero identities
afterward, and compares all five mapped library names. The first coexistence
fixture also used a single-field resource that Lean erased to its scalar field.
The compiler correctly rejected that unstable identity. The corrected fixture
uses a two-field heap record; no compiler or ownership guard was relaxed.

## Remaining integration

Register the PHP generators, builders and tests in the CLI distribution,
checked-JavaScript inventory and execution profiles. Add ordinary/reviewed CLI
acceptance, combined-target builds, release receipt verification, consumer and
publisher documentation, CI requirements and source-bound evidence before
promoting installed-support cells. Keep historical PHP package bytes unchanged.

The full structured-type goal also includes PHP-Wasm, JavaScript/Wasm, selected
WIT/WASI ownership transport, transferred inputs and anchored results. This
Composer milestone does not complete VO 1219.
