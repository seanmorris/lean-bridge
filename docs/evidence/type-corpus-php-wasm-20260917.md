# Shared PHP-Wasm corpus, 2026-09-17

Historical record for commit `c08bf78`. The [WIT/WASI corpus record](type-corpus-wit-wasi-20260917.md) documents the subsequent seventeenth adapter.

VO 1217. The shared `Shop.Pricing` and `Telemetry.Readings` libraries now run through installed PHP-Wasm packages in Node and Chromium. Each exports 19 functions. Fresh Lean runs supply the expected results outside the consumers; PHP callers receive only inputs and independent signature/error expectations. Production generators and the type-support inventory are unchanged.

## Public types and values

PHP-Wasm uses the 32-bit, non-threaded PHP 8.4.1 embedded interpreter. `Nat`, `Int`, `UInt64`, `UInt32` and `Int64` use the public `BigInteger` wrapper. Smaller fixed-width integers use PHP integers. Bytes use `Bytes`; unit uses `null`. Reflection checks function names, argument order, return types, PHPDoc and final readonly record declarations against the corpus catalog.

The same weak and strict lexical caller files serve native PHP and PHP-Wasm, with explicit host-width rules. Integer cases include values beyond 4,096 bits. Floating-point results check exact wire bits for finite values, signed zero, subnormals and infinities, and classification for NaNs. Out-of-range native `Int32` values become PHP floats on this host and must fail as wrong types, without truncation. `UInt32` and `Int64` reject native integers where wrappers are required.

Record checks cover copied nested rows, referenced input rows, immutable exact-integer values, readonly fields and collection of completed input/output objects. Invalid inputs cover nulls, coercion, wrong wrappers, unsigned bounds, malformed UTF-8, non-list arrays, forged objects and input/output limits. Each supplemental error runs three times and is followed by a valid call checked against Lean.

## Prepared packages and execution

Both libraries include local and pinned offline Git dependencies and three proved lemmas. Each is built twice from relocated author trees. The harness compares exact npm runtime/component and Composer archive bytes, checks compiler declarations independently, and requires a source-elaboration rejection for the pending `Option` or `Except` export. It removes the author and oracle trees before verifying the package-set receipt through the public CLI.

Consumers install local archives with empty caches, network access disabled, and scripts/plugins disabled. The pinned `php-wasm` 0.1.0 host is repacked locally for the offline install and identified by all shipped file hashes; it is not an external symlink or a new published host package. Composer installs the matching API ZIP with PHP 8.4.1 as its target platform. A native PHP process runs Composer, but every corpus call executes in PHP-Wasm without FFI. Repeat locked installs must leave the dependency trees unchanged.

The installed deployment is relocated and the installation project removed. Node runs with compiler/runtime overrides disabled. Chromium serves the bundled descriptor under a nested URL, blocks external requests and records each served file's hash. Composer PHP sources must equal the copies shipped with the npm component.

Each library exercises these routes:

| Host | PHP API source | Loading | Caller |
| --- | --- | --- | --- |
| Node | Descriptor-mounted | Startup and lazy | Weak and strict |
| Node | Installed Composer package | Startup and lazy | Weak and strict |
| Chromium | Bundled descriptor | Startup and lazy | Weak and strict |

All 12 combinations run twice in fresh hosts. Lazy loading must fetch neither Lean library during autoload or an invalid call, then request exactly one runtime and one component after a valid call. Startup and lazy loading may request those two libraries in different orders. Reports require the exact libraries and counts at each stage, not an incidental fetch order. Repeated observations and installed file inventories must remain unchanged.

## Validation

The standalone command passes all 354 tests in 198.4 seconds. It records 124 primary catalog cases, 24 route/caller observations containing 1,488 catalog executions, and 1,728 supplemental error/recovery observations. These counts exclude the repeat runs. Sixteen fresh Node processes and eight fresh Chromium pages are then repeated, for 48 host instances in total.

The report records 41 scoped observed cells and 6,521 gaps. It is written to `build/type-corpus/php-wasm.json` and binds the catalog plus 50 source/harness files to corpus identity `5476b8930c6581362b4beff4d09ec806b443edb6d95839be945de29003a74307`.

The shared native PHP harness also accepts PHP 8.4's boolean `PHP_ZTS` constant, in addition to the integer form used by older PHP versions. A regression test still rejects threaded or malformed observations. This is a test-harness correction, not a generated-package change.

The recorded tools are Lean 4.32.2, Emscripten 3.1.68, Node 22.23.2, PHP-Wasm 0.1.0 with PHP 8.4.1, Composer 2.5.5 and Chromium 152.0.7977.75. The recorded standalone run reuses a verified compiled PHP-Wasm runtime; the preceding integration probe rebuilt that runtime from the pinned target archives. Runtime identity: `cf6fd0c4430e142677d32ae69d2f0585c667c1fcabb4b26a43c4d68789b48c5c`.

| Prepared artifact | SHA-256 |
| --- | --- |
| Shared npm runtime | `c04f0e88a6522fab805a619907eb1f5950df4fea2cecdd752ef6d94b6497cf94` |
| Shop npm component | `fbd03208a788e6293f4af25717f56ab0acae5129283c063334d37e1abf69810a` |
| Shop Composer API | `5c585648fca0ecfd1854203b64449900680ef5e520655b7d45c46fe7f62a7e14` |
| Telemetry npm component | `7201d3f37f2de597a72e41059a712e76bd83f020c738d91eaf7c404af65ac91d` |
| Telemetry Composer API | `b9ea2c2325ff4e8bd13fc00abed6eb658d55cbd47beed21c0ad85b359d60a0b1` |

## Combined regression

The sixteen-adapter run passes all 354 tests in 1,278.6 seconds. Its 32 library/profile installations account for 1,984 catalog cases: 1,746 executed, 178 rejected at compile time and 60 explicitly unsupported. It records 611 scoped observed cells and 5,951 gaps.

Supplemental error/recovery checks pass: 1,728 PHP-Wasm, 264 native PHP, 144 JVM, 60 .NET, 60 C/C++ and six Rust observations. The npm browser adapters record 24 engine/variant observations with 1,344 executed and 144 unsupported cases. PHP-Wasm's 24 route/caller observations are counted separately, including eight Chromium observations and sixteen Node observations. Repeat runs are not counted as additional coverage.

The combined report is `build/type-corpus/browser-javascript-browser-react-browser-worker-c-cpp-dotnet-java-kotlin-node-javascript-node-typescript-perl-php-native-php-wasm-python-ruby-rust.json`. Both reports revalidate against the same corpus identity. Their PHP-Wasm archive, binding-IR, runtime and fresh-oracle identities match. Native execution uses this machine's explicit glibc 2.36 test override; the production floor remains 2.38.

Core checks pass with 1,062 tests and 54 toolchain-gated skips. Documentation tests pass 65/65; site/demo tests pass 111/111; site type checking and the production site build pass. The type-support inventory is unchanged. All corpus-owned temporary author and consumer directories are removed after execution.

## CI and remaining work

The PHP consumer job requires `npm run test:type-corpus:php-wasm` and uploads `type-corpus-php-wasm-<commit>`. Failure or a missing report fails the gate. The [testing guide](../contributing/testing.md#shared-real-lean-type-corpus) lists prerequisites and tool selectors.

At this milestone, sixteen of seventeen shared-corpus adapters were implemented and WIT/WASI remained the adapter gap. Reviewed-IR execution and further type families, positions and semantics remain open. The inventory stays at 656 installed-tested cells and 29,530 required gaps. This record does not promote scoped corpus observations to full type support or publish a registry package.
