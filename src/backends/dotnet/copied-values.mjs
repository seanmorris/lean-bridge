/**
 * Generate ordinary C# APIs backed by the checked native copied-value ABI.
 *
 * @file
 */
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { compileCopiedDotnetModel } from "./copied-model.mjs";
import { copiedConversions, copiedNativeTypes, copiedScope, copiedCompoundTypes } from "./copied-conversions.mjs";
import { dotnetValue, dotnetResult, dotnetNativeCall, dotnetCallableTypes, dotnetCallableState, dotnetCallableSupport, dotnetCallableImports, dotnetClosurePublic } from "./callables.mjs";
import { dotnetCopiedAliases, dotnetAliasCatalogDocs, dotnetAliasSiteDocs, dotnetAliasReadme } from "./copied-aliases.mjs";

const parameters = (model, fn) => fn.declaration.parameters.map((site, index) => `${model.publicType(dotnetValue(model, site.type))} @${fn.parameters[index].name}`).join(", ");
const args = fn => fn.parameters.map(parameter => `@${parameter.name}`).join(", ");
const returnsUnit = fn => fn.resultType === "void";
const resultType = (model, fn) => dotnetResult(model, dotnetValue(model, fn.declaration.result.type));

const loader = evidence => !evidence ? `    static Native() => throw new InvalidOperationException("Generate a compiled NuGet release before calling this API");` : `    private static readonly nint Handle = Load();
    static Native() => NativeLibrary.SetDllImportResolver(typeof(Native).Assembly, (name, assembly, searchPath) => name == Library ? Handle : 0);
    private static nint Load()
    {
        if (!OperatingSystem.IsLinux() || RuntimeInformation.ProcessArchitecture != Architecture.X64 || !BitConverter.IsLittleEndian)
            throw new PlatformNotSupportedException("This Lean package requires Linux x86-64 with glibc");
        var roots = new[] { Path.Combine(AppContext.BaseDirectory, "runtimes", "linux-x64", "native"), AppContext.BaseDirectory };
        var root = global::System.Array.Find(roots, path => File.Exists(Path.Combine(path, Library)))
            ?? throw new DllNotFoundException("The installed Lean native assets are missing");
${Object.entries(evidence.libraries).map(([file, digest]) => `        Verify(Path.Combine(root, ${JSON.stringify(file)}), ${JSON.stringify(digest)});`).join("\n")}
        var domain = AppDomain.CurrentDomain;
        lock (domain)
        {
            const string key = "lean-bridge.native-library-v1.dotnet";
            var registry = domain.GetData(key) as global::System.Collections.Generic.Dictionary<string, object>;
            if (registry is null)
            {
                registry = new();
                domain.SetData(key, registry);
            }
            const string identity = ${JSON.stringify(evidence.runtimeIdentity)};
            if (registry.TryGetValue("runtime", out var existing) && !Equals(existing, identity))
                throw new InvalidOperationException("Incompatible Lean runtime identities in one process");
            if (registry.TryGetValue("failed", out _)) throw new InvalidOperationException("Lean native loading failed earlier in this process");
            const string component = ${JSON.stringify(`component:${evidence.componentId}`)};
            const string receipt = ${JSON.stringify(evidence.componentReceiptSha256)};
            if (registry.TryGetValue(component, out var loaded))
            {
                var entry = (Tuple<string, nint>)loaded;
                if (entry.Item1 != receipt) throw new InvalidOperationException("Conflicting builds of the same Lean component");
                return entry.Item2;
            }
            try
            {
                if (existing is null)
                {
                    registry["runtime"] = identity;
                    registry["lean"] = NativeLibrary.Load(Path.Combine(root, "libleanshared.so"));
                    registry["broker"] = NativeLibrary.Load(Path.Combine(root, "liblean_bridge_native.so"));
                }
                var handle = NativeLibrary.Load(Path.Combine(root, Library));
                registry[component] = Tuple.Create(receipt, handle);
                return handle;
            }
            catch { registry["failed"] = true; throw; }
        }
    }
    private static void Verify(string path, string expected)
    {
        using var file = File.OpenRead(path);
        if (!string.Equals(Convert.ToHexString(global::System.Security.Cryptography.SHA256.HashData(file)), expected, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Installed Lean native library differs from the compiled package: " + Path.GetFileName(path));
    }`;

