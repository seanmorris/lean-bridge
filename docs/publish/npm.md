# Build and publish JavaScript and TypeScript packages

An ordinary Lean component uses `lean-bridge publish` to reproduce, sign, and upload its exact npm archive. Consumers install the component; npm resolves its shared runtime automatically.

For ordinary-source builds, declare the library's [description, authors and URLs](../publishing.md#declare-package-metadata) once in `lean-bridge.exports.json`.

## Build with locked Lake dependencies

Keep the project's reviewed `lake-manifest.json` and exact `lean-toolchain` in source control. Populate its dependency cache during normal Lean development before invoking the bridge. Git entries must identify full commits, and cached checkouts must match those pins without modified or untracked source files. Local path dependencies must be relative and available when you start the build.

Build the selected public API with the usual command:

```sh
lean-bridge build --project /path/to/library --target npm --output /path/to/new-build
```

The CLI captures the root project and locked dependency files without running Lean. It verifies cached Git objects and hashes local contents, then passes the snapshot and selected module names into the Nix or Docker engine. The engine resolves imports through Lake, compiles fresh interfaces, and derives the public signatures from Lean before generating adapters and linking one component Wasm. Aliases, notation and inferred result types resolve through the compiler. It neither fetches packages nor updates your lock. Planning requires Node and Git; compilation uses the engine's Lean installation.

The build bundle includes captured sources under `bundle/lake/`. Its component and compilation plans record `source.lakeSnapshotSha256`; `locks/lean-target-c-manifest.json` records the snapshot, resolved order, compiler identity, and fresh interface hashes. Changed dependencies during the build reject its output. Installed JavaScript consumers need only the prepared component and its runtime package, without Lake or dependency checkouts.

`publish --dry-run` supplies the verified dependency snapshot to both independent clean root checkouts. It checks each checkout against the captured root files and rechecks the original dependencies before authorizing the candidate. Keep the local packages and cached Git checkouts available throughout that command. Root files must match the committed revision; local dependencies are identified by their captured contents.

