# Build and publish C# / .NET packages

Build an ordinary Lean project into an installable NuGet package with `--target nuget`. Its generated C# API supports all 19 primitive types, nested arrays, acyclic copied records, and synchronous primitive callbacks and closures. Lean `Char` maps to `System.Text.Rune`. Consumers install the prepared archive without compiling Lean or writing marshalling code.

For ordinary-source builds, declare the library's [description, authors and URLs](../publishing.md#declare-package-metadata) once in `lean-bridge.exports.json`.

Build the NuGet projection, test the installed C# API, and upload the approved `.nupkg` to a feed controlled by your organization. Use a sandbox feed and sandbox credentials for the first external run.

## Build an ordinary Lean project

Use the [author toolchain](../contributing/author-toolchain.md) with the pinned Lean compiler, a native C compiler, and the .NET 8 SDK. Set `LEAN_BRIDGE_DOTNET` if the SDK executable is not named `dotnet` on your PATH. The current native package profile is Linux x86-64 with glibc 2.38 or newer.

Select your modules and functions in `lean-bridge.exports.json`. Set a package ID you control and an exact version:

```json
{
  "schemaVersion": 1,
  "modules": ["Aurora"],
  "exports": ["Aurora.echo_nat", "Aurora.echo_text", "Aurora.matrix"],
  "targets": {
    "nuget": { "name": "Acme.Aurora", "version": "2.0.0-rc.1" }
  }
}
```

Build into a new output directory:

```sh
lean-bridge build --project /absolute/path/to/aurora --target nuget \
  --output /absolute/path/to/aurora-release
```

The result includes `archives/Acme.Aurora.2.0.0-rc.1.nupkg` and `native-release.json`, which records the exact archive digest. The archive contains the compiled .NET 8 assembly, native adapter, Lean component, shared runtime, generated sources, compiler evidence and dependency license notices. Its README identifies the generated namespace and API. A different NuGet package ID does not rename the Lean-derived C# namespace.

The native profile accepts concrete functions with copied values and synchronous primitive callbacks or returned closures. It supports finite specializations and compiler-checked record constructors/accessors, including records Lean represents as scalars. Nesting is bounded to 32 types; copies have a 16 MiB per-call budget. Unsupported signatures and conflicting generated names fail at the Lean declaration. Optional values, variants, resources, compound callables and asynchronous effects remain outside this ordinary NuGet profile.

Repeat `--target` to produce C, C++, CPAN and NuGet from one native compilation. Add npm when the selected API fits its [supported shapes](../lean/export-decisions.md#start-with-the-runnable-npm-shapes), including nested primitive arrays; that adds one WebAssembly compilation. Failed projections leave no partial release directory. See the [installed C# example](../consume/dotnet.md#call-an-ordinary-lean-package).

NuGet archive assembly consumes verified compiled artifacts and does not invoke a compiler. Registry upload uses the native NuGet commands below. Verify the release with `lean-bridge verify --receipt /absolute/path/to/aurora-release/package-set-receipt.json`. Distribute this receipt, its `.json.sha256` sidecar and the named archives together. The receipt checks local file consistency; it is unsigned.

## Export callbacks and returned functions

Select functions with primitive callback parameters in the same export configuration:

```lean
namespace Aurora
def call_word (value : UInt32) (callback : UInt32 → UInt32) : UInt32 :=
  callback (callback value)
def make_word (captured value : UInt32) : UInt32 := captured + value
end Aurora
```

Include both exports and set `"arities": { "Aurora.make_word": 1 }` to leave the final argument on the returned closure. For a reviewed Binding IR, its outer parameter count supplies that decision; do not also configure `arities`.

Callbacks accept one to sixteen primitive arguments and a primitive result. They borrow one synchronous call. C# uses `Func` or `Action` delegates and `LeanClosure<TDelegate>` with `Invoke`, `IsClosed` and `Dispose`. `Nat`/`Int` stay exact `BigInteger` values, and temporary native buffers remain private. See [consumer ownership and exception behavior](../consume/dotnet.md#callbacks-and-returned-lean-functions).

A combined build rejects the complete request if any selected target does not support its callable signatures. Ordinary-source and reviewed NuGet packages run through the same private C callable ABI and shared runtime.

## Build and inspect the package

The existing Alpha interoperability fixture remains available separately. It exercises resources and callbacks through the reviewed fixture API.

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

For an ordinary package, configure `targets.nuget.name` and `targets.nuget.version` before building. Names must be ASCII NuGet IDs of at most 100 characters; versions use three numeric parts with an optional prerelease suffix and no build metadata.

The separate Alpha fixture fixes its package ID to `LeanBridge.Alpha`, with a version from Alpha's Binding IR. Do not upload that fixture to a public registry or edit its generated files to represent another library.

Renaming the `.nupkg` or editing its embedded `.nuspec` after approval changes neither the reviewed source nor its authorization. Produce a new candidate when metadata changes. NuGet associates publication permissions with the owning account and its scoped API key. [NuGet publishing and ownership](https://learn.microsoft.com/en-us/nuget/nuget-org/publish-a-package)

## Review the candidate

For an ordinary package, reproduce the build from a separate source location, compare the archive digest, and run a fresh consumer against that exact archive. Review source and dependency licenses before publication. Preserve `native-release.json` and the original `.nupkg` with the release record.

The following signed-candidate workflow applies to the repository's universal fixture bundle, not to ordinary NuGet outputs. From a clean committed checkout, select ecosystem `nuget`; its binding target is `dotnet`.

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

Use the printed archive path, coordinate, and SHA-256. This check establishes candidate consistency; the [production review](../publishing.md#build-and-approve-the-same-artifacts) supplies required approvals and signer authority. Retain the [sandbox evidence](../contributing/sandbox-release.md#rehearse-a-registry-release) before requesting production access.

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

If an integrated publisher has supplied a signed release receipt, also perform the recipient-side checks in [Use a prepared release](../consume/receive-package.md#authenticate-a-signed-archive).

## Recover without overwriting a release

After a timeout or conflict, fetch the existing coordinate and compare its bytes before deciding whether to retry. Identical bytes need no second upload. A different archive at the same coordinate requires investigation and an approved new version.

For nuget.org, unlisting hides a version from ordinary discovery but exact-version downloads remain available; routine permanent deletion is unavailable. Private feeds have their own retention policies. Follow the release owner's recovery decision rather than deleting evidence or overwriting the version. [NuGet deletion and unlisting policy](https://learn.microsoft.com/en-us/nuget/nuget-org/policies/deleting-packages)

### Publish a NuGet package

The package-manager recipe above remains available at this address. Return to [target selection](../publishing.md) or [consumer installation](../consume.md).
