# npm release hardening, 9 September 2026

Ordinary npm components now use scalar ABI 2 and version-two signed publication. A disposable loopback registry accepted the installed-CLI author workflow, including publication, resume, and installation of the component alone. No public npm package was uploaded.

## Runtime and package checks

The compiled scalar suite exercises Unit, Bool, UInt8/16/32/64, Int8/16/32/64, Nat, Int, Float32, Float, String, and ByteArray. It covers zero-argument functions, mixed four-argument functions, fixed-width overflow, exact 4096-bit integers, NaN, infinities, negative zero, Unicode, embedded NUL, and copied byte-array ownership.

Two concurrently imported packages use identical Lean module and function names, with different implementations. Their calls and zero-argument constants return their own results, `42n` and `43n`, while sharing the same exact runtime dependency.

Loader regressions check one fetch and one initialization for concurrent identical imports, delivery of the hashed bytes to the dynamic linker, descriptor mutation, identity conflicts, retry before linking, and retained failure after partial initialization. Failed calls free their temporary allocations and do not execute the Lean function twice.

Runtime identity includes the loader, scalar contract, prepared JavaScript and Wasm, package metadata, license notices, and deterministic archive policy. Changing the prepared JavaScript changes the runtime coordinate. Components declare one exact runtime dependency.

## Installed publication workflow

The rehearsal uses Verdaccio 6.2.0 on a temporary loopback port with no upstream registry. It creates an ephemeral test account, publishes the CLI archive, and installs that coordinate without lifecycle scripts. Its independent author project has committed Lean source, license text, and publication configuration.

The installed CLI analyzes and builds that project through Docker, then compares two further clean builds. Publication fails while the central runtime is absent. A separate operator supplies the exact runtime archive; the author then publishes only the component. The test supplies hostile project `.npmrc` settings and an ambient registry override. The signed destination remains unchanged.

A completed publication resumes without another upload. A separate consumer installs only `onboarding-small@1.0.0`; npm resolves the exact runtime automatically. Its public calls return `123n`, `true`, and `false`. Source records remove the test remote's user information and query token.

The final end-to-end rehearsal passed under `build/release-hardening-registry-v5/`. It also creates the public signer policy through the installed `lean-bridge-signing-policy` helper. Its CLI archive SHA-256 is `0c6d2ec7ff8560a9cbf1a12acd969d2c7fd2bf27a3c2db11a43a6324fb8019b4`.

The two Docker builds compared 57 files with no differences. They took 433,043 ms and 427,504 ms and recorded the same engine identity, `3c53407bacc25384df5a0010de5c09ae074710d3f9d1f0e8f8056dd5ffc42c57`. Candidate `c17172812231b2bb390e6809b8e58667af303bf6558000ba5e77817b29827e65` binds author revision `399969323df6bfa4c796cb277746064abe369ab0` to that evidence.

Executed command:

```sh
node scripts/check-local-npm-release.mjs \
  --candidate build/release-hardening-cli-v5 \
  --output build/release-hardening-registry-v5 \
  --browsers chromium,firefox,webkit
```

| Published test artifact | SHA-256 |
| --- | --- |
| `onboarding-small-1.0.0.tgz` | `3100fadf33f2daf5f57e72499b002a4d3b6d07965c12d31971f4aaa7d8296463` |
| Shared runtime archive | `6345fc7dcb5c7315a697c750a67d7824242d8a73de051855b36f8e4f847fe32f` |

The runtime coordinate is `@lean-bridge/runtime@0.0.0-abi2.2e51780e057374fea1f6fc268c33a94eef24a7d4f9a6fb733a6a690213c53f0d`. The earlier v3 rehearsal produced identical component and runtime archives. Its records remain under `build/release-hardening-registry-v3/`.

The current repository verifier accepts the final signed receipt against the completed transaction. All 57 artifact files passed a scan for the deliberately injected remote credentials and private-key PEM headers. The rehearsal stopped its registry and removed its temporary account, storage, private key, and installed author/consumer directories after success.

## Browser acceptance

The registry-installed component passed Node, strict TypeScript, and 15 browser scenarios across Chromium, Firefox, and WebKit. The consumer installs the component alone; npm resolves its runtime dependency. Browser scenarios cover production React, development StrictMode, pending unmounts, worker cleanup, failed assets and reload recovery, and plain JavaScript. Remounts reuse the loaded runtime. Browser calls cross the 128-bit boundary; Node calls preserve 4096-bit integers.

The run used Node 22.23.2, React and React DOM 19.2.8, TypeScript 5.9.3, and Vite 8.2.1. Its report is `build/release-hardening-registry-v5/browser/acceptance.json`. Installation from the identical local archives passed the same checks separately, recorded at `build/release-hardening-browser-tarball/acceptance.json`.

## Final archive and schema correction

The final local CLI candidate is `lean-bridge@0.1.0-rc.1`, built at `build/release-hardening-cli-v6/`. Its archive contains 189 inventoried files, is 1,733,587 bytes, and has SHA-256 `bfa79c10a0358c172efd11fc953eb4b41f2b196c725ebe4c90b9a91c06b3d76c`.

The final candidate differs from v5 only in `schema/component-authorization.schema.json`, plus the resulting archive inventory. That schema now describes the component's actual path/size/mode/hash inventory instead of requiring universal-release metadata. CLI installation and signing-policy helper tests pass. The generated authorization, publication plan, signed attestation, transaction, and receipt pass their closed JSON schemas.

## Security and repository checks

Token and OIDC modes are explicit. Tests verify that OIDC never requests `NPM_TOKEN`, calls `npm whoami`, or falls back to a token. A fake npm executable checks the actual child arguments, private working directory, empty global configuration, scope registry override, and removal of ambient `NODE_OPTIONS` and npm credentials. These checks do not exercise live GitHub-to-npm OIDC.

Key-file tests check owner-only permissions, rejected symlinks, policy matching, and dry runs without private-key access. Publication tests reject a missing runtime, archive hash changes, destination changes, and occupied coordinates with different bytes. Receipt tests preserve custom-registry installation commands and completed-transaction state.

The contract suite passes 329 tests. The focused release suite passes 39 tests. The CLI package suite passes five tests. Documentation, site tests, lint, JavaScript checking, and site TypeScript checking pass. The strict Lean tutorial check accepts the theorem and rejects both a changed implementation and `sorry`.

The assembled site contains 12 demos and 60 React routes. All 156 demo and site-artifact tests pass, including the canonical search index and retained compatibility pages. The documentation audit checks all 54 guide routes at three widths with and without JavaScript. Reports remain under `build/documentation-site-audit/root/`.

## Remaining public-release work

Confirm the npm names and scopes, publish the reviewed builder image and signed Nix cache, review runtime provenance and notices, and publish the central runtime. Bootstrap each approved npm package and configure its GitHub trusted publisher before live OIDC acceptance. Complete the project release approvals and run the updated CI workflow remotely.

The local Docker fallback cold-builds the pinned runtime for each clean container. The prepared builder/cache distribution still needs an independent clean-author check. Other ecosystem packages retain their existing publication flows; this work does not publish them.
