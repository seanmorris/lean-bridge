/**
 * Prepared C# source packages for resource-bearing values and typed callbacks.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { generateOwnedDotnetCalls } from "./owned-calls.mjs";
import { ownedDotnetThreadExit } from "./owned-thread-exit.mjs";
import { verifiedDotnetAssets } from "./verified-assets.mjs";

/**
 * Generate managed sources without compiling or admitting a release artifact.
 * Only the native build can supply authenticated library evidence.
 *
 * @param ir - Compiler-authenticated ownership model.
 * @param evidence - Exact compiled library identities, or null for inspection.
 */
export const generateOwnedDotnetPackage = (ir, evidence = null) => {
	const model = generateOwnedDotnetCalls(ir), prefix = model.c.prefix;
	if(["gmp", "lean_bridge_native", "leanshared"].includes(prefix) || ir.component.id.length >= 160)
		throw new TypeError("Owned C# component name collides with a dependency or exceeds its name limit");
	if(evidence !== null && (evidence.componentId !== ir.component.id || evidence.library !== `lib${prefix}_dotnet.so`
		|| !Object.hasOwn(evidence.libraries ?? {}, "libgmp-lean-bridge.so.10")))
		throw new TypeError("Owned C# loading evidence differs from the component or private GMP dependency");
	const cleanup = ownedDotnetThreadExit(prefix), path = `src/${model.assembly}`;
	const contract = { schemaVersion: 1, backend: "owned-dotnet-v1"
		, bindingIrSha256: model.c.native.model.bindingIrSha256
		, namespace: model.namespace, assembly: model.assembly
		, loadingPolicy: "linux-x64-deepbind-v1", gmp: "libgmp-lean-bridge.so.10"
		, headerSha256: sha256(model.c.header), cleanupSha256: sha256(cleanup.source)
		, guardSha256: sha256(cleanup.guardSource)
		, valuesSha256: sha256(model.valuesSource)
		, conversionsSha256: sha256(model.source)
		, callsSha256: sha256(model.files["Calls.cs"])
		, runtimeSha256: sha256(model.files["Lifetime.cs"])
	};
	const files = Object.fromEntries(Object.entries(model.files).map(([name, source]) => [`${path}/${name}`, source]));
	files[`${path}/Loader.cs`] = `namespace ${model.namespace}.Interop;
internal static class OwnedNative
{
${verifiedDotnetAssets(evidence)}
}
internal static class OwnedLoader
{
    private static readonly object Gate = new();
    private static OwnedBindings? bindings;
    internal static OwnedBindings Bindings
    {
        get
        {
            OwnedNative.EnsureProcess();
            var ready = global::System.Threading.Volatile.Read(ref bindings);
            if (ready is not null) return ready;
            var library = OwnedNative.Handle;
            lock (Gate)
            {
                ready = bindings;
                if (ready is null)
                {
                    ready = new OwnedBindings(library, OwnedNative.EnsureProcess);
                    global::System.Threading.Volatile.Write(ref bindings, ready);
                }
                return ready;
            }
        }
    }
}
`;
	files[`${path}/${model.assembly}.csproj`] = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>disable</ImplicitUsings>
    <AllowUnsafeBlocks>true</AllowUnsafeBlocks>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <NoWarn>1591</NoWarn>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <Deterministic>true</Deterministic>
    <AssemblyName>${model.assembly}</AssemblyName>
    <Version>${ir.component.version}</Version>
    <DebugType>none</DebugType>
    <EnableNETAnalyzers>false</EnableNETAnalyzers>
  </PropertyGroup>
</Project>
`;
	files["NuGet.Config"] = '<configuration><packageSources><clear /></packageSources></configuration>\n';
	files["README.md"] = `# ${model.assembly}

Install the prepared NuGet package and call ${model.namespace}.Api. The package includes and automatically loads the compiled Lean component, compatible shared runtime, and private GMP dependency. Consumers need .NET 8 on Linux x86-64 with the declared glibc floor. Lean and native compilers are producer tools, not consumer dependencies.

Records and variant cases are sealed C# records. Array and List use typed arrays. Nat and Int use BigInteger, Char uses Rune, String preserves Unicode and NUL, and ByteArray uses byte[]. Unit arguments use default(Unit); exported Unit results return void. Option and Result retain their branches, including nested Some(None) and Some(default(Unit)). Aliases retain their metadata without extra CLR wrappers. Negative Nat, invalid UTF-16, null payloads, cycles and invalid variant branches reject.

Resource and returned-closure wrappers implement IDisposable. Use using or Dispose when finished. Retain creates an independent native owner. Resource leaves compare wrapper identity. A copied record or array does not implicitly retain its contained resource wrappers. Calls and retention require the creator thread. Dispose on another thread queues release for the creator's next call or thread exit; finalizers never invoke thread-bound native code. Creator-thread exit drains native owners even if the managed Thread object and wrappers remain reachable.

Callbacks are synchronous typed delegates. Borrowed resources and closures expire when the callback returns; call Retain inside that callback to keep them. AsCallback passes a returned Lean closure back with its native identity. Multicast delegates keep every invocation. Async delegates reject before execution. If a callback result has no safe default, use OwnedCallbacks.WithRecovery(callback, recoveryValue). A callback exception returns through the native frame and is rethrown as the original managed exception with its stack. Recovery values clean up native execution; they do not replace the exception visible to the caller.

Conversions enforce depth 128, 262,144 visited values and separate 16 MiB native and accounted managed budgets. Callback input and reply conversions share their enclosing call's budget. These limits do not bound Lean working memory or every CLR allocation overhead. Malformed native outputs retire the runtime; failed or retired calls do not publish partial wrappers.

The loader verifies every packaged native file before loading. It rejects conflicting runtime identities, conflicting builds, symbolic-link native assets and unverified preloads. Libraries remain loaded until process exit. Start a fresh process after fork. This projection does not yet admit transferred input ownership or anchored results.
`;
	const publicFiles = ["Values.cs", "Api.cs"].map(name => `${path}/${name}`);
	const internalFiles = ["Conversions.cs", "Lifetime.cs", "Calls.cs", "Loader.cs"].map(name => `${path}/${name}`);
	files["binding-manifest.json"] = canonicalJson({ schemaVersion: 1
		, generator: "dotnet-owned-values-v1"
		, backend: "owned-dotnet-v1", target: "dotnet"
		, component: ir.component.id
		, bindingIrSha256: model.c.native.model.bindingIrSha256
		, namespace: model.namespace, assembly: model.assembly
		, files: Object.keys(files), publicFiles, internalFiles
		, packageFiles: [`${path}/${model.assembly}.csproj`, "NuGet.Config"]
		, aliases: model.aliases, ownedValues: contract
		, supportedFeatures: ["direct-functions", "copied-values", "recursive-values", "resources", "callbacks", "closures", "deterministic-close"]
		, capabilityGaps: [{ feature: "transferred-and-anchored-ownership", reason: "Transferred inputs and anchored results require their own lifetime projection." }
			, { feature: "additional-platforms", reason: "Compiled releases target .NET 8 on Linux x86-64 with glibc." }] });
	if(Object.values(files).reduce((size, source) => size + Buffer.byteLength(source), 0) > 16 * 1024 * 1024)
		throw new TypeError("Owned C# package sources exceed 16 MiB");
	return { ...model, contract, files: Object.freeze(files), cleanup };
};