This path supports Lean dependency imports, including transitive packages and custom source directories in root and dependency libraries. Use explicit [module selection](../lean/existing-package.md#select-modules-in-a-custom-source-directory) for a custom root layout. [Declared C inputs](../lean/existing-package.md#declare-c-link-inputs) compile with the WASM profile; `locks/side-module-link-manifest.json` records their compiler, include closure, and object hashes under `nativeCompilation`.

Locked builds also accept [declared `lean-text-v1` generators](../lean/existing-package.md#generate-lean-and-c-sources). The engine runs selected pure tools and compiles their Lean/C/header outputs. `bundle/generated/lake-generated-sources.json` retains their bytes and receipts; the target-C and link manifests bind its digest. The publication dry run reproduces generation in both isolated builds. Installed npm users do not need Lean or generator tooling.

A generator can also produce a [selected public entry module](../lean/existing-package.md#generate-the-public-entry-module). Captured and generated public modules use the same source-only request and compiler-owned signature discovery. `bundle/metadata/lake-entry-exports.json` binds those types to the capture, any generated outputs, compiler and interfaces; target compilation checks the record again. The same build and publication commands apply. npm accepts copied primitives, nested arrays, acyclic records and synchronous primitive callables. Copied containers and callables currently require separate components.

To compile an [explicit reviewed contract](../lean/existing-package.md#compile-a-reviewed-contract), keep one `.binding-ir.json` file and set `modules` in `lean-bridge.exports.json`. Put declaration selection in the review, not `exports` in the configuration. The engine checks reviewed copied-value and primitive-callable signatures against fresh Lean metadata, retains documentation and argument names, and binds the review into its compiler request and package evidence. `analyze` alone validates the document without checking source correspondence. Prepared npm packages use the same installation and automatic runtime loading as ordinary-source packages.

To publish concrete versions of generic Lean functions, configure [finite specializations](../lean/existing-package.md#export-concrete-specializations). Lean checks the selected types and instance dictionaries; each configured name becomes a concrete JavaScript/TypeScript function. The source configuration and compiler applications travel with the build bundle and publication receipts.

Optional [export contracts](../lean/existing-package.md#declare-export-contracts) can declare copied primitives and containers, call-scoped borrowed callbacks and explicitly owned returned functions. Lean checks ownership and effects against the implemented synchronous boundary. Unsupported requirements stop the build before linking; package assembly and publication retain the captured configuration.

Missing pins, source drift, symlinks, package overrides, ambiguous modules, undeclared custom targets, prebuilt native libraries, precompiled modules, and extra compiler/linker flags fail explicitly. Reviewed foreign-function contracts still need builder support. See the [locked npm build evidence](../evidence/lake-wasm-workspace-20260911.md), [C-input acceptance](../evidence/lake-c-inputs-20260911.md), and [generated-package acceptance](../evidence/lake-generated-packages-20260912.md).

## Export callbacks and returned functions

Callback arguments and returned functions can use any of the nineteen supported primitives. Each callable accepts one to sixteen arguments. For example:

```lean
namespace Functions

def apply (value : UInt32) (callback : UInt32 → UInt32) : UInt32 :=
  callback value

def makeAdder (captured : UInt32) : UInt32 → UInt32 :=
  fun value => captured + value

end Functions
```

Lean function types are curried. Set the outer arity of `makeAdder` to one so the generated API returns a function instead of accepting both arguments at once:

```json
{
  "schemaVersion": 1,
  "modules": ["Functions"],
  "exports": ["Functions.apply", "Functions.makeAdder"],
  "arities": { "Functions.makeAdder": 1 }
}
```

Build and publish with the same commands as a scalar component. The package declares its exact shared-runtime dependency; consumers do not register callback dispatchers or configure Wasm imports. Older prepared runtimes are rejected during packaging with a rebuild diagnostic.

Callbacks are borrowed until the enclosing call returns. Returned functions own an explicit lease and expose `dispose()`, `disposed` and `Symbol.dispose`. Read [values and cleanup](../javascript-typescript.md#values-and-cleanup) for consumer usage. Promise-returning callbacks, retained host callbacks, and compound callable arguments or results are unsupported. A reviewed contract supplies the same arity through its parameter list and returned callable type; do not repeat export decisions in its configuration.

## Build npm and CPAN together

Select both targets to build the same ordinary Lean API for JavaScript and Perl:

```sh
lean-bridge build --project /path/to/library --target npm --target cpan --output /path/to/new-release
```

Install the npm build engine and the [native CPAN toolchain](cpan.md#build-an-ordinary-lean-project). The command uses the CLI's prepared Wasm runtime and the selected native Lean compiler and Perl interpreters. Keep npm and CPAN package names under `targets.npm` and `targets.cpan` in the same `lean-bridge.exports.json`.

The builder captures the source tree and Lake dependencies once, compiles one Wasm component and one native component, then checks that both profiles expose the same source API. That comparison includes types, ownership, effects, specialization choices and export contracts. Each profile also retains its compiler and artifact evidence. Both must succeed before the output directory appears; a failed or cancelled build releases neither package set.

| Output | Contents |
| --- | --- |
| `packages/npm/` | Component and runtime `.tgz` archives, npm receipt and standalone verifier |
| `profiles/wasm/` | Wasm bundle and compiler execution evidence |
| `profiles/native/archives/` | Component and runtime CPAN `.tar.gz` archives and receipts |
| `profiles/native/native/` | Compiled native component, runtime and checked metadata |
| `multi-profile-release.json` | Shared source/API identity and both profiles' package and evidence hashes |

Verify the npm handoff with `lean-bridge verify --receipt /path/to/new-release/packages/npm/component-package-receipt.json`. Install the CPAN archives using the [prepared-package instructions](../consume/perl.md).

Add `--target c` or `--target cpp` to include [prepared native C/C++ archives](c.md#build-an-ordinary-lean-project). Those targets share the same native compilation with CPAN. You can also omit CPAN and build npm with either C-family target; no Perl installation is needed in that case.

The selected exports must fit both profiles: copied primitives, nested arrays, acyclic records or synchronous primitive callables, including supported concrete specializations. Copied containers and callables cannot share one npm component yet. Source-configured closure arities still require separate target builds. Resources also use a separate native build. Unsupported targets or incompatible APIs fail explicitly. This command prepares archives; publish them using the npm instructions below and the [CPAN publication steps](cpan.md).

## Publish an ordinary component

Install the prepared CLI candidate using [author setup](../lean/setup.md#install-a-prepared-cli), then complete [your first component](../lean/first-component.md). Set [shared license terms](../publishing.md#declare-license-terms) in `lean-bridge.exports.json` and commit the nonempty terms files. The publication check accepts declared `package.licenseFiles` paths, or conventional `LICENSE`, `LICENCE`, `COPYING` and `LICENSES/` files, including nested paths and case variations. A `NOTICE` or `COPYRIGHT` filename alone does not identify license terms. The source `package.json` remains an npm-only license fallback; if both declarations exist, they must match exactly.

The publication check matches every root notice and its bytes to the captured source inventory. It also binds the shared configuration and any source `package.json` license declaration to their captured bytes. Commit license changes and rebuild the candidate; editing the SBOM or release files invalidates the evidence.

The runtime is published centrally by Lean Bridge. Your publisher checks that its exact dependency coordinate and tarball hash already exist in the selected registry. It does not upload the runtime under your credentials. A missing or different runtime blocks publication before the component upload.

The generated runtime version binds its payload, package generator and packing environment. `runtime/package/runtime-identity.json` records the file hashes, fixed modes and timestamp, archive implementation, Node/zlib/ICU versions, platform, architecture and default collation locale. Reproduce archives in that recorded environment. A different environment selects a different runtime version, which must also exist in the chosen registry before component publication. Installing or verifying downloaded packages does not require the producer's packing environment. See the [runtime packing audit](../evidence/runtime-packing-identities-20260916.md).

### Choose the npm name and version

Set the npm coordinate in `lean-bridge.exports.json` at the Lean project root. Use a name or scope you own:

```json
{
  "schemaVersion": 1,
  "targets": {
    "npm": {
      "name": "@your-org/your-component",
      "version": "0.1.0"
    }
  }
}
```

Merge `targets` into your existing file if you already [configure exports](../lean/existing-package.md#configure-exports). Either setting is optional; omitted values use the component's name and version. Declaring `targets.npm` does not select a build target; use `--target npm`.

Names must be lowercase npm names of at most 214 characters, including the scope. Unscoped names must start with a letter or digit. Use an exact version such as `0.1.0` or `0.1.0-beta.1`. Ranges and tags are not versions. Lean Bridge rejects `+build` metadata because npm removes it when publishing. The component cannot use the reserved runtime name. [npm package name and version rules](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#name).

These settings change the generated npm package while preserving the Lean library's identity in proof and build metadata. Package assembly reads them from the sealed build bundle. The receipt records both identities; use `lean-bridge verify` to check its archives. Publication checks the coordinate against the bundled settings before signing. Commit changed settings and create a new candidate instead of editing a prepared archive.

### Configure signing

Use an Ed25519 signing key from your release process. To create a new key, set `COMPONENT_SIGNING_KEY_FILE` to a new file in a private directory outside your repository, then run:

```sh
node --input-type=module -e '
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync } from "node:fs";
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
writeFileSync(process.env.COMPONENT_SIGNING_KEY_FILE,
  privateKey.export({ type: "pkcs8", format: "pem" }), { flag: "wx", mode: 0o600 });
writeFileSync("publication-public.pem",
  publicKey.export({ type: "spki", format: "pem" }), { flag: "wx" });
'
lean-bridge-signing-policy \
  --identity https://example.com/your-release-team \
  --public-key publication-public.pem \
  --output publication-signer-policy.json
```

Use your release team's actual identity. The helper reads only the public key and prints the policy hash. Give recipients that hash through a trusted channel so they can authenticate your receipts. Keep the private key outside commits, archives, and logs. On Unix, the publisher rejects group-readable or world-readable key files and symlinks.

Create `lean-bridge.cli.json` in the source project:

```json
{
  "schemaVersion": 2,
  "publish": {
    "npm": {
      "registry": "https://registry.npmjs.org/",
      "tag": "next",
      "access": "public",
      "authMode": "token"
    },
    "signing": {
      "policyFile": "publication-signer-policy.json",
      "keyFileEnvironment": "COMPONENT_SIGNING_KEY_FILE"
    }
  }
}
```

For a rehearsal, replace the registry with your loopback endpoint. Commit this configuration and the public policy. `policyFile` is relative to the configuration file; `keyFileEnvironment` names an environment variable containing the private-key path, never the key itself.

### Reproduce and publish

From the committed source project, create a new candidate:

```sh
lean-bridge publish --project . --target npm --dry-run \
  --output build/npm-release-gate
```

The dry run builds two independent copies, compares their bytes, and binds the registry, tag, access level, authentication mode, and public signer policy into the version-two manifest. It reads no registry credentials or private key and performs no registry upload.

Review the candidate. For token mode, supply `NPM_TOKEN` through your secret manager and export `COMPONENT_SIGNING_KEY_FILE`. Then execute the same manifest from the project directory:

```sh
lean-bridge publish --manifest build/npm-release-gate/publish-manifest.json
```

The publisher signs the authorization, verifies the runtime dependency, uploads the approved component tarball, and downloads it to confirm its hash. It records `registry-transaction.json` and a signed `release-receipt.json`. Run the same command to resume an interrupted transaction; an already completed transaction is checked without another upload or changes to its signed state.

Changing the destination or signing policy requires a new dry run. Project `.npmrc` files, ambient npm configuration, lifecycle scripts, and default tags cannot override the manifest. These author publications do not require Lean Bridge's internal production-release approvals.

### GitHub trusted publishing

Set `authMode` to `oidc` before creating the candidate. Configure the package's npm trusted publisher for the exact GitHub repository and workflow. The publisher requires Node 22.14.0 or newer, npm 11.5.1 or newer, and GitHub's `id-token: write` permission. Configure each new package after its initial authorized token publication. [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/).

OIDC mode uses the workflow's identity-token endpoint, does not call `npm whoami`, and does not fall back to `NPM_TOKEN`. The Ed25519 receipt-signing key is still required. npm provenance and Lean Bridge's signed receipt are separate records.

## Other package and operator flows

The following recipes cover repository fixtures and direct npm uploads. A direct `npm publish` does not create Lean Bridge's signed transaction records. Publish the reviewed `.tgz`, then download the registry's copy and compare its bytes. [npm publish reference](https://docs.npmjs.com/cli/v11/commands/npm-publish/).

## Choose the package and its owner

Lean Bridge produces three different npm handoffs:

| Build | Package set | Preparation |
| --- | --- | --- |
| Ordinary Lean component | Component plus its exact `@lean-bridge/runtime` dependency | [Local package handoff](local-handoff.md) |
| Universal Alpha fixture | `@lean-bridge/alpha@0.0.0`, including its selected runtime assets | Universal candidate below |
| PHP-Wasm extension | `php-wasm-lean-alpha@0.0.0`, selecting one loading profile | PHP-Wasm subsection below |

The Alpha names identify repository fixtures. They do not grant you publishing rights. Use them only in a registry where you control those coordinates. A public release needs a package name or scope you own, a new version, and regenerated, reviewed package metadata. Never rename an archive or edit its embedded `package.json` after approval.

For an ordinary component, the CLI verifies the centrally published runtime dependency. Do not publish `@lean-bridge/runtime` under a downstream author's credentials.

## Prepare and verify the candidate

For a local Alpha archive, start with the prepared bundle from the [example artifact build instructions](../consume/receive-package.md#build-the-example-artifacts-as-a-maintainer):

```sh
node scripts/build-npm-package.mjs \
  --bundle build/consumer-universal-bundle --output build/publish-npm-package
```

For a universal reproducible candidate, use a clean committed checkout and a new output directory:

```sh
node scripts/lean-bridge.mjs publish --project . --target npm --dry-run \
  --output build/npm-release-gate
npm run verify:release-authorization -- \
  --authorization build/npm-release-gate \
  --candidate build/npm-release-gate/release
```

Select the coordinate, archive path, and SHA-256 from that candidate's manifest. The executor accepts both the universal version-one manifest and the ordinary component's version-two manifest.

The ordinary component flow above supplies signing through CLI configuration. Universal repository releases retain the reviewed integration in [Sandbox release](../contributing/sandbox-release.md#rehearse-a-registry-release) and its project production-approval policy. The manual npm commands below do not create `registry-transaction.json` or a signed `release-receipt.json`.

## Upload to your sandbox

Install Node and npm in the publisher environment. Configure an existing local registry at `http://127.0.0.1:4873/`, with an account allowed to publish the reviewed package. Replace the archive path and coordinate below with their actual values:

```sh
export LEAN_BRIDGE_NPM_REGISTRY=http://127.0.0.1:4873/
export LEAN_BRIDGE_NPM_ARCHIVE=/absolute/path/to/approved-package.tgz
export LEAN_BRIDGE_NPM_COORDINATE=@your-org/your-component@0.1.0
tar -xOf "$LEAN_BRIDGE_NPM_ARCHIVE" package/package.json
sha256sum "$LEAN_BRIDGE_NPM_ARCHIVE"
npm login --registry "$LEAN_BRIDGE_NPM_REGISTRY" --auth-type=legacy
npm whoami --registry "$LEAN_BRIDGE_NPM_REGISTRY"
```

Compare the printed name, version, dependencies, and hash with the reviewed record. Inspect `publishConfig`: its registry and access settings must agree with the selected sandbox. Correct a mismatch upstream and regenerate the candidate. `npm login` saves credentials in npm's user configuration; keep that file outside source control and release artifacts. [npm login](https://docs.npmjs.com/cli/v11/commands/npm-login/), [publishConfig](https://github.com/npm/cli/blob/latest/docs/lib/content/configuring-npm/package-json.md#publishconfig).

First check the proposed upload without writing:

```sh
npm publish "$LEAN_BRIDGE_NPM_ARCHIVE" --dry-run --ignore-scripts \
  --registry "$LEAN_BRIDGE_NPM_REGISTRY" --tag sandbox
```

After the release owner authorizes this sandbox write, upload that same archive:

```sh
npm publish "$LEAN_BRIDGE_NPM_ARCHIVE" --ignore-scripts \
  --registry "$LEAN_BRIDGE_NPM_REGISTRY" --tag sandbox
```

The explicit tag avoids moving `latest`. Apply the access level required by the registry and reviewed package policy. [Production review](../publishing.md#build-and-approve-the-same-artifacts) still governs project releases.

## Publish to the public npm registry

Complete package ownership and the approvals for the release you operate. This repository's governed release also requires its production profile approval. An approved direct upload uses the npm client below; it does not create Lean Bridge's signed transaction records.

Authenticate against the public endpoint with the publisher account, then upload the exact approved archive:

```sh
export LEAN_BRIDGE_NPM_REGISTRY=https://registry.npmjs.org/
npm login --registry "$LEAN_BRIDGE_NPM_REGISTRY"
npm whoami --registry "$LEAN_BRIDGE_NPM_REGISTRY"
npm publish "$LEAN_BRIDGE_NPM_ARCHIVE" --ignore-scripts \
  --registry "$LEAN_BRIDGE_NPM_REGISTRY" --access public --tag latest
```

`--access public` makes this a public package release. A scoped private release must use its separately approved restricted-access policy. Use the approved prerelease tag instead of `latest` for a preview release. Supply any authentication challenge through npm's prompt or the reviewed CI credential provider, not a recorded command containing a secret. Repeat the download and consumer checks below against this public endpoint. [npm access, tags, and authentication options](https://docs.npmjs.com/cli/v11/commands/npm-publish/).

## Download and verify the result

Inspect the exact version and fetch it with a fresh cache:

```sh
npm view "$LEAN_BRIDGE_NPM_COORDINATE" dist.tarball dist.integrity \
  --registry "$LEAN_BRIDGE_NPM_REGISTRY" --json
mkdir -p build
LEAN_BRIDGE_NPM_CHECK_DIR=$(mktemp -d "$(pwd)/build/npm-registry-check.XXXXXX")
npm pack "$LEAN_BRIDGE_NPM_COORDINATE" --ignore-scripts \
  --registry "$LEAN_BRIDGE_NPM_REGISTRY" \
  --cache "$LEAN_BRIDGE_NPM_CHECK_DIR/cache" \
  --pack-destination "$LEAN_BRIDGE_NPM_CHECK_DIR" --json \
  > "$LEAN_BRIDGE_NPM_CHECK_DIR/download.json"
LEAN_BRIDGE_NPM_DOWNLOADED="$LEAN_BRIDGE_NPM_CHECK_DIR/$(node -p \
  'require(process.argv[1])[0].filename' "$LEAN_BRIDGE_NPM_CHECK_DIR/download.json")"
cmp "$LEAN_BRIDGE_NPM_ARCHIVE" "$LEAN_BRIDGE_NPM_DOWNLOADED"
sha256sum "$LEAN_BRIDGE_NPM_ARCHIVE" "$LEAN_BRIDGE_NPM_DOWNLOADED"
```

`cmp` must exit successfully. `npm pack` fetches a named registry package into the chosen directory; passing the coordinate here avoids repacking your source tree. Keep the metadata, archive hash, registry endpoint, and consumer result with the release record. [npm view](https://docs.npmjs.com/cli/v11/commands/npm-view/), [npm pack](https://docs.npmjs.com/cli/v11/commands/npm-pack/).

In a fresh application directory, install the exact coordinate with `npm install --ignore-scripts --registry "$LEAN_BRIDGE_NPM_REGISTRY" "$LEAN_BRIDGE_NPM_COORDINATE"`. Select the consumer check for the package you published:

- For the ordinary `onboarding-small` component, npm installs its exact runtime dependency automatically. Run the [JavaScript and TypeScript example](../javascript-typescript.md).
- For `php-wasm-lean-alpha`, run the [PHP-Wasm example](../php.md#php-wasm) with the selected loading profile.
- For the universal `@lean-bridge/alpha` fixture, run this `Box` check from the clean installation directory. It prints `42` and releases the resource:

```sh
node --input-type=module -e '
import { Box } from "@lean-bridge/alpha";
const box = new Box(42);
try {
  if (box.read() !== 42) throw new Error("Unexpected Alpha result");
  console.log(box.read());
} finally {
  box.dispose();
}
'
```

Use the actual package name and exports for a renamed component. If the integration produced a signed release receipt, also verify the downloaded archives through [Use a prepared release](../consume/receive-package.md#authenticate-a-signed-archive).

## Publish the PHP-Wasm profile

Follow [Build and publish PHP packages](php.md#php-wasm-with-npm) for PHP-Wasm's package inputs, profile selection, npm archive preparation, and consumer verification.

## Recover a failed upload

After an uncertain response, inspect and download the coordinate before retrying. Matching bytes establish that the upload arrived; different bytes require an incident review or a new version. npm does not permit reusing a published name/version pair. An approved corrective release can deprecate a bad version, but deprecation does not replace its bytes. [npm version immutability](https://docs.npmjs.com/cli/v11/commands/npm-publish/), [npm deprecate](https://docs.npmjs.com/cli/v11/commands/npm-deprecate/).

For a signed Lean Bridge transaction, preserve the manifest and transaction record and follow [transaction recovery](../contributing/production-release.md#recover-an-interrupted-release). Return to [Publishing](../publishing.md) for the shared approval and handoff flow.

### Publish npm packages

The package-manager recipe above remains available at this address. Return to [target selection](../publishing.md) or [consumer installation](../consume.md).
