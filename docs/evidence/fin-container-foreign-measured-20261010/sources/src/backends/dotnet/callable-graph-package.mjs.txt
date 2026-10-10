/**
 * Public recursive C# callables with authenticated lazy NuGet loading.
 *
 * @file
 */
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { generateCallableDotnetGraphSources } from "./callable-graph-calls.mjs";
import { compileCallableDotnetGraphPackageModel } from "./callable-graph-model.mjs";

/**
 * Generate typed source whose public surface does not depend on loader inputs.
 *
 * @param ir - Compiler-checked public contract, including recursive payloads.
 * @param evidence - Verified native loading identities, or null for inspection.
 */
export const generateCallableDotnetGraphPackage = (ir, evidence = null) => {
	const model = compileCallableDotnetGraphPackageModel(ir), path = "src/" + model.assembly;
	const generated = generateCallableDotnetGraphSources(model, evidence);
	const publicFiles = [path + "/Values.cs", path + "/Api.cs"], internalFiles = [path + "/Runtime.cs", path + "/Calls.cs"];
	const project = path + "/" + model.assembly + ".csproj", packageFiles = [project, "NuGet.Config"];
	const files = Object.fromEntries(Object.entries(generated.files).map(([name, contents]) => [path + "/" + name, contents]));
	files[project] = `<Project Sdk="Microsoft.NET.Sdk">
 <PropertyGroup>
  <TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>disable</ImplicitUsings>
  <AllowUnsafeBlocks>true</AllowUnsafeBlocks><GenerateDocumentationFile>true</GenerateDocumentationFile>
  <NoWarn>1591</NoWarn><TreatWarningsAsErrors>true</TreatWarningsAsErrors><Deterministic>true</Deterministic>
  <AssemblyName>${model.assembly}</AssemblyName><Version>${ir.component.version}</Version>
  <DebugType>none</DebugType><EnableNETAnalyzers>false</EnableNETAnalyzers>
 </PropertyGroup>
</Project>\n`;
	files["NuGet.Config"] = '<configuration><packageSources><clear /></packageSources></configuration>\n';
	files["README.md"] = `# ${model.assembly}

Install the prepared NuGet package and call ${model.namespace}.Api. Its native
component and compatible Lean runtime load automatically after their hashes are
checked. Consumers need .NET 8 on Linux x86-64 with the declared glibc floor.

Records and named constructors are sealed C# records. Array and List use typed
arrays. Nat and Int use BigInteger, Char uses Rune, and native words are 64-bit.
Products keep nested value tuples. Option<T> distinguishes None, Some(Unit) and
Some(None). Result<T,E>.Ok and Err preserve the active branch; default(Result<T,E>)
is invalid. Every returned value has independent copied storage. Record fields
are init-only, but contained arrays remain mutable. Equality and hashing are
structural and bounded. Do not mutate a value while using it as a dictionary key.

Callbacks use synchronous Func/Action delegates. A returned LeanClosure<TDelegate>
exposes Invoke, IsClosed and Dispose. Use a using statement for deterministic
release; finalization is a fallback. Invocation belongs to the original creating
thread and process. Disposal during an active invocation defers release until the
call returns. A new thread cannot acquire a departed thread's closure. Callbacks
expire when their call finishes. Callback errors retain their exception objects
and return after conversion storage and native outputs are released.

Conversions allow 128 value levels, 262144 visited nodes, a 16 MiB native-copy
budget and a separate 16 MiB accounted storage budget. Native reentry allows 64
active calls; returned closures share 4096 identity slots. These limits do not
bound Lean working memory or all CLR allocation overhead. Cycles, negative Nat,
invalid UTF-16, null payloads and invalid branches reject before entering Lean.
Invalid cold calls do not load Lean libraries. Ordinary input, callback and
allocation failures allow recovery. Malformed native output retires the runtime.

Resource and callable identities inside copied containers, retained host
callbacks, asynchronous delivery and post-fork reuse are unsupported. Use a
fresh process after fork. Native libraries remain loaded until process exit.
`;
	files["binding-manifest.json"] = JSON.stringify({ schemaVersion: 1
		, generator: "dotnet-callable-graph-v1", target: "dotnet"
		, component: ir.component.id, bindingIrSha256: hashBindingIr(ir)
		, namespace: model.namespace, assembly: model.assembly
		, files: Object.keys(files), publicFiles, internalFiles, packageFiles
		, aliases: model.aliases
		, copiedGraph: { schemaVersion: 1, layoutSha256: model.layoutSha256 }
		, supportedFeatures: ["direct-functions", "copied-values", "recursive-values", "typed-callbacks", "owned-closures", "deterministic-close"]
		, capabilityGaps: [{ feature: "identity-and-effects", reason: "Copied callback payloads exclude nested callable identities, resources and asynchronous values." }
			, { feature: "additional-platforms", reason: "Compiled releases target .NET 8 on Linux x86-64 with glibc." }]
	}, null, 2) + "\n";
	return Object.freeze(files);
};
