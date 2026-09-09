# React-site acceptance and Pages handoff

Date: 9 September 2026. VO1194, within phase 1185 and portfolio plan 1123.

The frozen candidate was built from clean commit `2249a33163c5943f2ffb8dea0e61fce68e404c37`. Both the root-path and `/lean-bridge/` candidates passed full acceptance in Chromium, Firefox, and WebKit. No source push, registry publication, Pages configuration change, or deployment has occurred.

## Corrections made during acceptance

### Docker repository ownership

The old entrypoint exported Git's environment-only `safe.directory` setting. Git accepted the mounted checkout, but Nix 2.24.11's libgit2 reader rejected its different owner. The [pinned Nix implementation](https://github.com/NixOS/nix/blob/2.24.11/src/libfetchers/git-utils.cc#L179-L186) opens the repository directly; [libgit2's ownership check](https://github.com/libgit2/libgit2/blob/v1.8.1/src/libgit2/repository.c#L580-L605) reads the protected configuration.

The entrypoint now adds only the selected source path to the disposable container's global Git configuration. It does not change the host's Git configuration or repository ownership. Read-only source mounts remain read-only. The builder definition and image were regenerated:

- Image: `lean-bridge-builder:35dab9930520eccb`.
- Definition SHA-256: `35dab9930520eccb6cfd17538417b8d2126cb299b3643cf85a324e591666f9d7`.
- Runtime configuration SHA-256: `f1fafe58e820cc3eb6af3c09a7f86b3280bfb0ec11b8a90c81092a31f17d5257`.

`npm run test:builder-ownership` uses the real image, Nix, and foreign-owned disposable repositories with networking disabled. It reproduces rejection under the old setting, accepts the selected source after the entrypoint runs, excludes ignored files, rejects an unrelated repository, and checks that the host Git configuration is unchanged. Docker CI now runs this regression after building the image.

The full scalar Docker CLI build passed compilation and provenance validation. The author tutorial then passed two clean Docker builds with identical inventories across 57 files, receipt verification, and installation into a separate consumer.

Two environment conditions were recorded separately. A cold toolchain fetch was stopped when free space approached 2 GB. The successful runs reused pinned compiler dependencies through a private Nix cache, with copied mutable metadata and shared immutable store files. The current runtime and component were still built through the reviewed image and normal entrypoint. This workspace's private `/tmp` is invisible to its Docker daemon; `LEAN_BRIDGE_DOCKER_STAGING_ROOT` selected a shared directory under `/app/build/` for the author acceptance. The failed tutorial inputs were moved out of `/tmp` into the evidence directory.

### Exact Pages archive and retention

The [pinned Pages upload action](https://github.com/actions/upload-pages-artifact/blob/v4/action.yml) drops hidden files, including the `.nojekyll` file recorded by our build identity. The workflow now uploads a repository-produced tar with `actions/upload-artifact@v4`, under the existing `github-pages` artifact name. Both deployment artifacts and audit reports are retained for 30 days.

`npm run demos:archive` verifies the clean source identity and every listed file before taking a private snapshot. It rejects a different revision, changed or missing files, extra files, overlapping inventory records, and symbolic links. It verifies the snapshot again, writes deterministic tar metadata, and refuses to overwrite an existing archive directory. Twelve tests exercise preservation, rejection, restoration, deterministic output, and CI wiring.

The evidence follow-up raises the CI build deadline from 30 to 45 minutes. Locally, the proof/demo gate took about 4.5 minutes, the portfolio browser suite 6.5 minutes, and the root documentation suite 16 minutes. Toolchain bootstrap and browser installation need additional time. Test timeouts, workload sizes, and benchmark assertions are unchanged. This deadline and its test are outside the frozen public artifact.

## Executed gates

| Gate | Result |
| --- | --- |
| Twelve Lean/C/Wasm builds | Passed; all 261 required theorem entries retained. |
| Demo and assembled-site suite | 156 tests passed. |
| Algorithm benchmarks | All twelve assertion suites passed with unchanged budgets. |
| Core checks | Environment check, lint, typecheck, and 342 contract tests passed. |
| Documentation contracts | 44 tests passed; generated references match their source contracts. |
| Site checks | Typecheck and 81 tests passed, including 12 archive checks. |
| Strict tutorial proof | Original proof has no axioms; changed implementation and admitted proof both rejected. |
| Targeted builder contracts | 16 tests passed; real ownership regression passed separately. |
| Clean installed author | Two Docker builds matched across 57 files; exact archives verified and executed. |
| Installed React and workers | All 15 observations passed across three browser engines. |
| Installed reference examples | Four unchanged examples, exact declarations, strict TypeScript, scalar boundaries, and three browsers passed. |
| Portfolio browsers | 36 demo/browser combinations and seven Chromium integration scripts passed. |

The browser engines were Chromium 152.0.7977.75, Firefox 153.0, and WebKit 26.5. Node was 22.23.2; Lean was 4.32.2 at commit `f3b06c705e6c85f5314019d5d3baab0fec5b580c`. Archive construction and restoration ran with GNU tar on Linux.

Each candidate passed all 83 routes, 17 top-level checks, and 207 measured landing/documentation loads. Maximum measured JavaScript gzip size was 137,735 bytes at `/` and 137,818 bytes at `/lean-bridge/`, below the 200 KiB limit. Each reading check covered 68 guides at 320, 390, and 1440 pixels: 204 layouts, 924 code/table container observations, and 501 overflowing containers with reachable contents. Both passed 34 historical section-link visits, no-JavaScript text parity, grouped navigation, and four concept-to-workbench links, with no page errors or failed requests.

Lifecycle checks preserve editing, undo/redo, touch and keyboard input, reduced motion, visibility restoration, pending-load retirement, retry, proof controls, and prewarmed 100-sample benchmarks. Repeated route visits release all prepared handles. Myers' twelve measured cycles retain stable DOM/listener counts and constant Wasm linear memory; the other workbenches pass six balanced route lifetimes each. Prose routes request no Wasm or benchmark workloads before an explicit example launch.

All 36 maintained Wasm binaries, runtime loaders, and proof receipts match commit `3e764d247fdc353f5703dee06424c52b77cfa3a0` byte-for-byte in both candidate artifacts. Lean sources, algorithm interfaces, and benchmark workloads did not change.

## Prepared package identities

| Archive | SHA-256 |
| --- | --- |
| `onboarding-small-1.0.0.tgz` | `20fca158be44a032b6d64670517fa0b1b72c17d6e41d3ac59fe2ed1883706444` |
| `onboarding-scalars-1.0.0.tgz` | `73984578959a0710f4a84de0eb8aeb12948750c2f8612670ebce62c0f3c555c9` |
| Shared runtime archive | `6345fc7dcb5c7315a697c750a67d7824242d8a73de051855b36f8e4f847fe32f` |

The common runtime coordinate is `@lean-bridge/runtime@0.0.0-abi2.2e51780e057374fea1f6fc268c33a94eef24a7d4f9a6fb733a6a690213c53f0d`. Checks include arithmetic beyond `2^4096`, fixed-width rejection, Unicode and embedded NUL, float rounding and negative zero, copied bytes, and repeated imports. These runs install local archives with lifecycle scripts disabled. They do not claim a new registry publication or registry-only installation; the [earlier registry rehearsal](npm-release-hardening-20260909.md) owns that evidence.

## Static artifact identities

All paths below are relative to `build/pages-cutover-20260909/`. Every inventory entry was checked again after restoring its tar into a separate directory.

| Artifact | Source commit | Base | Routes / files | Tar SHA-256 |
| --- | --- | --- | --- | --- |
| `candidate-archive/artifact.tar` | `2249a33163c5943f2ffb8dea0e61fce68e404c37` | `/lean-bridge/` | 83 / 407 | `b503b99f4fefdac736ec039286b32b71b3f5cd1c68787a994ec90b49de889acb` |
| `root-archive/artifact.tar` | `2249a33163c5943f2ffb8dea0e61fce68e404c37` | `/` | 83 / 407 | `f6e3817d5ac59dad83ff5a3db1a49b5d5243ab9c1c667a62ad8b0061a7f5a370` |
| `fallback-archive/artifact.tar` | `3e764d247fdc353f5703dee06424c52b77cfa3a0` | `/lean-bridge/` | 69 / 379 | `165f18ddf21d313a15e5f21c671ff35cdf34a73aa4bc857c734e00ba59f8a3ba` |

The candidate tar is 22,917,120 bytes. Its `build-identity.json` SHA-256 is `aaafc7fad7491b2892716a827fb37f56faa14d2b9d221e2f5e169f394e593806`. The root identity is `44c08e8a243ca25499ac4e7aceb15357bcda111037e161df899e15fb9b355fd5`; the fallback identity is `c1ac84c0f291446d78266b0e5fdd2c1bebde36ec2ede987edf27f5777bfeaa20`.

Repacking the candidate after the complete browser suite produced the same tar and report byte-for-byte in `build/pages-artifact/`. Compressed transport copies retain the exact tar contents: `candidate-pages.tar.gz` has SHA-256 `21c4a6aa01f32afbc2ca5b75cd71abb2ef49aa7c2b56c1f8be828d2877605cce`; `fallback-pages.tar.gz` has SHA-256 `a88ecdadf4a66ca5e83ce2673b85e8132a5d3cca3fa28269802e26be45059eef`.

The fallback was rebuilt from a clean detached checkout, then passed its own 69-route three-browser suite, 36 demo/browser combinations, and archive restoration check. Its reports are retained in `fallback-audit/`; the temporary checkout was removed. The pre-acceptance working-tree artifact and its earlier reports are also retained separately. Neither is described as a previously deployed site.

## Publication handoff

The [machine-readable handoff](react-site-handoff-20260909.json) records all archive identities, executed gate counts, and the remaining publication authority.

Read-only GitHub checks found `has_pages: false` for `seanmorris/lean-bridge`. Remote `master` was `29a4ff8c876ddfb7f4622c9120d95dfa849a2c22`. The Pages workflow was not present on that remote branch. This is a first-deployment handoff, not a replacement of a verified live deployment.

VO1145 requires explicit authority to push the intended revision, configure Pages and environment protection, and deploy from CI. Its operator must review the archive from that exact CI run, deploy that same uploaded artifact, then verify the public routes, legacy aliases, proof integrations, raw downloads, and deployed hashes. A CI rebuild has a new build identity and archive hash; it must not silently replace this local candidate's recorded identity.

Retain the successful CI run ID and its artifact for approved rollback. Re-running only that run's deploy job consumes its existing archive. For a first deployment, the tested local fallback above is available, but no previous live artifact exists. The [contributor Pages guide](../contributing/github-pages.md) documents packaging, review, retention, and recovery.

Local acceptance evidence is under `build/pages-cutover-20260909/`. Browser reports are under `build/demo-browser-audit/`, `build/react-site-audit/{root,prefixed}/`, and `build/documentation-site-audit/{root,prefixed}/`. Installed-package reports are in `author-acceptance-shared/`, `consumer-acceptance/`, and `reference-acceptance/` within the evidence directory.
