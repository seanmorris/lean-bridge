/**
 * Render typed C# callback thunks and exception-safe native graph calls.
 *
 * @file
 */
import { state, publicClosure } from "./callable-graph-runtime.mjs";
import { dotnetGraphAssets } from "./copied-graph-assets.mjs";

/**
 * Keep callbacks typed and retain borrowed replies until native copying ends.
 *
 * @param model - Checked copied payloads, public declarations and callable signatures.
 * @param evidence - Verified native asset identities, or null for inspection.
 */
export const generateCallableDotnetGraphSources = (model, evidence) => {
	const callbacks = [...model.callbacks.values()];
	const ready = model.prefix + "_graph_ready", retire = model.prefix + "_graph_retire";
	const symbols = [...model.functions.map(fn => fn.native), ...callbacks.flatMap(cb => [cb.call, cb.dispose]), ready, retire];
	const symbol = name => `symbols[${symbols.indexOf(name)}]`;
	const raw = value => value.callback ? `GraphCallback${value.callback.index}` : value.node.raw;
	const publicType = value => value.callback ? value.callback.publicType : value.node.publicType;
	const unit = value => !value.callback && value.node.ref.kind === "primitive" && value.node.ref.name === "unit";
	const resultType = value => value.callback ? `_V.LeanClosure<${value.callback.publicType}>` : unit(value) ? "void" : value.node.publicType;
	const render = (name, parameters, result, native, lease = null) => {
		const args = parameters.map((p, index) => `${publicType(p)} arg${index}`);
		const output = result.callback ? "ulong" : result.node.raw;
		const signature = `delegate* unmanaged[Cdecl]<${[...lease ? ["ulong"] : [], ...parameters.map(p => raw(p) + "*"), output + "*", "uint"].join(", ")}>`;
		return `    internal static ${resultType(result)} ${name}(${[...lease ? ["ClosureLease lease"] : [], ...args].join(", ")})
    {
        ProcessGuard.Ensure();
        ${lease?'using var active = lease.Enter();':''}
        using (var check = new GraphScope(true))
        {
${parameters.map((p,index)=>p.callback?`            CallbackFrame.Validate(arg${index});`:`            GraphRuntime.Write${p.node.index}(arg${index}, check);`).join('\n')}
        }
        using var scope = new GraphScope();
        using var frame = new CallbackFrame(scope);
${parameters.map((p,index)=>`        var input${index} = ${p.callback?`Borrow${p.callback.index}(arg${index}, frame)`:`GraphRuntime.Write${p.node.index}(arg${index}, scope)`};`).join('\n')}
        var symbols = GraphNative.Resolve();
        var lifecycle = new GraphLifecycle(null, (delegate* unmanaged[Cdecl]<int>)${symbol(ready)}, (delegate* unmanaged[Cdecl]<void>)${symbol(retire)});
        var output = default(${output});
        ${result.callback?`var created = new ClosureLease((delegate* unmanaged[Cdecl]<ulong, void>)${symbol(result.callback.dispose)});
        var published = new _V.LeanClosure<${result.callback.publicType}>((${result.callback.parameters.map((_,i)=>`p${i}`).join(', ')}) => Invoke${result.callback.index}(created, ${result.callback.parameters.map((_,i)=>`p${i}`).join(', ')}), created);`:''}
        try
        {
            var status = ((${signature})${symbol(native)})(${[...lease?['active.Token']:[],...parameters.map((_,i)=>'&input'+i),'&output'].join(', ')});
            frame.Finish(status);
            lifecycle.After();
            ${result.callback?'created.Adopt(ref output); return published;':`var copied = GraphRuntime.Read${result.node.index}(&output, scope);
            GraphRuntime.Checkpoint(); lifecycle.After();
            ${unit(result)?'return;':'return copied;'}`}
        }
        catch (GraphInvalidNative error)
        {
            lifecycle.Poison(); throw new _V.LeanBridgeException(4, error.Message, error);
        }
        finally
        {
            ${result.callback?`if (output != 0) ((delegate* unmanaged[Cdecl]<ulong, void>)${symbol(result.callback.dispose)})(output);`:result.node.aggregate?'GraphRuntime.Clear(ref output.Owner, ref output.Release);':''}
        }
    }`;
	};
	const declarations = [], methods = [];
	for(const cb of callbacks)
	{
		const arguments_ = ["nint context", ...cb.parameters.map((node, i) => `${node.raw}* p${i}`), `${cb.result.raw}* output`];
		declarations.push(`[global::System.Runtime.InteropServices.StructLayout(global::System.Runtime.InteropServices.LayoutKind.Sequential)]
internal struct GraphCallback${cb.index} { internal nint Call; internal nint Context; }
[global::System.Runtime.InteropServices.UnmanagedFunctionPointer(global::System.Runtime.InteropServices.CallingConvention.Cdecl)]
internal unsafe delegate uint GraphDelegate${cb.index}(${arguments_.join(', ')});`);
		methods.push(`    private static GraphCallback${cb.index} Borrow${cb.index}(${cb.publicType} callback, CallbackFrame frame)
    {
        GraphDelegate${cb.index} invoke = (${arguments_.join(', ')}) =>
        {
            if (frame.Failure is not null) return 6;
            try
            {
                frame.Before();
                var symbols = GraphNative.Resolve();
                var lifecycle = new GraphLifecycle(null, (delegate* unmanaged[Cdecl]<int>)${symbol(ready)}, (delegate* unmanaged[Cdecl]<void>)${symbol(retire)});
                lifecycle.After();
                ${cb.parameters.map((node,i)=>`var arg${i} = GraphRuntime.Read${node.index}(p${i}, frame.Replies);`).join('\n                ')}
                ${cb.unit?'':'var result = '}callback(${cb.parameters.map((_,i)=>`arg${i}`).join(', ')});
                lifecycle.After();
                *output = GraphRuntime.Write${cb.result.index}(${cb.unit?'default(_V.Unit)':'result'}, frame.Replies);
                return 0;
            }
            catch (global::System.Exception error) { frame.Fail(error); return 6; }
        };
        frame.Keep(invoke);
        return new GraphCallback${cb.index} { Call = global::System.Runtime.InteropServices.Marshal.GetFunctionPointerForDelegate(invoke), Context = 0 };
    }`);
		methods.push(render("Invoke" + cb.index, cb.parameters.map(node => ({ node })), { node: cb.result }, cb.call, cb));
	}
	methods.push(...model.functions.map(fn => render("Call" + fn.index, fn.parameters, fn.result, fn.native)));
	const api = `using _V = global::${model.namespace};
namespace ${model.namespace};
${publicClosure}
public static class Api
{
${model.functions.map(fn=>`    public static ${resultType(fn.result)} ${fn.publicName}(${fn.parameters.map((p,i)=>`${publicType(p)} @${fn.parameterNames[i]}`).join(', ')}) => Interop.GraphCalls.Call${fn.index}(${fn.parameterNames.map(name=>'@'+name).join(', ')});`).join('\n')}
}
`;
	const loading = dotnetGraphAssets(model, evidence, symbols);
	return { ...model, files: {
		"Values.cs": model.valuesSource, "Runtime.cs": model.source, "Api.cs": api
		, "Calls.cs": `using _V = global::${model.namespace};\nusing ${model.namespace};\nnamespace ${model.namespace}.Interop;\n${loading}\n${state}\n${declarations.join('\n')}\ninternal static unsafe class GraphCalls\n{\n${methods.join('\n')}\n}\n`
	} };
};
