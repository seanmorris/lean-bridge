# Build and publish Ruby packages

This target currently packages the repository's prepared Alpha bundle and target metadata. For another library, first check [source preparation and target inputs](../lean/existing-package.md). Your language's package manager installs the completed output without compiling Lean.

Build and validate the generated gem, then upload its exact bytes to a gem server controlled by your organization. Rehearse against a sandbox with credentials that cannot publish to production.

## Build the gem

From the Lean Bridge checkout with its pinned Nix environment:

```sh
nix --extra-experimental-features 'nix-command flakes' build \
  .#rubygems-package --out-link build/publish-rubygems
```

The fixture writes `build/publish-rubygems/lean_bridge_alpha-0.0.0.gem` and `rubygems-projection.json`. It bundles the Ruby API and native Lean libraries. Consumers use MRI Ruby 3.3 on x86-64 Linux with glibc 2.38 or newer; installation runs no native extension build.

For an existing verified universal bundle, use Ruby 3.3's `gem` command and a new output directory:

```sh
node scripts/build-rubygems-package.mjs \
  --bundle build/consumer-universal-bundle --output build/rubygems-package \
  --gem /absolute/path/to/ruby-3.3/bin/gem
```

Run the [Ruby consumer example](../consume/ruby.md) against the package before publication review. Contributors can also run the [managed acceptance checks](../contributing/testing.md#consumer-acceptance).

## Establish ownership and version

The example gem is `lean_bridge_alpha` version `0.0.0`. Do not upload that fixture to RubyGems.org.

Choose a name your account or organization controls. Update the reviewed [universal package mapping](../../src/release/universal-release-bundle.mjs), [Ruby generator](../../src/backends/ruby/generate.mjs), and [Alpha identity/version input](../../poc/lean-link-spike/bindings/alpha.binding-ir.json), then regenerate and test the bindings, canonical bundle, and gem. The current profile implements Alpha's API model and has no general package-renaming CLI.

Do not rename the archive or edit its gemspec after candidate approval. For a private package, review generating `allowed_push_host` metadata to restrict the destination; the current generated gemspec does not set it. [RubyGems publishing and private hosts](https://guides.rubygems.org/publishing/)

## Freeze and verify the candidate

Use a clean committed checkout. The publication ecosystem is `rubygems`; its binding target is `ruby`.

```sh
node scripts/lean-bridge.mjs publish --project . --target rubygems --dry-run \
  --output build/rubygems-candidate
```

Recheck the manifest and candidate bytes:

```sh
node --input-type=module -e '
import { verifyPublishManifest } from "./src/release/publish-manifest.mjs";
const result = await verifyPublishManifest({
  manifestPath: process.argv[1], requestedTargets: ["rubygems"]
});
console.log(JSON.stringify(result.manifest.targets, null, 2));
' build/rubygems-candidate/publish-manifest.json
```

Use the reviewed archive path, name, version, and hash. Retain the [sandbox record](../contributing/sandbox-release.md#rehearse-a-registry-release) and complete the [production approvals](../publishing.md#build-and-approve-the-same-artifacts) for the chosen host.

The installed CLI has only the npm transaction adapter. `gem push` does not create a Lean Bridge signed completion receipt. A reviewed integration must bind the actual host and authority; a universal manifest naming RubyGems.org does not authorize a different private host.

## Authenticate and push

Set the non-secret archive path and controlled endpoint:

```sh
export LEAN_BRIDGE_GEM_ARCHIVE=/absolute/path/to/the-reviewed-package.gem
export LEAN_BRIDGE_GEM_HOST=https://gems.example.invalid
```

Replace the placeholders with approved values. Your credential provider injects `GEM_HOST_API_KEY`; give it push access to the owned gem, not owner-management or yank permissions unless that job requires them. Keep the token out of source files, shell history, and logs. [RubyGems API-key scopes and environment authentication](https://guides.rubygems.org/api-key-scopes/)

An authorized operator runs:

```sh
set +x
: "${GEM_HOST_API_KEY:?Supply the approved gem-host credential}"
gem push "$LEAN_BRIDGE_GEM_ARCHIVE" --host "$LEAN_BRIDGE_GEM_HOST"
```

The explicit `--host` selects the intended gem server. If that server requires MFA or another authentication flow, use its approved interactive or CI credential workflow rather than weakening account protection. [RubyGems push command](https://guides.rubygems.org/command-reference/#gem-push)

### Publish to RubyGems.org

After the owned name, regenerated package, sandbox record, and production approvals are ready, select RubyGems.org and run the same push command:

```sh
export LEAN_BRIDGE_GEM_HOST=https://rubygems.org
```

The account represented by `GEM_HOST_API_KEY` must own the gem or have permission to create its unused name. If the generated gem has `allowed_push_host`, it must agree with this reviewed public destination. [RubyGems.org publication and ownership](https://guides.rubygems.org/publishing/)

## Download, compare, and install

Set the name and version from the reviewed candidate. Use a new download directory and clear default gem sources for this fetch:

```sh
export LEAN_BRIDGE_GEM_NAME=your_owned_gem
export LEAN_BRIDGE_GEM_VERSION=1.0.0
mkdir build/rubygems-published-download
cd build/rubygems-published-download
gem fetch "$LEAN_BRIDGE_GEM_NAME" --version "$LEAN_BRIDGE_GEM_VERSION" \
  --clear-sources --source "$LEAN_BRIDGE_GEM_HOST"
export LEAN_BRIDGE_GEM_FILE="$LEAN_BRIDGE_GEM_NAME-$LEAN_BRIDGE_GEM_VERSION.gem"
cmp "$LEAN_BRIDGE_GEM_ARCHIVE" "$LEAN_BRIDGE_GEM_FILE"
sha256sum "$LEAN_BRIDGE_GEM_FILE"
```

This generated package uses the generic Ruby gem platform, so the filename has no additional platform suffix. If the private host requires download authentication, configure its approved read credential separately. `GEM_HOST_API_KEY` authenticates publication; do not assume it configures every private download client. [RubyGems fetch command](https://guides.rubygems.org/command-reference/#gem-fetch)

The downloaded digest must match the reviewed manifest. Install only after comparison:

```sh
export GEM_HOME="$PWD/.gems"
export GEM_PATH="$GEM_HOME"
gem install "$LEAN_BRIDGE_GEM_FILE" --local --install-dir "$GEM_HOME" --no-document
```

Run the [Ruby program](../consume/ruby.md#write-the-application) against that installation. Save its output, the host, coordinate, upload result, and downloaded hash with the candidate.

Where an integrated publisher supplies a signed receipt, also run [recipient archive verification](../consume/receive-package.md#authenticate-a-signed-archive) with the separately trusted signer-policy identity.

## Recover a failed or incorrect release

After an interrupted upload, fetch the existing version and compare it before retrying. Matching bytes establish that the archive arrived; mismatched bytes require investigation and a new reviewed version.

If the release owner authorizes removal, `gem yank` removes the selected version from the host's index. RubyGems.org also removes the gem file, but mirrors may already have copied it. Rotate any exposed secrets even after a yank. [RubyGems removal policy](https://guides.rubygems.org/removing-a-published-gem/)

Use a new reviewed version for corrected content; do not use yanking to replace the archive under an existing release identity.

Keep the failed upload records, original archive, and recovery decision. Do not grant a publishing token yank rights merely to make retries easier.

### Publish a RubyGem

The package-manager recipe above remains available at this address. Return to [target selection](../publishing.md) or [consumer installation](../consume.md).
