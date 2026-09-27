/**
 * Typed owned C# call forwarding, callbacks and transactional publication.
 *
 * @file
 */
import { generateOwnedDotnetConversions } from "./owned-conversions.mjs";
import { ownedDotnetCallables } from "./owned-callables.mjs";
import { ownedDotnetRuntime } from "./owned-runtime.mjs";
import { dotnetGraphException } from "./copied-graph-runtime.mjs";

/**
 * Library authentication is supplied by OwnedLoader. These bindings only accept
 * its resolved handle and pre-call verification hook; they never search paths.
 *
 * @param ir - Concrete compiler-authenticated ownership contract.
 */
export const generateOwnedDotnetCalls = ir => {
	const model = generateOwnedDotnetConversions(ir), { c } = model;
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const names = new Map(model.nativeTypes.map(node => [node.id, node.publicType]));
	const calls = [
		...model.functions.map((fn, index) => ({ ...fn, method: `Call${index}` }))
		, ...c.retains.map(fn => ({ ...fn, method: `Retain${nodes.get(fn.id).index}`, handle: true }))
		, ...c.copies.map(fn => ({ ...fn, method: `Copy${nodes.get(fn.id).index}` }))
		, ...c.callbacks.map(fn => ({ ...fn, method: `Invoke${nodes.get(fn.id).index}`, handle: true }))
	];
	const symbols = calls.map(fn => fn.cName);
	const parameterType = (fn, index) => fn.handle && index === 0 ? "OwnedHandle"
		: c.hostArgument(fn, index) ? `_V.${nodes.get(fn.parameters[index]).delegateType}` : names.get(fn.parameters[index]);
	let budget = 16 * 1024 * 1024 - model.source.length - model.valuesSource.length;
	for(const fn of calls)
	{
		budget -= 4096 + names.get(fn.result).length * 8;
		for(let i = 0; i < fn.parameters.length; i++) budget -= 256 + parameterType(fn, i).length * 8;
		if(budget < 0) throw new TypeError("Owned C# call bindings exceed 16 MiB");
	}
	const callback = ownedDotnetCallables(model, symbols);
	const methods = calls.map(fn => {
		const result = nodes.get(fn.result), parameters = fn.parameters.map(id => nodes.get(id));
		const write = (node, index, scope, checking) => fn.handle && index === 0 ? `${scope}.Root(arg${index})`
			: c.hostArgument(fn, index) ? `Host${node.index}(arg${index}, ${scope}${checking ? "" : ", frame"})`
				: `OwnedConvert.Write${node.index}(arg${index}, ${scope})`;
		const nativeTypes = parameters.map((node, index) => c.hostArgument(fn, index)
			? `OwnedCallback${node.index}*` : node.raw + (node.leaf ? "" : "*"));
		const pointer = `delegate* unmanaged[Cdecl]<${["nint", ...nativeTypes, `${result.raw}*`, "nint*", "uint"].join(", ")}>`;
		return `    internal ${names.get(result.id)} ${fn.method}(${parameters.map((_, index) => `${parameterType(fn, index)} arg${index}`).join(", ")})
    {
        var state = Runtime.Current; state.Require(); Ready();
        using (var check = new OwnedValueScope(state, Factories, checkOnly: true))
        {
${parameters.map((node, index) => `            ${write(node, index, "check", true)};`).join("\n")}
        }
        using var inputs = new OwnedValueScope(state, Factories);
        using var frame = new OwnedCallFrame(inputs);
${parameters.map((node, index) => `        var input${index} = ${write(node, index, "inputs", false)};`).join("\n")}
        using var owner = new OwnedResult(state);
        using var outputs = new OwnedValueScope(state, Factories, lease: owner.Adopt);
        var output = default(${result.raw});
        try
        {
            var invoke = (${pointer})symbols[${symbols.indexOf(fn.cName)}];
            fixed (nint* resultOwner = &owner.Value)
                frame.Finish(invoke(${["state.Require()", ...parameters.map((node, index) => `${c.hostArgument(fn, index) || !node.leaf ? "&" : ""}input${index}`), "&output", "resultOwner"].join(", ")}));
            Ready();
            var result = OwnedConvert.Read${result.index}(&output, outputs);
            OwnedRuntime.Checkpoint(); Ready(); owner.Complete();
            return result;
        }
        catch (OwnedInvalidNative error)
        {
            Runtime.EnsureProcess(); retire();
            throw new _V.LeanBridgeException(9, error.Message, error);
        }
    }`;
	});
	const identities = model.types.filter(node => node.identity), factories = identities.map(node => {
		const fn = model.callbacks.find(fn => fn.id === node.id);
		return `handle => new _V.${node.publicType}(handle, Retain${node.index}${fn ? `, (${fn.invokeParameters.map((_, j) => `arg${j}`).join(", ")}) => Invoke${node.index}(handle${fn.invokeParameters.map((_, j) => `, arg${j}`).join("")})` : ""})`;
	});
	const component = JSON.stringify(model.c.native.model.component.id + "\0");
	const source = `using _V = global::${model.namespace};
using ${model.namespace};
namespace ${model.namespace}.Interop;
${callback.definitions}
internal sealed unsafe class OwnedBindings
{
    internal readonly OwnedRuntime Runtime;
    internal readonly OwnedFactories Factories;
    private readonly nint[] symbols;
    private readonly delegate* unmanaged[Cdecl]<byte*, int> ready;
    private readonly delegate* unmanaged[Cdecl]<void> retire;
    internal OwnedBindings(nint library, global::System.Action? before = null)
    {
        Runtime = new OwnedRuntime(library, before); Runtime.EnsureProcess();
        symbols = new nint[] { ${symbols.map(symbol => `global::System.Runtime.InteropServices.NativeLibrary.GetExport(library, ${JSON.stringify(symbol)})`).join(",\n            ")} };
        ready = (delegate* unmanaged[Cdecl]<byte*, int>)global::System.Runtime.InteropServices.NativeLibrary.GetExport(library, "lean_bridge_native_component_ready");
        retire = (delegate* unmanaged[Cdecl]<void>)global::System.Runtime.InteropServices.NativeLibrary.GetExport(library, "lean_bridge_native_runtime_retire");
        Factories = new(${factories.join(",\n            ")});
    }
    private void Ready()
    {
        Runtime.EnsureProcess();
        global::System.ReadOnlySpan<byte> component = ${component}u8;
        fixed (byte* name = component) if (ready(name) == 0) OwnedRuntime.Check(7);
    }
${methods.join("\n")}
${callback.methods}
}
`;
	const api = `using _V = global::${model.namespace};
namespace ${model.namespace};
public static class Api
{
${model.functions.map((fn, index) => `    public static ${nodes.get(fn.result).name === "unit" ? "void" : names.get(fn.result)} ${fn.publicName}(${fn.parameters.map((_, i) => `${parameterType(fn, i)} arg${i}`).join(", ")}) => Interop.OwnedLoader.Bindings.Call${index}(${fn.parameters.map((_, i) => `arg${i}`).join(", ")});`).join("\n")}
}
${callback.publicSource}
`;
	const runtime = `using ${model.namespace};\nnamespace ${model.namespace}.Interop;\n${ownedDotnetRuntime(c.prefix, { includeException: false })}`;
	if(source.length + api.length + runtime.length + model.source.length + model.valuesSource.length > 16 * 1024 * 1024)
		throw new TypeError("Owned C# call bindings exceed 16 MiB");
	return { ...model, calls, symbols
		, files: {
			"Values.cs": model.valuesSource + "\n" + dotnetGraphException
			, "Conversions.cs": model.source, "Lifetime.cs": runtime
			, "Calls.cs": source, "Api.cs": api
		}
	};
};
