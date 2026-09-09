# Consumer and publishing guide acceptance, 8 September 2026

The documentation now registers 48 pages and prerenders 54 React routes. The JavaScript and TypeScript guide covers Node, browser JavaScript, React, and workers in one page. Native and managed languages have separate guides, with a shared package-receipt procedure. Five superseded JavaScript-family URLs and the old .NET/JVM/Ruby page retain their heading anchors as compatibility links. Navigation and search exclude those six compatibility pages.

Nine publishing guides cover npm, PyPI, Cargo, NuGet, Maven repositories, RubyGems, Composer, C/C++/WIT archive distribution, and signed Nix binary caches. Their commands distinguish operator-run uploads from the configured signed transaction. No registry upload or remote release action was performed for this documentation change.

Registry instructions were checked against official documentation. All 72 shell blocks in the nine publishing guides passed `bash -n`. A local Composer archive check produced the expected source ZIP. A local Cargo package check rejected the generated `.cargo_vcs_info.json` as reserved input; retaining that file outside the publisher source allowed Cargo to package and verify a new archive with a different hash. The Cargo guide requires review of that new archive rather than reusing the original archive's authorization.

Nix commands were checked against the pinned 2.24.11 CLI help and signing/verification source. The guide signs approved output closures, publishes a versioned HTTPS cache, isolates the selected key during audits, preserves normal consumer trust settings, and checks fresh-store fetching and revision-pinned substitution. It documents the content-addressed-path trust exception and cache metadata handling during key rotation. No signing keys were generated, Nix configuration changed, or cache upload executed.

## Source and package identity

This record covers the working-tree documentation changes based on commit `5b48d01a7832f3981474800fd6d9b43c77b20152`. The [consumer landing page](../consume.md) links to every supported profile. Support states and the verification date in [consumer-support.v1.json](../consumer-support.v1.json) are unchanged.

Node and browser examples install the existing `onboarding-small@1.0.0` author archives without rebuilding them:

| Artifact | SHA-256 |
| --- | --- |
| Component archive | `2e493b63a5581c7006704b236612f180ddbc60e2cab60e5e0a97815ef4c83383` |
| Runtime archive | `364eea29a4471c5f8cf3026e1f3b5e58b733ae932ba9e9e52f0ae4dacad5c6c1` |
| Component receipt | `63e7a135df3714c203c77fb7fd43b5e2627c9a47072d58c92b34de86022cc660` |

The richer native, managed, PHP, and WASI examples use cached Alpha binaries and the current public documentation fixtures. These local runs do not establish a new pinned release build or a new support profile.

## Executed examples

| Consumer | Result and environment |
| --- | --- |
| JavaScript and TypeScript | Passed exact installed author archives, strict declarations, rejected input types, and numeric validation. Node 22.23.2; TypeScript 5.9.3. |
| Browser JavaScript, React, workers | Passed in Chromium 152, Firefox 153, and WebKit 26.5. Includes production and StrictMode React, worker cleanup, missing assets, reload recovery, and prefixed binary URLs. |
| Python, Rust, C, C++ | All four documentation programs and existing conformance/benchmark checks passed in a disposable Ubuntu environment with glibc 2.39. C/C++ consumers used extracted archives. Cached native libraries produced a `manylinux_2_36` wheel; the documented pinned release remains `manylinux_2_38`. |
| C# / .NET, Java, Kotlin, Ruby | All four programs and the full managed suite passed from original NuGet, Maven, and RubyGems artifacts. .NET SDK 8.0.424, JDK 22.0.2, Kotlin 2.0.21, Maven 3.9.9, Ruby 3.3.12, glibc 2.41. |
| PHP-Wasm | Lazy and startup installed consumers passed with PHP 8.4, php-wasm 0.1.0, and Node 22.23.2. |
| WIT / WASI | Extracted archive printed `42` and `73` through its Wasmtime 42 host. Component validation and existing invocation measurements passed in the glibc 2.39 container. |
| Native PHP | PHP syntax passed. Installed execution was not run locally: the cached Nix package is unavailable, and no compiled native Zend extension remains. The native PHP CI job now executes the documentation fixture. |

The 8 September npm archive failed above `2^31 - 1` with `resolved is not a function`. [Scalar ABI 2 acceptance on 9 September](npm-release-hardening-20260909.md) supersedes that result with exact large-integer transport.

## Defects found by the examples

The extracted C++ archive exposed a CMake metadata defect: it advertised an empty `internal` include directory omitted from the archive. Package generation now includes that directory in CMake and pkg-config metadata only when internal headers exist. A regression extracts the archive and compiles a consumer. The change affects package metadata and archive hashes, not the algorithm or ABI.

PHP-Wasm's host wraps evaluated code, which prevents a leading `declare(strict_types=1)` in that context. The executable guide now writes its PHP program to the virtual filesystem and requires that file. Both loading profiles pass with strict typing retained.

Documentation search previously truncated body matches before reaching language pages. It now ranks exact titles and aliases first, title prefixes and words second, and body matches last. JavaScript, TypeScript, browser, React, and worker queries select the combined guide. Language and registry queries have separate primary guides.

## Repository checks and CI

`npm run lint`, `npm run test:docs` (26 tests), `npm run test:contracts` (309 tests), `npm run site:typecheck`, and `npm run site:test` (63 tests) passed with the expanded publishing guides. The strict Lean tutorial proof check passed and rejected both changed-implementation and admitted-proof variants. Native focused checks passed in their compiler-equipped container; the host-only CMake attempt failed because CMake is not installed on the host.

The runtime documentation test requires a visible guide for every supported consumer and compares every annotated runnable code fence with its checked-in fixture. The runtime reference table must match the versioned contract. Publishing checks require a visible recipe and consumer crosslinks for every ecosystem, with the real builders and publication target operations. Existing consumer CI jobs execute the new native and managed examples; the Node job also executes the installed browser tutorial in three engines.

The native runner's new virtual-environment setup was checked with cached Nix Python 3.11.9: it created a venv containing pip 24.0 without downloads. Runners remove their owned temporary directories and preserve reports under `build/`.

Local reports:

- `build/documentation-consumer-acceptance/acceptance.json`
- `build/documentation-native-acceptance/acceptance.json`
- `build/documentation-consumers/managed-container.json`
- `build/documentation-php-wasi-acceptance/summary.json`

## Static site audit

Before the Nix addition, the full root and GitHub Pages-prefixed audits passed in Chromium 152, Firefox 153, and WebKit 26.5: 47 guides, 53 static routes, six Chromium integration gates, and 144 prose-load measurements per deployment base. Maximum JavaScript transfers were 129,801 bytes gzip at the root and 129,871 bytes under the prefix. Those reports remain under `build/react-site-audit/`.

After adding Nix, both static artifacts were rebuilt with 48 guides and 54 routes. The complete documentation and search checks passed again on both bases in Chromium, including three widths, grouped pagination, compatibility anchors, and no-JavaScript article parity. Their current reports are under `build/documentation-site-audit/`.

The Nix page and five changed documentation hubs also passed targeted checks in all three engines on both bases: 36 page checks covering static/hydrated parity, Nix and INI highlighting, Nix search ranking, three viewport widths, and no prose runtime downloads. Results are in `build/nix-documentation-audit/report.json`. All 42 visible source hashes match the published content, and the 36 demo artifact identities remain unchanged. This change has not been committed, pushed, or deployed.
