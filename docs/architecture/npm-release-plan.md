# First npm release

The release will provide an installable CLI, a shared runtime, and one maintained example component. An author will build and publish an ordinary Lake project through the installed CLI. A JavaScript consumer will install one component and call its public exports without Lean tools or runtime setup.

The proposed CLI coordinate is `lean-bridge@0.1.0`, preceded by a release candidate under `next`. Ownership of that name and the runtime/example scope must be confirmed before publication. The local candidate name is configured in [the CLI source manifest](../../config/cli-package.v1.json).

## Standalone CLI packaging

Implemented:

- A dedicated deterministic CLI tarball and a per-file hash inventory.
- A source allowlist shared with the private development package.
- Rejection of credential paths, path traversal, and symlinked source inputs.
- Package metadata without development dependencies or install scripts.
- CLI version reporting from the installed package metadata.
- Local, global, and `npm exec` tarball-install tests.
- Analysis from an unprivileged process with a read-only installation.
- Build-engine identity checks against the reviewed source boundaries.
- Optional inclusion of a prepared runtime for local author acceptance.
- Build staging beside the requested output and Docker/Nix caching outside the installation.
- An installed-author acceptance runner and a consumer CI step.

The runtime option copies prepared `main.mjs` and `main.wasm` files. The package includes runtime and toolchain notices. Copying prepared binaries does not certify their provenance. A candidate with no runtime is suitable for source-packaging tests only.

See [contributor packaging checks](../contributing/testing.md#standalone-cli-package) for the commands.

## Local acceptance, 2026-09-09

The installed-CLI rehearsal now uses a disposable loopback npm registry with no upstream registry. It installs the CLI by package coordinate, compiles an independent committed Lake project through Docker, compares two builds, and publishes the component through the installed CLI.

The rehearsal verifies that a missing central runtime blocks publication. After a separate runtime publisher supplies that exact dependency, component publication succeeds despite hostile project and environment npm configuration. A completed transaction resumes without republishing. A separate consumer installs the component alone and calls its generated API.

The scalar acceptance tests compile all 16 supported primitive types, zero-argument and multi-argument functions, 4096-bit integers, Unicode strings, and copied byte arrays. They also import two independently compiled components concurrently into one runtime, with overlapping export names and different results. The earlier large-`Nat` failure is fixed.

The acceptance runner and its browser companion record exact candidate identities, commands, and outcomes. Reports from the release-hardening run live under `build/release-hardening-*`. The [release-hardening evidence](../evidence/npm-release-hardening-20260909.md) lists the tested artifacts.

The consumer workflow now runs the disposable-registry rehearsal in CI. The updated workflow has not run remotely. No public npm package has been uploaded.

## Runtime and builder distribution

Implemented:

- One scalar capability contract for analysis, adapter generation, package validation, and runtime calls.
- Typed C adapters and a copied binary frame. `Nat` and `Int` cross the boundary as exact 32-bit limbs, without a 64-bit ceiling.
- Rejection of unsupported ordinary-component signatures before packaging. The existing universal-package path remains separate.
- Once-verified Wasm bytes passed to the loader, promise caching before asynchronous work, component identity conflict checks, and serialized dynamic linking.
- Runtime exports derived from the pinned Lean archives, plus an audit of each component's actual Wasm imports.
- Runtime coordinates derived from shipped code, Wasm, metadata, notices, and archive policy. Components depend on that exact version.
- License and notice inventories, credential-free source identities, and central-runtime byte checks before component publication.

Remaining distribution work:

1. Publish the pinned builder image by digest and provide the corresponding signed Nix cache and authenticated trust key.
2. Exercise automatic asset resolution on a clean author machine against those published endpoints, including cache reuse.
3. Review the runtime's provenance and notices, then publish its exact coordinate centrally.

The local Docker fallback rebuilds the pinned runtime in each clean container. The release must provide the prepared builder/cache path before claiming a fast first-author experience.

Acceptance: a clean author environment needs Node, Git, and a supported builder, with no checkout or manual runtime path. A consumer needs only the host package manager and application runtime.

## Ordinary component publication

Implemented in version 2 of the component publication plan:

- The shared durable registry executor signs and publishes the approved component bytes. Authorization records the actual component, source revision, and two-build evidence without inventing a flake lock for the author project.
- CLI configuration selects the registry, tag, access, token or GitHub OIDC mode, public signer policy, and environment variable naming an Ed25519 key file.
- The installed `lean-bridge-signing-policy` helper creates a public policy from a public key. Dry runs do not read private keys.
- npm runs in a private working directory with explicit user/global configuration, a pinned scope registry, and lifecycle scripts disabled. Ambient npm tokens, configuration, and `NODE_OPTIONS` do not reach that process.
- OIDC preflight defers authentication to publication, checks the Node/npm version floors, and never falls back to a token or `npm whoami`.
- The publisher checks the centrally supplied runtime, rejects byte collisions, preserves a signed receipt, and resumes completed transactions without rewriting their receipt state.
- Ordinary component authors use their own signer and registry authority. Lean Bridge's project production approvals do not govern their packages.

The disposable registry exercises token publication. Live GitHub OIDC acceptance still requires an owned npm package and its configured trusted publisher.

## Bootstrap each new npm package

An npm user receives a personal scope. An organization can use npm's free plan for unlimited public packages; private packages require a paid plan. [Scopes](https://docs.npmjs.com/about-scopes/), [organization plans](https://docs.npmjs.com/creating-an-organization/).

Use a maintainer-authenticated initial publication for each new package, after the artifact passes review. Configure its GitHub trusted publisher after that package exists. Subsequent releases use OIDC from the authorized workflow. A token-authenticated CI bootstrap is another option, but this plan does not provision a temporary publication token.

Publish the approved release candidate under `next`, not an empty placeholder. Keep the development root private. Inspect and upload the dedicated tarball, then download the registry copy and compare hashes.

npm's trusted-publisher setup configures trust on the package. Staged publishing also requires an existing package and cannot bootstrap a brand-new coordinate. [Trusted publishers](https://docs.npmjs.com/trusted-publishers/), [staged publishing prerequisites](https://docs.npmjs.com/staged-publishing/).

The CI integration must use a compatible npm/Node version and approved GitHub environment. It cannot use `npm whoami` as an OIDC readiness test because that authentication occurs during publication. npm provenance and Lean Bridge's signed receipts remain distinct records.

## Approval and public acceptance

Complete the existing [project release approval policy](../../src/release/README.md#project-release-approval-policy): full CI, external reconstruction, human clean-room sessions, an operated npm sandbox release, and security/assurance review. Record actual reviewer decisions for the exact deployment profile and candidate.

Public acceptance downloads and installs the approved archives from an empty cache, checks their identities, and runs the documented examples. A stable version follows the successful release candidate. Do not rebuild or rename an already approved archive during publication.

## Documentation switch

After public-registry acceptance succeeds:

- Start author setup with installation of the released CLI.
- Use the real maintained package in consumer examples.
- Document the supported publisher command and authentication flow.
- Move local archive handoffs to advanced/offline instructions.
- Keep checkout builds, fixture generation, and release administration under Contributing.
- Run copyable documentation examples against registry-installed packages in CI.

Other language guides will use real versioned release artifacts until their registries are populated. Publishing the CLI on npm does not publish the generated Python, Rust, JVM, or other ecosystem packages.
