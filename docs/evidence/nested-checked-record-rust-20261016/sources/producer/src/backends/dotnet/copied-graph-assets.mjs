/**
 * Authenticated lazy native loading for recursive C# packages.
 *
 * @file
 */
import { verifiedDotnetAssets } from "./verified-assets.mjs";

/**
 * Share the ordinary .NET registry without capturing public Lean type names.
 *
 * @param model - Checked graph package model.
 * @param evidence - Verified native filenames and hashes, or null for inspection.
 * @param selectedSymbols - Optional exact callable entry points and lifecycle symbols.
 */
export const dotnetGraphAssets = (model, evidence, selectedSymbols = null) => {
	if(evidence !== null && (evidence.componentId !== model.ir.component.id || evidence.library !== `lib${model.prefix}.so`))
		throw new TypeError("C# graph loading evidence differs from the component");
	const symbols = selectedSymbols ?? [...model.functions.map(fn => `${fn.name}_graph`), ...["initialize", "ready", "retire"].map(name => `${model.prefix}_graph_${name}`)];
	if(!Array.isArray(symbols) || symbols.length === 0 || symbols.length !== new Set(symbols).size || symbols.some(name => !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)))
		throw new TypeError("C# graph loading requires distinct checked symbol names");
	return `internal static class GraphNative
{
    private static class Assets
    {
${verifiedDotnetAssets(evidence)}
    }
    private static nint[]? symbols;
    internal static bool IsLoaded => Assets.IsLoaded;
    internal static nint[] Resolve()
    {
        Assets.EnsureProcess();
        var ready = global::System.Threading.Volatile.Read(ref symbols);
        if (ready != null) return ready;
        var handle = Assets.Handle;
        var resolved = new nint[${symbols.length}];
${symbols.map((name, index) => `        resolved[${index}] = global::System.Runtime.InteropServices.NativeLibrary.GetExport(handle, ${JSON.stringify(name)});`).join("\n")}
        return global::System.Threading.Interlocked.CompareExchange(ref symbols, resolved, null) ?? resolved;
    }
}
`;
};
