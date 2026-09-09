# Publish npm packages

An ordinary Lean component uses `lean-bridge publish` to reproduce, sign, and upload its exact npm archive. Consumers install the component; npm resolves its shared runtime automatically.

## Publish an ordinary component

Install the prepared CLI candidate using [author setup](../lean/setup.md), then complete [your first component](../lean/first-component.md). Choose a package name and version you own in `lakefile.toml`, declare its license in `package.json`, and include `LICENSE` in the committed source.

The runtime is published centrally by Lean Bridge. Your publisher checks that its exact dependency coordinate and tarball hash already exist in the selected registry. It does not upload the runtime under your credentials. A missing or different runtime blocks publication before the component upload.

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

For a local Alpha archive, start with the prepared bundle from [Receive a package](../consume/receive-package.md#build-the-example-artifacts-as-a-maintainer):

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

The ordinary component flow above supplies signing through CLI configuration. Universal repository releases retain the reviewed integration in [Sandbox release](sandbox-release.md) and its project production-approval policy. The manual npm commands below do not create `registry-transaction.json` or a signed `release-receipt.json`.

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

The explicit tag avoids moving `latest`. Apply the access level required by the registry and reviewed package policy. [Production review](production-release.md) still governs project releases.

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
- For `php-wasm-lean-alpha`, run the [PHP-Wasm example](../consume/php-wasm.md) with the selected loading profile.
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

Use the actual package name and exports for a renamed component. If the integration produced a signed release receipt, also verify the downloaded archives through [Receive a package](../consume/receive-package.md#authenticate-a-signed-archive).

## Publish the PHP-Wasm profile

PHP-Wasm produces an npm package separately from the universal `npm` target. With the PHP sources and Emscripten environment prepared as in its [consumer and package guide](../consume/php-wasm.md), build and pack one profile:

```sh
node scripts/build-php-wasm-package.mjs \
  --manifest poc/lean-link-spike/bindings/php-wasm.package.json \
  --php-source build/php-wasm-sdk/php8.4-src \
  --emsdk .toolchains/emsdk-php-wasm --output build/publish-php-wasm
mkdir build/publish-php-wasm-archives
npm pack ./build/publish-php-wasm --ignore-scripts \
  --pack-destination build/publish-php-wasm-archives
```

Use new output directories. The manifest's `graphLock.profile` selects lazy or startup loading. Both fixture profiles currently use `php-wasm-lean-alpha@0.0.0`; they cannot be uploaded as different bytes under that same coordinate. Select one profile, or regenerate distinct reviewed package identities before packaging. Contributors can check both profiles with the [PHP release regression checks](../contributing/testing.md#consumer-acceptance).

Freeze the resulting `.tgz`, record its profile and hash, then use the sandbox upload and download checks above. There is no universal `--target php-wasm`, and the universal `npm` target identifies `@lean-bridge/alpha`, not this package.

## Recover a failed upload

After an uncertain response, inspect and download the coordinate before retrying. Matching bytes establish that the upload arrived; different bytes require an incident review or a new version. npm does not permit reusing a published name/version pair. An approved corrective release can deprecate a bad version, but deprecation does not replace its bytes. [npm version immutability](https://docs.npmjs.com/cli/v11/commands/npm-publish/), [npm deprecate](https://docs.npmjs.com/cli/v11/commands/npm-deprecate/).

For a signed Lean Bridge transaction, preserve the manifest and transaction record and follow [transaction recovery](production-release.md#recover-an-interrupted-release). Return to [Publishing](../publishing.md) for the shared approval and handoff flow.
