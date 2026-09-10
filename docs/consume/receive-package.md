# Use a prepared release

Obtain the prepared release for your language and platform from its publisher. A prepared release already contains the compiled code; verification and installation do not require a Lean source checkout.

## Check the release files

### Identify the release type

| Package | Files to request | Next step |
| --- | --- | --- |
| Signed release | Exact archive, release receipt, signer policy, archive verifier, signed subject path, and coordinate | Authenticate each archive before installation. |
| Local `onboarding-small` npm release | Runtime archive, component archive, component receipt, and its verifier | Verify the local receipt and install both archives in one command. |
| Local Alpha package | The language-specific archive from a trusted distributor, with its identity and tested platform | Follow that language's installation recipe. A local archive alone has no signed release identity. |

Get the expected signer-policy hash from reviewed configuration or a separate trusted channel. A policy file and a hash delivered beside an untrusted archive cannot establish the signer's identity.

### Authenticate a signed archive

The release handoff supplies `release-receipt.json`, `publication-signer-policy.json`, and `verify-release-archive.mjs`. Run the verifier with Node 22 before installing, extracting, or loading the archive:

```sh
node ./verify-release-archive.mjs \
  --archive ./downloaded-package \
  --receipt ./release-receipt.json \
  --policy ./publication-signer-policy.json \
  --policy-sha256 <trusted-policy-sha256> \
  --subject <signed-subject-path> \
  --coordinate <expected-coordinate>
```

Replace the angle-bracket placeholders with the reviewed handoff values. Use the actual archive filename instead of `downloaded-package`. The verifier checks both Ed25519-signed decisions, the policy identity, coordinate, filename, byte length, and SHA-256. Repeat this check for each archive you install, including a separately packaged runtime.

An archive hash failure requires the matching archive and receipt from the author. Do not edit a receipt, rename another version, or recalculate a policy hash to make verification pass.

Use this procedure only when the publisher supplies an actual signed handoff. An ordinary registry upload does not create those records. The PHP builders are outside the universal publication pipeline; their current handoff needs a trusted distribution channel and the publisher's recorded package hashes. See [publishing by ecosystem](../publishing.md#choose-the-package-ecosystem) for the available flows.

### Verify the local npm receipt

Use the completed npm handoff directory containing both archives, `component-package-receipt.json`, and `verify-component-package-receipt.mjs`. Set its absolute path:

```sh
export LEAN_BRIDGE_RELEASE=/absolute/path/to/release/packages/npm
node "$LEAN_BRIDGE_RELEASE/verify-component-package-receipt.mjs" \
  --receipt "$LEAN_BRIDGE_RELEASE/component-package-receipt.json"
```

The verifier prints `verified: true`, the component identity, and the runtime version after checking both archive hashes. Use a verifier from an author or release channel you trust. This local receipt checks consistency; it does not authenticate a release signer.

Select the exact archive names from that receipt:

```sh
export LEAN_BRIDGE_RUNTIME_ARCHIVE="$LEAN_BRIDGE_RELEASE/$(node -p \
  'require(process.argv[1]).runtime.archive' \
  "$LEAN_BRIDGE_RELEASE/component-package-receipt.json")"
export LEAN_BRIDGE_COMPONENT_ARCHIVE="$LEAN_BRIDGE_RELEASE/$(node -p \
  'require(process.argv[1]).package.archive' \
  "$LEAN_BRIDGE_RELEASE/component-package-receipt.json")"
```

Keep these variables when following the [JavaScript and TypeScript guide](../javascript-typescript.md), including its browser, React, and worker sections. Installing both archives together satisfies the component's exact runtime dependency without fetching a substitute.

The separate runtime archive is an installation dependency. The component loads it automatically when imported. If the publisher distributes both packages through your configured registry, npm resolves that dependency from the component's metadata.

To install flake outputs from a binary cache, follow [signed Nix package consumption](../publish/nix.md). Obtain the cache's public key through a trusted channel and check substitution before relying on the installed output. A Nix cache signature and a Lean Bridge archive receipt authenticate different records.

### Continue with your language

Choose a guide from [Use a Lean package](../consume.md). Each one starts with prepared-release installation and a complete application example.

## Start from a raw Lean package

If the handoff contains a Lake project instead of an installable release, use the [source-package workflow](../consume.md#start-from-a-raw-lean-package). [Share a local package](../publish/local-handoff.md) creates the npm archives, receipt, and verifier before the installation steps above.

### Build the example artifacts as a maintainer

Maintainers can [build the local Alpha artifacts](../contributing/testing.md#build-the-example-artifacts-as-a-maintainer) from the checkout. Those target-specific builds produce the packages used by the native and managed examples.

For distribution, follow [Approve a production release](../publish/production-release.md). The [release receipt record](../evidence/release-receipt.md) describes the signed handoff.
