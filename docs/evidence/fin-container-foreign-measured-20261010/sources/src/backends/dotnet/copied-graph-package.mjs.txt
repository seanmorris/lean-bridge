/**
 * Safe public C# APIs over the checked recursive converters and native loader.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { generateCopiedDotnetGraphConversions } from "./copied-graph-conversions.mjs";
import { dotnetGraphAssets } from "./copied-graph-assets.mjs";

/**
 * Validate the host projection before compiling or admitting a NuGet package.
 *
 * @param ir - Compiler-checked copied graph contract.
 */
export const compileCopiedDotnetGraphPackageModel = ir => {
	const generated = generateCopiedDotnetGraphConversions(ir), prefix = generated.layout.prefix;
	if(["gmp", "lean_bridge_native", "leanshared"].includes(prefix) || ir.component.id.length >= 160)
		throw new TypeError("C# graph component name collides with a dependency or exceeds its name limit");
	const declarations = new Map(ir.declarations.map(item => [item.id, item]));
	const functions = generated.functions.map(fn => {
		const declaration = declarations.get(fn.bindingId), parameters = declaration.parameters.map(site => site.name);
		if(parameters.some(name => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) || new Set(parameters).size !== parameters.length)
			throw new TypeError("C# graph parameter names must be distinct ASCII identifiers");
		return { ...fn, declaration, parameterNames: parameters };
	});
	return { ...generated, ir, prefix, functions, layoutSha256: sha256(canonicalJson(generated.layout)) };
};

/**
 * Generate a deterministic assembly project; compilation and packaging are later
 * stages and must authenticate every native artifact passed as loader evidence.
 *
 * @param ir - Compiler-checked copied graph contract.
 * @param evidence - Verified native loading identities, or null for inspection.
 */
