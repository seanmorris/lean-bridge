/**
 * Authenticated lazy native loading for recursive C# packages.
 *
 * @file
 */

/**
 * Share the ordinary .NET registry without capturing public Lean type names.
 *
 * @param model - Checked graph package model.
 * @param evidence - Verified native filenames and hashes, or null for inspection.
 */
export const dotnetGraphAssets = (model, evidence) => {
	if(evidence === null) return `internal static class GraphNative
{
    internal static bool IsLoaded => false;
    internal static nint[] Resolve() => throw new global::System.InvalidOperationException("Build a prepared NuGet release before calling this API");
}
`;
	if(evidence.componentId !== model.ir.component.id || evidence.library !== `lib${model.prefix}.so`
		|| !/^[a-f0-9]{64}$/.test(evidence.runtimeIdentity) || !/^[a-f0-9]{64}$/.test(evidence.componentReceiptSha256)
		|| !evidence.libraries || typeof evidence.libraries !== "object" || Array.isArray(evidence.libraries))
		throw new TypeError("C# graph loading evidence differs from the component");
	const libraries = Object.entries(evidence.libraries).sort(([a], [b]) => a.localeCompare(b));
	if(libraries.length < 4 || libraries.some(([name, hash]) => !/^lib[A-Za-z0-9_.-]+\.so(?:\.\d+)*$/.test(name) || !/^[a-f0-9]{64}$/.test(hash))
		|| [evidence.library, "libleanshared.so", "liblean_bridge_native.so"].some(name => !Object.hasOwn(evidence.libraries, name)))
		throw new TypeError("C# graph loading requires exact native asset identities");
	const symbols = [...model.functions.map(fn => `${fn.name}_graph`), ...["initialize", "ready", "retire"].map(name => `${model.prefix}_graph_${name}`)];
	return `internal static class GraphNative
{
    private static readonly int Process = global::System.Environment.ProcessId;
    private static nint[]? symbols;
    internal static bool IsLoaded => global::System.Threading.Volatile.Read(ref symbols) != null;
    internal static nint[] Resolve()
    {
        if (Process != global::System.Environment.ProcessId)
            throw new global::System.InvalidOperationException("Lean calls after fork require a fresh process");
        var ready = global::System.Threading.Volatile.Read(ref symbols);
        if (ready != null) return ready;
        if (!global::System.OperatingSystem.IsLinux()
            || global::System.Runtime.InteropServices.RuntimeInformation.ProcessArchitecture != global::System.Runtime.InteropServices.Architecture.X64
            || !global::System.BitConverter.IsLittleEndian)
            throw new global::System.PlatformNotSupportedException("This Lean package requires Linux x86-64 with glibc");
        const string library = ${JSON.stringify(evidence.library)};
        var roots = new[] { global::System.IO.Path.Combine(global::System.AppContext.BaseDirectory, "runtimes", "linux-x64", "native"), global::System.AppContext.BaseDirectory };
        var root = global::System.Array.Find(roots, path => global::System.IO.File.Exists(global::System.IO.Path.Combine(path, library)))
            ?? throw new global::System.DllNotFoundException("The installed Lean native assets are missing");
${libraries.map(([file, hash]) => `        Verify(global::System.IO.Path.Combine(root, ${JSON.stringify(file)}), ${JSON.stringify(hash)});`).join("\n")}
        var resolved = new nint[${symbols.length}];
        var domain = global::System.AppDomain.CurrentDomain;
        lock (domain)
        {
            ready = global::System.Threading.Volatile.Read(ref symbols);
            if (ready != null) return ready;
            const string key = "lean-bridge.native-library-v1.dotnet";
            var registry = domain.GetData(key) as global::System.Collections.Generic.Dictionary<string, object>;
            if (registry is null)
            {
                registry = new(global::System.StringComparer.Ordinal);
                domain.SetData(key, registry);
            }
            const string identity = ${JSON.stringify(evidence.runtimeIdentity)};
            if (registry.TryGetValue("runtime", out var existing) && !global::System.Object.Equals(existing, identity))
                throw new global::System.InvalidOperationException("Incompatible Lean runtime identities in one process");
            if (registry.ContainsKey("failed")) throw new global::System.InvalidOperationException("Lean native loading failed earlier in this process");
            const string component = ${JSON.stringify(`component:${evidence.componentId}`)};
            const string receipt = ${JSON.stringify(evidence.componentReceiptSha256)};
            nint handle = 0;
            if (registry.TryGetValue(component, out var loaded))
            {
                var entry = (global::System.Tuple<string, nint>)loaded;
                if (entry.Item1 != receipt) throw new global::System.InvalidOperationException("Conflicting builds of the same Lean component");
                handle = entry.Item2;
            }
            try
            {
                if (existing is null)
                {
                    registry["runtime"] = identity;
                    registry["lean"] = global::System.Runtime.InteropServices.NativeLibrary.Load(global::System.IO.Path.Combine(root, "libleanshared.so"));
                    registry["broker"] = global::System.Runtime.InteropServices.NativeLibrary.Load(global::System.IO.Path.Combine(root, "liblean_bridge_native.so"));
                }
                if (handle == 0) handle = global::System.Runtime.InteropServices.NativeLibrary.Load(global::System.IO.Path.Combine(root, library));
${symbols.map((name, index) => `                resolved[${index}] = global::System.Runtime.InteropServices.NativeLibrary.GetExport(handle, ${JSON.stringify(name)});`).join("\n")}
                registry[component] = global::System.Tuple.Create(receipt, handle);
                global::System.Threading.Volatile.Write(ref symbols, resolved);
                return resolved;
            }
            catch { registry["failed"] = true; throw; }
        }
    }
    private static void Verify(string path, string expected)
    {
        using var file = global::System.IO.File.OpenRead(path);
        if (!string.Equals(global::System.Convert.ToHexString(global::System.Security.Cryptography.SHA256.HashData(file)), expected, global::System.StringComparison.OrdinalIgnoreCase))
            throw new global::System.InvalidOperationException("Installed Lean native library differs from the compiled package: " + global::System.IO.Path.GetFileName(path));
    }
}
`;
};