const runtimeSource = (model, evidence) => {
	const { surface } = model;
	return `using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace ${model.namespace}.Interop;

${copiedNativeTypes(model)}
[StructLayout(LayoutKind.Sequential)]
internal struct NativeError
{
    internal int Code;
    internal nint Message;
    internal nuint Length;
}

${copiedScope}
${surface.callbacks.size ? dotnetCallableState : ""}
${dotnetCallableTypes(model)}

internal static unsafe class Runtime
{
    private static readonly UTF8Encoding Utf8 = new(false, true);
    private static void Check(int status, NativeError error)
    {
        if (status == 0) return;
        var message = error.Message == 0 ? "Lean call failed" : Utf8.GetString(new ReadOnlySpan<byte>((void*)error.Message, checked((int)error.Length)));
        if (status == 1) throw new ArgumentException(message);
        throw new LeanBridgeException(status, message);
    }
${copiedConversions(model)}
${dotnetCallableSupport(model)}
${surface.functions.map((fn, index) => dotnetNativeCall(model, { name: `Call${index}`, native: `Call${index}`, parameters: fn.declaration.parameters, result: fn.declaration.result })).join("\n")}
}

internal static class Native
{
    private const string Library = ${JSON.stringify(evidence?.library ?? `lib${surface.prefix}.so`)};
${loader(evidence)}
${surface.functions.map((fn, index) => `    [DllImport(Library, EntryPoint = "${fn.name}", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call${index}(${fn.declaration.parameters.map((site, n) => { const copy = dotnetValue(model, site.type); return `${copy.aggregate || copy.type?.callable ? "in " : ""}${model.nativeType(copy)} input${n}`; }).concat(returnsUnit(fn) ? [] : [`ref ${dotnetValue(model, fn.declaration.result.type).type?.callable ? "nint" : model.nativeType(dotnetValue(model, fn.declaration.result.type))} output`]).concat("out NativeError error").join(", ")});`).join("\n")}
${dotnetCallableImports(model)}
${surface.copies.filter(copy => copy.aggregate).map(copy => `    [DllImport(Library, EntryPoint = "${copy.name}_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear${copy.index}(ref ${model.nativeType(copy)} value);`).join("\n")}
}
`;
};

/**
 * Render the copied-value model and optional compiled-native loading evidence.
 *
 * @param model - Closed C# model.
 * @param evidence - Private native library names and hashes, supplied after compilation.
 */
export const renderCopiedDotnetPackage = (model, evidence = null) => {
	const path = `src/${model.assembly}`, publicFiles = [`${path}/Api.cs`], internalFiles = [`${path}/Runtime.cs`], packageFiles = [`${path}/${model.assembly}.csproj`, "NuGet.Config"];
	const files = {
		[publicFiles[0]]: `namespace ${model.namespace};

/// <summary>The sole runtime value of Lean Unit.</summary>
public readonly record struct Unit;
${model.surface.copies.some(copy => copy.compound) ? copiedCompoundTypes : ""}
/// <summary>A failure reported by a compiled Lean call.</summary>
public sealed class LeanBridgeException : global::System.Exception
{
    public int Status { get; }
    internal LeanBridgeException(int status, string message) : base(message) => Status = status;
}
${model.surface.copies.filter(copy => copy.record || copy.variant).map(copy => copy.variant ? `/// <summary>A copied Lean variant. Construct a named case.</summary>
public abstract record ${copy.publicName}
{
    private protected ${copy.publicName}() { }
}
${copy.cases.map((branch, i) => `/// <summary>A named ${copy.publicName} constructor.</summary>\n${dotnetAliasSiteDocs(model, branch.fields.map((field, j) => ({ name: field.publicName, type: copy.variant.cases[i].fields[j].type })))}public sealed record ${branch.publicName}(${branch.fields.map(field => `${model.publicType(field.type)} ${field.publicName}`).join(", ")}) : ${copy.publicName};`).join("\n")}` : `/// <summary>A copied Lean record.</summary>\n${dotnetAliasSiteDocs(model, copy.fields.map((field, index) => ({ name: field.publicName, type: copy.record.fields[index].type })))}public sealed record ${copy.publicName}(${copy.fields.map(field => `${model.publicType(field.type)} ${field.publicName}`).join(", ")});`).join("\n")}
${model.surface.callbacks.size ? dotnetClosurePublic : ""}
/// <summary>The functions selected by the Lean package author.</summary>
${dotnetAliasCatalogDocs(model)}public static class Api
{
${model.surface.functions.map((fn, index) => `${dotnetAliasSiteDocs(model, fn.declaration.parameters.map((site, index) => ({ name: fn.parameters[index].name, type: site.type })), fn.declaration.result.type, returnsUnit(fn)).replace(/^\/\/\//gm, "    ///")}    public static ${resultType(model, fn)} ${fn.publicName}(${parameters(model, fn)}) => Interop.Runtime.Call${index}(${args(fn)});`).join("\n")}
}
`
		, [internalFiles[0]]: runtimeSource(model, evidence)
		, [packageFiles[0]]: `<Project Sdk="Microsoft.NET.Sdk">
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
		, "README.md": `# ${model.assembly}\n\nGenerated C# API: ${model.namespace}.Api. Nat and Int use System.Numerics.BigInteger; arrays and byte arrays own copied managed storage. Strings use strict UTF-8 and preserve embedded NUL. Unit parameters use default(Unit); Unit results return void. Native conversions share a 16 MiB per-call copy budget and accept nested arrays/acyclic records up to 32 types deep. Null records, strings and arrays, negative Nat values and invalid UTF-16 fail before invoking Lean. Callbacks use typed Func/Action delegates and borrow the synchronous call. Async delegates are rejected; callback arguments are independent managed copies. Callback exceptions retain identity and their original stack after native cleanup. Returned LeanClosure<TDelegate> values expose Invoke and IsClosed; use using/Dispose to release them. Invocation requires the creating thread; disposal can run on another thread and defers until active invocation finishes. Finalization is a fallback. Retaining Invoke retains the same lease, and all aliases reject after disposal. Calls after fork require a fresh process. The compiled NuGet release includes its runtime and checks native library hashes when loading.\n`
	};
	files["README.md"] += "\nLean Option uses Option<T>.None or Option<T>.Some(value); default(Option<T>) is None. Except E T uses Result<T, E>.Ok(value) or .Err(error); default(Result<T, E>) is invalid. Branches expose IsSome/Value or IsOk/IsError/Value/Error, and accessing an inactive payload throws. Domain errors return Err; bridge failures throw exceptions. Binary products use C# (A, B) tuples and retain their nesting. These values can nest with arrays and copied records. Active null reference payloads reject; a missing option never reads its inactive payload. Returned arrays own independent storage. Compound callable values and resource-containing copies remain unsupported.\n";
	if(model.surface.copies.some(copy => copy.ref.kind === "apply" && copy.ref.constructor === "list"))
		files["README.md"] += "\nLean List inputs, results and record fields use typed C# arrays. Returned arrays own independent storage; empty Lists, order, duplicates and nesting are preserved. List and Array retain distinct contract identities. Native sequence lengths, missing buffers and alignment are checked before allocation or reads. List callback payloads remain unsupported.\n";
	files["README.md"] += dotnetAliasReadme(model);
	if(model.surface.copies.some(copy => copy.variant))
		files["README.md"] += "\nConcrete copied Lean variants export an abstract record and one sealed record per constructor. Construct and pattern-match named cases without numeric tags or unmanaged layouts. Names use PascalCase and retain trailing underscores that distinguish source members. Only the active payload crosses the boundary. Empty constructors and Unit fields stay distinct. Null cases, active null payloads and unrecognized derived records reject. Results contain independent copied arrays; record properties are init-only, while array elements remain mutable and ordinary C# record equality compares array references. Conversion failures release native outputs and scoped scratch storage. Recursive, callable and identity-bearing payloads remain unsupported.\n";
	files["binding-manifest.json"] = `${JSON.stringify({ schemaVersion: 1, generator: "dotnet-copied-v1", target: "dotnet", component: model.ir.component.id, bindingIrSha256: hashBindingIr(model.ir), namespace: model.namespace, assembly: model.assembly, files: Object.keys(files), publicFiles, internalFiles, packageFiles, ...model.surface.aliases.length ? { aliases: dotnetCopiedAliases(model) } : {}, supportedFeatures: ["direct-functions", "copied-values", "deterministic-close", ...model.surface.callbacks.size ? ["primitive-callbacks", "owned-closures"] : []], capabilityGaps: [{ feature: "identity-and-effects", reason: "Ordinary packages admit copied values and synchronous primitive callables, not resources, compound callables or async delivery." }, { feature: "additional-platforms", reason: "Compiled releases target .NET 8 on Linux x86-64 with glibc." }] }, null, 2)}\n`;
	return Object.freeze(files);
};

/**
 * Generate a closed copied-value package from an ordinary source model.
 *
 * @param ir - Canonical Binding IR.
 * @param evidence - Optional compiled-native loading evidence.
 */
export const generateCopiedDotnetPackage = (ir, evidence = null) => renderCopiedDotnetPackage(compileCopiedDotnetModel(ir), evidence);