export const generateCopiedDotnetGraphPackage = (ir, evidence = null) => {
	const model = compileCopiedDotnetGraphPackageModel(ir), path = `src/${model.assembly}`;
	const types = new Map(model.nativeTypes.map(node => [node.id, node]));
	const unit = id => model.types.find(node => node.id === id).ref.name === "unit";
	const publicFiles = [`${path}/Api.cs`], internalFiles = [`${path}/Runtime.cs`, `${path}/Calls.cs`];
	const project = `${path}/${model.assembly}.csproj`, packageFiles = [project, "NuGet.Config"];
	const methods = model.functions.map((fn, index) => {
		const params = fn.parameters.map(id => types.get(id)), result = types.get(fn.result);
		return { public: `    /// <summary>Calls ${fn.bindingId.replaceAll("&", "&amp;").replaceAll("<", "&lt;")} in the compiled Lean component.</summary>
    public static ${unit(fn.result) ? "void" : result.publicType} ${fn.publicName}(${params.map((node, i) => `${node.publicType} @${fn.parameterNames[i]}`).join(", ")}) => global::${model.namespace}.Interop.GraphCalls.Call${index}(${fn.parameterNames.map(name => `@${name}`).join(", ")});`
			, private: `    internal static ${result.publicType} Call${index}(${params.map((node, i) => `${node.publicType} arg${i}`).join(", ")})
    {
        // Invalid cold inputs must not load native libraries. Once loaded, the
        // converter's normal validation remains before scratch and Lean calls.
        if (!GraphNative.IsLoaded)
        {
            using var check = new GraphScope(true);
${params.map((node, i) => `            GraphRuntime.Write${node.index}(arg${i}, check);`).join("\n")}
        }
        var symbols = GraphNative.Resolve();
        var lifecycle = new GraphLifecycle((delegate* unmanaged[Cdecl]<uint>)symbols[${model.functions.length}], (delegate* unmanaged[Cdecl]<int>)symbols[${model.functions.length + 1}], (delegate* unmanaged[Cdecl]<void>)symbols[${model.functions.length + 2}]);
        return GraphRuntime.Call${fn.publicName}((delegate* unmanaged[Cdecl]<${[...params.map(node => `${node.raw}*`), `${result.raw}*`, "uint"].join(", ")}>)symbols[${index}], lifecycle${params.map((_, i) => `, arg${i}`).join("")});
    }` };
	});
	const files = {
		[publicFiles[0]]: `using _V = global::${model.namespace};\n${model.valuesSource}\n/// <summary>The functions selected by the Lean package author.</summary>\npublic static class Api\n{\n${methods.map(fn => fn.public).join("\n")}\n}\n`
		, [internalFiles[0]]: model.source
		, [internalFiles[1]]: `using _V = global::${model.namespace};\nnamespace ${model.namespace}.Interop;\n${dotnetGraphAssets(model, evidence)}\ninternal static unsafe class GraphCalls\n{\n${methods.map(fn => fn.private).join("\n")}\n}\n`
		, [project]: `<Project Sdk="Microsoft.NET.Sdk">
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
    <Version>${model.ir.component.version}</Version>
    <DebugType>none</DebugType>
    <EnableNETAnalyzers>false</EnableNETAnalyzers>
  </PropertyGroup>
</Project>
`
		, "NuGet.Config": '<configuration><packageSources><clear /></packageSources></configuration>\n'
		, "README.md": `# ${model.assembly}

Install the prepared NuGet package and call ${model.namespace}.Api. The package includes its native Lean component and compatible shared runtime, verifies their hashes and loads them automatically. Consumers need .NET 8 on Linux x86-64 with the declared glibc floor, not Lean or native build tools. Libraries stay loaded until process exit. Calls after fork require a fresh process.

Records and named variant cases are sealed C# records. Array and List use typed arrays; returned values own independent storage. Nat and Int use BigInteger, Char uses Rune, and native words are 64-bit. Strings preserve Unicode scalar text and NUL; ByteArray uses byte[]. Unit arguments use default(Unit); Unit results return void. Binary products retain nested value tuples.

Option<T>.None, Some(default(Unit)) and nested Some(None) are distinct. Result<T,E>.Ok(value) and Err(error) retain their branch; default(Result<T,E>) is invalid. Record properties are init-only, while contained arrays remain mutable. Generated records, variants, Option and Result have bounded structural equality, matching hashes and formatting. Do not mutate contained arrays while their value is a dictionary key or set member. Concrete aliases retain metadata without extra CLR wrappers.

Inputs and outputs share a maximum depth of 128, 262,144 visited values, a 16 MiB native-copy budget and a separate 16 MiB accounted scratch/output budget. These do not bound Lean working memory or every CLR allocation overhead. Null payloads, invalid UTF-16, negative Nat, cycles, uninhabited values and invalid branches reject. Every argument validates before scratch allocation or Lean initialization; invalid cold calls do not load native libraries. Each call owns its scratch storage, and native outputs clear in finally. Allocation and limit failures are recoverable. Malformed native output retires the shared runtime, and retirement during conversion prevents publishing the result.

Structured callbacks, closures, resources and asynchronous values remain outside this recursive copied profile.
` };
	files["binding-manifest.json"] = `${JSON.stringify({ schemaVersion: 1
		, generator: "dotnet-copied-graph-v1", target: "dotnet"
		, component: ir.component.id, bindingIrSha256: hashBindingIr(ir)
		, namespace: model.namespace, assembly: model.assembly
		, files: Object.keys(files), publicFiles, internalFiles, packageFiles
		, aliases: model.aliases
		, copiedGraph: { schemaVersion: 1, layoutSha256: model.layoutSha256 }
		, supportedFeatures: ["direct-functions", "copied-values", "recursive-values", "deterministic-close"]
		, capabilityGaps: [{ feature: "identity-and-effects", reason: "Recursive C# packages support finite copied values, not callable, resource or asynchronous payloads." }
			, { feature: "additional-platforms", reason: "Compiled releases target .NET 8 on Linux x86-64 with glibc." }] }, null, 2)}\n`;
	return Object.freeze(files);
};
