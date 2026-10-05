# PHP-Wasm structured callbacks

VO 1219. PHP-Wasm accepts arrays, Lists, options, results, products, acyclic
records, variants and concrete copied aliases in synchronous callbacks and
returned closures. Public PHP values match ordinary inputs and results, with
the wasm32 integer mappings.

## Installed execution

Ordinary Lean source and independently reviewed Binding IR each produce a
26-export package. The test verifies and relocates its handoff, removes the
author workspace, installs the npm and Composer archives offline, and removes
the handoff before running consumers without compilers.

Each source path runs twelve arrangements: embedded npm and extension-only
Composer in Node, plus bundled Chromium, with startup and lazy loading and
weak and strict PHP callers. Each execution passes 105,617 checks, including
2,803 counted public calls and 623 expected rejections. Temporary nested
strings have no retained PHP owner. Callback failures preserve the original
`Throwable`; expired callbacks and closed closures reject.

The publisher's Lean example compiles. The consumer documentation example runs
in all twenty-four arrangements. Inventories of 168 installed files per source
path remain unchanged after execution. Receipts retain the original archives,
runtime identities, exact sources and loading observations.

PHP `exit` leaves the pinned host's current request inert. Tests call
`php.refresh()`, reload the autoloader, rerun the public consumer and require
an emitted recovery marker after repeated nested calls. A zero exit status
alone does not establish recovery. The host cannot start Fibers; a separate
contract test executes the production main-context guard with native PHP.

## Ownership and regressions

A separate synthetic C provider tests the generated Zend adapter in real
wasm32 PHP. It does not stand in for the installed Lean execution above.
Both lexical modes pass 9,545 checks, 640 allocation failures across forty
paths, 2,709 nested-buffer ownership checks, eight malformed wire replies and
two bailout recoveries. Every valid retry checks the allocation baseline.
Disabling callback buffer copies makes the test reject the unowned reply.

The six older copied fixture families generate sixty byte-identical files
across both Zend integer widths. A fresh installed primitive regression covers
all nineteen primitive types and 63 exports on both source paths, including
the explicit post-`exit` recovery program.

Run the installed gates:

```sh
LEAN_BRIDGE_PHP_WASM_STRUCTURED_CALLABLE_TEST=1 node --test --test-concurrency=1 \
  tests/php-wasm-structured-callables.test.mjs \
  tests/php-wasm-structured-callable-zend.test.mjs
LEAN_BRIDGE_PHP_WASM_CALLABLE_TEST=1 node --test --test-concurrency=1 \
  tests/php-wasm-callables.test.mjs
```

Use the contributor toolchains and installed Playwright Chromium. CI requires
both structured reports and retains them as artifacts. The
[execution record](php-wasm-structured-callables-20260925.json),
[code-generation comparison](php-wasm-structured-codegen-regression-20260925.json)
and [source transition](php-wasm-structured-callable-integration-20260925.json)
promote exactly thirty-two callback cells, bringing the inventory to 4,750 of
6,562 installed-tested cells.

Recursive callback payloads, resource-containing aggregates, retained host
callbacks and asynchronous delivery remain unsupported. Schema nesting stops
at 32; validation, Zend conversion and native copying each account for at most
16 MiB. These budgets do not bound all PHP overhead or Lean working memory.
