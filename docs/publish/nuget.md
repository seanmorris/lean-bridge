# Publish a NuGet package

Build the NuGet projection, test the installed C# API, and upload the approved `.nupkg` to a feed controlled by your organization. Use a sandbox feed and sandbox credentials for the first external run.

## Build and inspect the package

From the Lean Bridge checkout with its pinned Nix environment:

```sh
nix --extra-experimental-features 'nix-command flakes' build \
  .#nuget-package --out-link build/publish-nuget
```

The current fixture produces `build/publish-nuget/LeanBridge.Alpha.0.0.0.nupkg` and `nuget-projection.json`. It includes the .NET 8 assembly and native libraries for x86-64 Linux with glibc 2.38 or newer.

If you already have a verified universal bundle, its compiler-free package builder accepts that bundle and a new output directory:

```sh
node scripts/build-nuget-package.mjs \
  --bundle build/consumer-universal-bundle --output build/nuget-package
```

Run the [C# consumer example](../consume/dotnet.md) against the package before reviewing publication. Contributors can also run the [managed acceptance checks](../contributing/testing.md#consumer-acceptance). Keep the build's projection record and original archive.

## Choose an owned identity

The current source fixes the example package ID to `LeanBridge.Alpha`; its version comes from Alpha's Binding IR. Do not upload that fixture to a public registry.

For your own release, review the coordinate mapping in [universal bundle generation](../../src/release/universal-release-bundle.mjs), the [.NET generator](../../src/backends/dotnet/generate.mjs), and the [Alpha identity input](../../poc/lean-link-spike/bindings/alpha.binding-ir.json). Adopt an ID your organization controls and a new version, regenerate the bindings and bundle, then rerun package and consumer checks. This profile's API model is Alpha-specific; it has no general `--package-name` override.

Renaming the `.nupkg` or editing its embedded `.nuspec` after approval changes neither the reviewed source nor its authorization. Produce a new candidate when metadata changes. NuGet associates publication permissions with the owning account and its scoped API key. [NuGet publishing and ownership](https://learn.microsoft.com/en-us/nuget/nuget-org/publish-a-package)

## Review the candidate

From a clean committed checkout, select the publication ecosystem `nuget`. The binding target inside the package is `dotnet`.

```sh
node scripts/lean-bridge.mjs publish --project . --target nuget --dry-run \
  --output build/nuget-candidate
```

Recheck the universal manifest and all authorized candidate bytes immediately before upload:

```sh
node --input-type=module -e '
import { verifyPublishManifest } from "./src/release/publish-manifest.mjs";
const result = await verifyPublishManifest({
  manifestPath: process.argv[1], requestedTargets: ["nuget"]
});
console.log(JSON.stringify(result.manifest.targets, null, 2));
' build/nuget-candidate/publish-manifest.json
```

Use the printed archive path, coordinate, and SHA-256. This check establishes candidate consistency; the [production review](production-release.md) supplies required approvals and signer authority. Retain the [sandbox evidence](sandbox-release.md) before requesting production access.

The installed CLI has only the npm transaction adapter. The NuGet command below does not create a Lean Bridge signed completion receipt. A reviewed release integration must bind the actual feed, authority, and archive identity; a manifest naming the public NuGet endpoint does not authorize a different private feed.

## Authenticate and upload

Choose an approved HTTPS feed that accepts NuGet API-key authentication and preserves the uploaded archive bytes. Set the archive path from the reviewed candidate and the feed's service-index URL:

```sh
export LEAN_BRIDGE_NUGET_ARCHIVE=/absolute/path/to/the-reviewed-package.nupkg
export LEAN_BRIDGE_NUGET_SOURCE=https://nuget.example.invalid/v3/index.json
```

Replace both placeholders before use. Your credential provider supplies `NUGET_API_KEY` with push access restricted to the owned package. Never put the key in source, a committed NuGet configuration, or a transcript.

An authorized operator runs:

```sh
set +x
dotnet nuget push "$LEAN_BRIDGE_NUGET_ARCHIVE" \
  --source "$LEAN_BRIDGE_NUGET_SOURCE" \
  --api-key "${NUGET_API_KEY:?Supply the approved feed credential}" \
  --no-symbols
```

This syntax works with the .NET 8 SDK. It expands the key into the process arguments, so use an isolated publishing runner with command tracing disabled. Direct `NUGET_API_KEY` environment-variable support without `--api-key` starts with SDK 10.0.300. [NuGet publication authentication](https://learn.microsoft.com/en-us/nuget/nuget-org/publish-a-package)

Keep the explicit source. Do not add `--skip-duplicate`: that option treats a conflict as a warning without proving that the existing bytes match your candidate. [`dotnet nuget push` reference](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-nuget-push)

### Publish to nuget.org

After package ownership, source changes, sandbox validation, and production approvals are complete, select the public endpoint and run the same push command:

```sh
export LEAN_BRIDGE_NUGET_SOURCE=https://api.nuget.org/v3/index.json
```

Use a key scoped to your owned package. Include NuGet signing and post-publication verification in the reviewed workflow before this upload; public-feed verification must account for repository signatures as described below. [NuGet.org publication](https://learn.microsoft.com/en-us/nuget/nuget-org/publish-a-package)

## Verify the published package

Download the exact published version through the approved feed. A NuGet V3 client discovers the `PackageBaseAddress` from the service index and uses its normalized lowercase ID/version path. Use the feed's authenticated download client rather than guessing that path. [NuGet package-content API](https://learn.microsoft.com/en-us/nuget/api/package-base-address-resource)

For a byte-preserving feed, set the downloaded archive path and compare it with the candidate:

```sh
export LEAN_BRIDGE_NUGET_DOWNLOADED=/absolute/path/to/downloaded-package.nupkg
cmp "$LEAN_BRIDGE_NUGET_ARCHIVE" "$LEAN_BRIDGE_NUGET_DOWNLOADED"
sha256sum "$LEAN_BRIDGE_NUGET_DOWNLOADED"
```

For the byte-preserving feed, the digest must match the reviewed manifest. A feed can add a repository signature and thereby change the archive bytes. Such a feed needs a separately reviewed signature/content verification path; do not edit the manifest hash to accept the change. [NuGet repository signatures](https://learn.microsoft.com/en-us/nuget/api/repository-signatures-resource)

For a signed downloaded package, run `dotnet nuget verify --all "$LEAN_BRIDGE_NUGET_DOWNLOADED"` and apply the reviewed package-content comparison against the candidate. Signature verification alone does not compare the package with Lean Bridge's approved artifact inventory. [`dotnet nuget verify`](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-nuget-verify)

After verification, install the downloaded archive into a fresh directory with the [C# guide](../consume/dotnet.md). Adjust its PackageReference to your approved package identity if you changed the fixture coordinate. Record the feed URL, coordinate, upload outcome, downloaded digest, and consumer output with the candidate.

If an integrated publisher has supplied a signed release receipt, also perform the recipient-side checks in [Receive a package](../consume/receive-package.md#authenticate-a-signed-archive).

## Recover without overwriting a release

After a timeout or conflict, fetch the existing coordinate and compare its bytes before deciding whether to retry. Identical bytes need no second upload. A different archive at the same coordinate requires investigation and an approved new version.

For nuget.org, unlisting hides a version from ordinary discovery but exact-version downloads remain available; routine permanent deletion is unavailable. Private feeds have their own retention policies. Follow the release owner's recovery decision rather than deleting evidence or overwriting the version. [NuGet deletion and unlisting policy](https://learn.microsoft.com/en-us/nuget/nuget-org/policies/deleting-packages)
