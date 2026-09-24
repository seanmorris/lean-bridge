# Recursive PHP-Wasm packages

The [execution record](php-wasm-recursive-packages-20260924.json) covers normal
PHP-Wasm builds from ordinary Lean source and independently reviewed contracts,
original npm archives, companion Composer ZIPs and source-free consumers.
The accepted coverage inventory is unchanged. A
[subsequent record](php-wasm-recursive-loading-20260924.md) covers independent
build reproduction and shared-package loading. Final cross-language regressions
remain open.

## Compiler and artifact checks

The compiler constructs a fixed wasm32 graph model from fresh Lean metadata.
Lean checks the total typed carriers, and the C compiler compares their
prototypes with emitted definitions. Generated graph transports preserve
32-bit platform words and fixed-width 64-bit integers. Component receipts bind
the finite layout, Zend adapter, C transport, runtime lifecycle and constructor
allocation guard.

Every freshly compiled Lean module and carrier includes the guard. Nine C
checks run against the actual target headers, covering valid boundaries,
object-field and scalar-byte limits, negative counts and nonconstant sizes.
The checks use the target allocator configuration rather than assuming the
native Linux allocator's size limit.

Artifact verification reconstructs the model and regenerates every PHP and C
source. Each source path rejects three re-signed graph-receipt mutations and ten
re-signed source mutations, including the allocation guard. Both package sets
reassemble to identical archives without recompiling Lean.

## Installed consumers

The test installs original runtime and component npm archives, the pinned
PHP-Wasm host, the Composer ZIP and Brick Math from local archives with empty
caches. It compares installed files with their verified package trees, relocates
the application, removes producer projects and archives, and hides compilers
from the execution PATH.

Each authoring path runs twelve Node configurations: descriptor-mounted PHP,
Composer autoloading and Vite-bundled descriptors, each with weak/strict callers
and startup/first-call loading. Chromium runs the bundled API in four
configurations, twice each in fresh network-isolated contexts at a nested URL.
That is 24 Node executions and 16 Chromium executions across both authoring paths.

Each caller passes 1,448 assertions and 35 rejection checks across eighteen
exports. The corpus includes nineteen scalar mappings, recursive and mutually
recursive values, aliases, nested options/results/products, copied DAGs,
127-link spines and 256-field constructors. Uninhabited inputs reject before
loading a lazy component. Each host handles twenty subsequent requests without
loading another library. Browser request hashes identify the installed PHP
sources and both Wasm libraries.

The package contains five PHP files. npm descriptors mount them automatically;
Composer autoloading uses the same generated files. Consumers need no compiler,
FFI extension or manual runtime path.

The record retains pre-admission production source snapshots. This does not
close the separate historical-source regression chain or promote this profile
to final acceptance. The earlier conversion and cleanup records remain intact.
See the [reproduction command](../contributing/testing.md#recursive-php-wasm-packages).
