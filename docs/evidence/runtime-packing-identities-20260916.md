# Shared runtime packing identities, 2026-09-16

VO1240 extends the CPAN coordinate audit to ordinary npm and PHP-Wasm runtime packages. This follows `31c920e`, which fixed the CPAN corruption tests for unprivileged CI runners.

## Findings and changes

The npm runtime version previously included payload and archive-implementation hashes but omitted the package generator and host packing environment. A generator change could alter serialized package metadata without changing its coordinate. PHP-Wasm already bound its generator, but omitted the host environment and the raw bytes of `runtime.json`. Its compiled-runtime identity hashes the parsed manifest, so a formatting-only edit could change the packaged bytes under the same version.

All three runtime package formats now use `tarGzipPackingIdentity`. It records the archive implementation hash, Node/zlib/ICU versions, platform, architecture and resolved default collation locale. The fixed archive timestamp remains in each package's packing record. These are conservative producer identities: a changed record selects a different runtime version even if that environment would happen to emit identical compressed data.

The npm runtime basis also hashes its package generator and records mode `0644` for each payload file. Its archive is assembled from the same byte snapshots used to derive the version. PHP-Wasm retains `runtime/package/runtime-identity.json`, including a hash of the exact compiled manifest bytes, and normalizes its npm archive modes to `0644`. CPAN reuses the common host record and retains its existing mode `0644` snapshots, payload-derived version and exact prerequisites.

Component packages pin the generated runtime version exactly. Unrelated libraries built with the same runtime inputs and producer environment can share that archive. Changing component metadata or API selection does not change the shared runtime.

## Producer and consumer checks

The PHP-Wasm package-set reader reconstructs generated files and archives, so it requires the recorded packing environment. Its mismatch diagnostic points callers to the portable package-set receipt when they only need to verify downloaded bytes. CPAN archive assembly likewise checks its recorded producer environment.

The installed Node-only CLI and copied npm verifier check the original archives by hash and length without reconstructing them. They do not require the producer's packing versions or compiler. Consumer package managers retain their existing dependency and installation flows.

The npm, CPAN and PHP-Wasm publishing guides document the producer constraint. Python and WIT publishing pages now show the existing package-set receipt command instead of calling verification unfinished. The architecture guide also removes stale receipt and PHP-Wasm browser/lazy-loading status.

## Acceptance

- Both npm package tests pass, including independent byte reproduction and installed public calls. A child process with a simulated changed zlib identity produces a different runtime coordinate and archive hash; the original host still verifies its receipt. The installed scalar suite also passes, preserving runtime sharing between two different components, exact integers, IEEE values, Unicode and copied bytes.
- All 46 Perl contract checks pass as `nobody`. The shared helper tests each host-version/platform/architecture field and starts separate processes with English and Swedish locales. These checks simulate changed environment identities; they do not claim execution on another operating system or zlib build.
- The installed Perl suite passes all 183 consumer assertions through prebuilt and XS-only paths in 136.5 seconds.
- All 19 signed npm publication checks pass in 277.2 seconds.
- All five PHP-Wasm descriptor tests pass.
- The complete ordinary PHP-Wasm suite passes in 244.1 seconds, without skips. Willow and Aspen reproduce their archives independently, retain the same shared runtime archive, and execute all 88 exports in seven installed Node arrangements plus Chromium startup/lazy modes. Copied receipts verify after relocation. The new tests confirm that reformatting the raw runtime manifest changes the archive version without changing the compiled-runtime identity; altered packing records and re-sealed identity files are rejected, while filesystem executable bits do not alter normalized archive bytes.
- Telemetry's combined npm/CPAN build passes in 129.2 seconds. It reproduces four archives, installs and calls both APIs after source removal, and verifies relocated receipts with Node alone. Separate npm-only and CPAN-only selections also pass.
- All four target selections combining npm, native PHP and PHP-Wasm pass in 310.1 seconds. They retain one compilation per ABI, installed calls, relocated receipt verification and source API identity `73e9e4629ce4fb494dd34fddfc12c4f933bc555fc604db4068ffec79a94fb298`.
- Core checks pass 699 tests with 52 gated skips. Documentation passes 65 checks, CLI archive installation five, and site/demo tests 111. Lint, checked JavaScript, the type inventory, all 16 generated reference pages, site typechecking and production site generation pass. Type coverage remains 656 installed-tested cells; two evidence hashes were refreshed without promoting support claims.

The first PHP-Wasm attempt failed because the new formatting test selected the original two-space indentation and changed no bytes. The corrected test uses compact JSON. Only the complete successful rerun above counts as acceptance. Local native checks use the explicit glibc 2.36 test override; the production floor remains 2.38. Mixed-profile checks use real compilers through the existing injected Nix command transport; they do not count as a local Nix execution.

The local producer uses Node 22.23.2, zlib `1.3.1-e00f703`, ICU 78.2, Linux x64 and `en-US` collation. Willow and Aspen share PHP-Wasm runtime archive SHA-256 `c04f0e88a6522fab805a619907eb1f5950df4fea2cecdd752ef6d94b6497cf94`; the compiled-runtime identity remains `cf6fd0c4430e142677d32ae69d2f0585c667c1fcabb4b26a43c4d68789b48c5c`.

## CI follow-up

Core CI on `31c920e` passed. Its pinned Nix Perl engine built the package successfully, but the installation job still requested `LeanBridge-Runtime-0.001.tar.gz` and failed with `ENOENT`. The workflow now reads both runtime and component archive names from `native-release.json`. An executed regression substitutes different versions and a different component name. The extracted shell block passes Bash syntax checking and ShellCheck. Nix itself is unavailable locally; the next CI run must confirm the actual Nix installation step.

## Remaining work

No registry publication is part of this change. VO1240 still needs the publication-recipe and signed Nix audit; VO1217's shared type corpus follows that work. Conversion behavior and installed type-support claims are unchanged.
