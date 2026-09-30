/**
 * Typed owned C# call forwarding, callbacks and transactional publication.
 *
 * @file
 */
import { generateOwnedDotnetConversions } from "./owned-conversions.mjs";
import { ownedDotnetCallables } from "./owned-callables.mjs";
import { ownedDotnetRuntime } from "./owned-runtime.mjs";
import { dotnetGraphException } from "./copied-graph-runtime.mjs";
import { ownedDotnetTransfers } from "./owned-transfers.mjs";
import { ownedDotnetAnchoredCall, ownedDotnetOriginalTransfers, ownedDotnetWholeGuard } from "./owned-borrows.mjs";

/**
 * Library authentication is supplied by OwnedLoader. These bindings only accept
 * its resolved handle and pre-call verification hook; they never search paths.
 *
 * @param ir - Concrete compiler-authenticated ownership contract.
 * @param options - Explicit transport capabilities.
 */
export const generateOwnedDotnetCalls = (ir, options = {}) => {
	const model = generateOwnedDotnetConversions(ir, options), { c } = model;
	const transfers = c.functions.some(fn => fn.transfers?.length);
	const anchored = c.functions.some(fn => fn.anchor !== undefined);
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const names = new Map(model.nativeTypes.map(node => [node.id, node.publicType]));
	const calls = [
		...model.functions.map((fn, index) => ({ ...fn, method: `Call${index}` }))
		, ...c.retains.map(fn => ({ ...fn, method: `Retain${nodes.get(fn.id).index}`, handle: true, ...anchored ? { rawResult: true } : {} }))
		, ...c.copies.map(fn => ({ ...fn, method: `Copy${nodes.get(fn.id).index}`, ...anchored ? { rawResult: true } : {} }))
		, ...c.callbacks.map(fn => ({ ...fn, method: `Invoke${nodes.get(fn.id).index}`, handle: true }))
		, ...anchored ? [
			...c.callbacks.map(fn => ({ ...fn, method: `InvokeRaw${nodes.get(fn.id).index}`, handle: true, rawResult: true }))
			, ...[...c.retains, ...c.copies].filter(fn => nodes.get(fn.id).representation !== "copied")
				.map(fn => ({ ...fn, method: `CopyWhole${nodes.get(fn.id).index}`, wholeCopy: true }))
		] : []
	];
	const symbols = [...calls.map(fn => fn.cName), ...anchored ? model.types.filter(node => node.identity).map(node => `${node.cName}_equal`) : []];
	const parameterType = (fn, index) => fn.handle && index === 0 ? "OwnedHandle"
		: c.hostArgument(fn, index) ? `_V.${nodes.get(fn.parameters[index]).delegateType}`
			: anchored && (fn.anchor === index || fn.transfers?.includes(index)) ? `_V.Value<${names.get(fn.parameters[index])}>` : names.get(fn.parameters[index]);
	const returnType = fn => anchored && !fn.rawResult && nodes.get(fn.result).representation !== "copied"
		? `_V.Value<${names.get(fn.result)}>` : names.get(fn.result);
	let budget = 16 * 1024 * 1024 - model.source.length - model.valuesSource.length;
	for(const fn of calls)
	{
		budget -= 4096 + names.get(fn.result).length * 8;
		for(let i = 0; i < fn.parameters.length; i++) budget -= 256 + parameterType(fn, i).length * 8;
		if(budget < 0) throw new TypeError("Owned C# call bindings exceed 16 MiB");
	}
	const callback = ownedDotnetCallables(model, symbols);
	const methods = calls.map(fn => {
		if(anchored) return ownedDotnetAnchoredCall({ c, nodes, names, calls, symbols, parameterType, returnType }, fn);
		const result = nodes.get(fn.result), parameters = fn.parameters.map(id => nodes.get(id));
		const moving = fn.transfers ?? [];
		const write = (node, index, scope, checking) => fn.handle && index === 0 ? `${scope}.Root(arg${index})`
			: c.hostArgument(fn, index) ? `Host${node.index}(arg${index}, ${scope}${checking ? "" : ", frame"})`
				: `OwnedConvert.Write${node.index}(arg${index}, ${scope})`;
		const nativeTypes = parameters.flatMap((node, index) => [c.hostArgument(fn, index)
			? `OwnedCallback${node.index}*` : node.raw + (node.leaf ? "" : "*")
			, ...moving.includes(index) ? ["nint*"] : []]);
		const pointer = `delegate* unmanaged[Cdecl]<${["nint", ...nativeTypes, `${result.raw}*`, "nint*", "uint"].join(", ")}>`;
		const inputs = parameters.flatMap((node, index) => [
			...moving.length ? [`        inputs.MoveGroup = ${moving.includes(index) ? moving.indexOf(index) : -1};`] : []
			, `        var input${index} = ${write(node, index, "inputs", false)};`
		]).join("\n");
		const snapshots = moving.flatMap((index, group) => {
			const node = parameters[index], copy = [...c.retains, ...c.copies].find(item => item.id === node.id);
			if(!copy) throw new TypeError(`Missing owned C# input snapshot for ${node.id}`);
			const signature = `delegate* unmanaged[Cdecl]<nint, ${node.raw}${node.leaf ? "" : "*"}, ${node.raw}*, nint*, uint>`;
			return [`        var moved${index} = default(${node.raw});`
				, `        var prepare${index} = (${signature})symbols[${symbols.indexOf(copy.cName)}];`
				, `        fixed (nint* preparedOwner${index} = &moves.Owners[${group}].Value)`
				, `            OwnedRuntime.Check(prepare${index}(state.Require(), ${node.leaf ? "" : "&"}input${index}, &moved${index}, preparedOwner${index}));`];
		}).join("\n");
		const arguments_ = [moving.length ? "session" : "state.Require()"
			, ...parameters.flatMap((node, index) => moving.includes(index)
				? [`${node.leaf ? "" : "&"}moved${index}`, `inputOwner${index}`]
				: [`${c.hostArgument(fn, index) || !node.leaf ? "&" : ""}input${index}`])
			, "&output", "resultOwner"].join(", ");
		const invoke = moving.length ? `            var session = state.Require();
            moves.Arm();
            uint status;
            try
            {
                fixed (nint* resultOwner = &owner.Value)
${moving.map((index, group) => `                fixed (nint* inputOwner${index} = &moves.Owners[${group}].Value)`).join("\n")}
                    status = invoke(${arguments_});
            }
            finally { moves.Finish(); }
            frame.Finish(status);` : `            fixed (nint* resultOwner = &owner.Value)
                frame.Finish(invoke(${arguments_}));`;
		return `    internal ${names.get(result.id)} ${fn.method}(${parameters.map((_, index) => `${parameterType(fn, index)} arg${index}`).join(", ")})
    {
        var state = Runtime.Current; state.Require(); Ready();
        using (var check = new OwnedValueScope(state, Factories, checkOnly: true))
        {
${parameters.map((node, index) => `            ${write(node, index, "check", true)};`).join("\n")}
        }
        using var inputs = new OwnedValueScope(state, Factories);
        using var frame = new OwnedCallFrame(inputs);${moving.length ? `
        using var moves = new OwnedInputTransfers(state, ${moving.length}, inputs);
        inputs.Moves = moves;` : ""}
${inputs}
${moving.length ? `        inputs.MoveGroup = -1;\n${snapshots}\n` : ""}\
        using var owner = new OwnedResult(state);
        using var outputs = new OwnedValueScope(state, Factories, lease: owner.Adopt);
        var output = default(${result.raw});
        try
        {
            var invoke = (${pointer})symbols[${symbols.indexOf(fn.cName)}];
${invoke}
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
		return `handle => new _V.${node.publicType}(handle, Retain${node.index}${fn ? `, (${fn.invokeParameters.map((_, j) => `arg${j}`).join(", ")}) => Invoke${node.index}(handle${fn.invokeParameters.map((_, j) => `, arg${j}`).join("")})` : ""}${anchored ? `, Equal${node.index}${fn ? `, (${fn.invokeParameters.map((_, j) => `arg${j}`).join(", ")}) => InvokeRaw${node.index}(handle${fn.invokeParameters.map((_, j) => `, arg${j}`).join("")})` : ""}` : ""})`;
	});
	if(anchored) for(const node of identities) methods.push(`    private bool Equal${node.index}(OwnedHandle left, OwnedHandle right)
    {
        var state = Runtime.Current; state.Require(); Ready();
        using var inputs = new OwnedValueScope(state, Factories);
        var a = inputs.Root(left); var b = inputs.Root(right); byte result = 0;
        var equal = (delegate* unmanaged[Cdecl]<nint, nint, nint, byte*, uint>)symbols[${symbols.indexOf(node.cName + "_equal")}];
        OwnedRuntime.Check(equal(state.Require(), a, b, &result));
        Ready();
        if (result > 1) { retire(); throw new _V.LeanBridgeException(9, "Invalid canonical equality result"); }
        return result != 0;
    }`);
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
	const copies = [];
	if(anchored)
	{
		const claimed = new Set(model.functions.map(fn => fn.publicName));
		const add = (name, id, overload = false) => {
			if(!overload && claimed.has(name)) throw new TypeError(`C# whole-value copy name collides: ${name}`);
			claimed.add(name);
			const fn = calls.find(item => item.wholeCopy && item.id === id);
			copies.push(`    public static _V.Value<${names.get(id)}> ${name}(${names.get(id)} value) => Interop.OwnedLoader.Bindings.${fn.method}(value);`);
		};
		for(const fn of model.functions)
		{
			if(nodes.get(fn.result).representation !== "copied") add(`Copy${fn.publicName}Result`, fn.result);
			for(const [index, id] of fn.parameters.entries())
				if(nodes.get(id).representation !== "copied" && !c.hostArgument(fn, index)) add(`Copy${fn.publicName}Arg${index}`, id);
		}
		const typed = calls.filter(fn => fn.wholeCopy);
		if(claimed.has("CopyValue")) throw new TypeError("C# whole-value copy name collides: CopyValue");
		for(const fn of typed) if(typed.filter(other => names.get(other.id) === names.get(fn.id)).length === 1) add("CopyValue", fn.id, true);
	}
	const api = `using _V = global::${model.namespace};
namespace ${model.namespace};
public static class Api
{
${model.functions.map((fn, index) => `${fn.transfers?.length ? `    /// <summary>Consumes resource leases in ${fn.transfers.map(i => `arg${i}`).join(", ")} at the Lean call boundary. Shared aliases close; independent retains survive. Pre-handoff errors preserve ownership.</summary>\n` : ""}    public static ${nodes.get(fn.result).name === "unit" ? "void" : returnType(fn)} ${fn.publicName}(${fn.parameters.map((_, i) => `${parameterType(fn, i)} arg${i}`).join(", ")}) => Interop.OwnedLoader.Bindings.Call${index}(${fn.parameters.map((_, i) => `arg${i}`).join(", ")});`).join("\n")}${anchored ? "\n" + copies.join("\n") : ""}
}
${callback.publicSource}
`;
	const runtime = `using ${model.namespace};\nnamespace ${model.namespace}.Interop;\n${ownedDotnetRuntime(c.prefix, { includeException: false, transferredInputs: transfers, anchoredResults: anchored })}${anchored ? ownedDotnetWholeGuard : ""}${transfers ? anchored ? ownedDotnetOriginalTransfers : ownedDotnetTransfers : ""}`;
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
