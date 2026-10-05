# Shared JavaScript and TypeScript corpus, 2026-09-17

VO 1217, commit `fc1d17e`. This record describes the Node milestone at that revision. The shared corpus installs prepared npm archives into separate JavaScript and TypeScript consumers. Both use the same `Shop.Pricing` and `Telemetry.Readings` sources, inputs and fresh Lean oracle as the [native adapters](type-corpus-perl-20260916.md). This milestone changes test infrastructure and CI, not production generators or type-support claims.

## Executed cases and gaps

Each Node profile executes **112 cases** across the two libraries: 80 results must match Lean and 32 calls must reject invalid input and then recover. Another 12 array/record cases remain unsupported. The ordinary-source WASM pipeline accepts the 16 primitive types but does not yet admit arrays or records. The harness requires the exact source-admission diagnostics for all three excluded exports and the separate `Option Nat` or `Except String Nat` export in each library.

JavaScript uses `bigint` for `Nat`, `Int`, `UInt64` and `Int64`; `number` for smaller fixed-width integers and floats; `boolean`, `string`, `undefined` and `Uint8Array` for the other primitives. Integer-valued float inputs are valid numbers. Boolean inputs to integer exports are invalid. Generated npm validators use `TypeError` for both type and range failures. The catalog records these differences from Python, Ruby and Perl explicitly.

The cases exercise 4,097-bit integers, fixed-width wrapping and bounds, Unicode and embedded NUL, empty values, and IEEE finite values, signed zero, subnormals, infinities and NaN. Float results compare bits except for NaN, where they compare classification. These parameter/result observations do not cover primitive fields, array elements, callbacks or effects.

The [report validator](../../tests/helpers/type-corpus.mjs) requires every catalog case to appear. It rejects missing observations, unexpected unsupported cases, claimed execution of unsupported cases, wrong archive targets and incomplete rejection evidence. Unsupported cases cannot contribute observed coverage, including the primitive field positions within unsupported records.

## Independent declarations and TypeScript

Before packaging, the [npm harness](../../tests/helpers/type-corpus-node.mjs) checks fresh Lean metadata from both builds against the catalog's independently specified names, parameter types and result types. It records the declaration hash separately from execution results.

The TypeScript consumer imports the installed public package and checks the exact function type of all 16 selected exports in each library. It generates calls from the catalog, not the emitted declarations. Three invalid host-type cases per library require `@ts-expect-error`; range failures still have valid TypeScript types and are checked at runtime. Compilation uses `strict`, `noEmitOnError` and `skipLibCheck: false`. The test then runs the emitted JavaScript and compares it with the same Lean oracle. Reports retain the compiler implementation, generated consumer source and installed declaration hashes.

## Prepared npm installation

Each library has a local Lake dependency and a pinned offline Git dependency. Both builds compile the library, its proofs and its dependencies from captured sources. The independent oracle compiles those same source bytes afresh. Compiler versions and commits must agree; the report records binary hashes separately because Nix patches its compiler's loader paths.

The harness builds each npm release from two relocated workspaces and requires byte-identical component and shared-runtime archives. It copies only the two archives, receipt and standalone verifier into a consumer handoff, then removes every author, oracle and unpacked build directory. The public `lean-bridge verify` command checks that relocated receipt before installation.

JavaScript and TypeScript each get a separate npm project, empty cache and npm configuration. Installation is offline with lifecycle scripts disabled and only Node on PATH. Calls run with an unavailable PATH and disabled Lean/C compiler and checkout-runtime paths. The consumer confirms that the public module resolves inside its own `node_modules`. TypeScript compilation uses the repository's pinned compiler; neither consumer rebuilds Lean or imports the repository's generated API.

## Local results

`npm run test:type-corpus:node` passes all **36 tests**. The real build/install test took 79.4 seconds on x86-64 Debian 12 with Node 22.23.2, TypeScript 5.9.3 and Lean 4.32.2, commit `f3b06c705e6c85f5314019d5d3baab0fec5b580c`.

Its report contains 248 case records: **224 executed and 24 unsupported**, across four isolated installations. It records **64 scoped observed cells and 6,498 gaps**. The catalog and its 18 source/harness files bind corpus identity `07a264bbea45d108e7fad1b16c81be594a84b085cda6463c58fcc4b4a125da9c`.

| Prepared archive | SHA-256 |
| --- | --- |
| `shop-corpus-1.0.0.tgz` | `54553117879cd564941ed959fe9f12e7932624991b2793361760fe6dedf94e10` |
| `telemetry-corpus-1.0.0.tgz` | `876255a13302d11c95ff6bbc7cd051acfc0320dea349f1de0e369818ffbf8bb6` |
| Shared `@lean-bridge/runtime` archive | `2fc6399bbd9f3b2770b83eebf23c51ce70d41c56d9461b71c0a0487c1bcead30` |

The runtime identity is `2417d3571ed8c55d55f1e52be04de5feb0dd0628de0346653c9412f90ec7549d`. Complete coordinates, compiler/declaration identities and per-case values remain in `build/type-corpus/node-javascript-node-typescript.json`.

A second run through the standalone engine executable passes all 36 tests in 84.7 seconds with the same corpus, archive and runtime identities. This checks the external-process invocation used by the CI harness. The local environment has no Nix, so this result does not claim execution of the Nix-pinned engine.

The combined five-profile run also passes all 36 tests in 411.6 seconds. It records **596 executed cases and 24 unsupported cases** across ten isolated installations: JavaScript, TypeScript, Perl, Python and Ruby for each library. All profiles share the same fresh Lean result set; native and WASM builds keep their separate runtime and binding IR identities. The report records **187 scoped observed cells and 6,375 gaps** in `build/type-corpus/node-javascript-node-typescript-perl-python-ruby.json`. It revalidates against the same corpus identity as the Node-only report. Native hosts were Perl 5.38.2 threaded, Python 3.11.2 and Ruby 3.3.12, with local native and Perl glibc floor overrides of 2.36. CI retains 2.38.

Core verification passes lint, checked-JavaScript types and 744 tests, with 54 compiler/runtime-gated skips. All 65 documentation tests, 111 site/demo tests, the site typecheck, production site build and type-inventory check pass.

## CI and remaining work

The Node consumer job now runs `npm run test:type-corpus:node` with the pinned component engine. Both Node support observations and the job gate require this run to pass. CI uploads `type-corpus-node-<commit>` and fails if its report is absent. See the [testing guide](../contributing/testing.md#shared-real-lean-type-corpus) for local prerequisites and commands.

Five of the 17 shared-corpus adapters are implemented. The other 12, reviewed-IR execution, remaining type families and untested positions remain under VO 1217. Existing per-language acceptance suites retain their separate evidence. The type-support inventory stays at 656 installed-tested cells; this corpus does not promote those claims. No registry publication occurred.
