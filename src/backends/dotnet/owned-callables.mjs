/**
 * Typed synchronous C# delegates, recovery values and native callback replies.
 *
 * @file
 */
import { ownedCallbackRecovery } from "../../build/owned-callback-carriers.mjs";

const support = `internal interface IOwnedRecovery
{
    global::System.Delegate Function { get; }
}
internal sealed class OwnedCallFrame : global::System.IDisposable
{
    internal readonly OwnedState State;
    internal readonly OwnedValueBudget Budget;
    private bool active = true;
    private global::System.Exception? failure;
    private readonly global::System.Collections.Generic.List<global::System.Delegate> roots = new();
    internal OwnedCallFrame(OwnedValueScope scope) { State = scope.State; Budget = scope.Budget; }
    internal bool Failed => global::System.Threading.Volatile.Read(ref failure) is not null;
    internal void Before(nint session)
    {
        if (!active) OwnedRuntime.Check(4);
        if (State.Require() != session) throw new OwnedInvalidNative("Callback session differs from initiating call");
    }
    internal static void Validate(global::System.Delegate callback)
    {
        global::System.ArgumentNullException.ThrowIfNull(callback);
        var pending = new global::System.Collections.Generic.Stack<(global::System.Delegate, int)>();
        pending.Push((callback, 0));
        int remaining = 262144;
        while (pending.TryPop(out var current))
        {
            if (current.Item2 > 32 || --remaining < 0) throw new OwnedLimit("Callback delegate nesting exceeds its limit");
            foreach (var entry in current.Item1.GetInvocationList())
            {
                if (--remaining < 0) throw new OwnedLimit("Callback invocation list exceeds its limit");
                if (entry.Method.IsDefined(typeof(global::System.Runtime.CompilerServices.AsyncStateMachineAttribute), false))
                    throw new global::System.ArgumentException("Lean callbacks must return synchronously");
                if (entry.Target is IOwnedRecovery wrapper) pending.Push((wrapper.Function, current.Item2 + 1));
            }
        }
    }
    internal void Keep(global::System.Delegate callback)
    { OwnedRuntime.Checkpoint(); roots.Add(callback); }
    internal void Fail(global::System.Exception error)
    { global::System.Threading.Interlocked.CompareExchange(ref failure, error, null); }
    internal void Finish(uint status)
    {
        var error = global::System.Threading.Volatile.Read(ref failure);
        if (error is not null) global::System.Runtime.ExceptionServices.ExceptionDispatchInfo.Throw(error);
        OwnedRuntime.Check(status);
    }
    public void Dispose() { active = false; global::System.GC.KeepAlive(roots); roots.Clear(); }
}
`;

/**
 * The C adapter owns callback output slots. Copy replies before managed buffers
 * and argument borrows expire, including failures after a result was published.
 *
 * @param model - Typed ownership values and checked C ABI.
 * @param symbols - Checked native symbol table in the enclosing bindings class.
 */
export const ownedDotnetCallables = (model, symbols) => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const types = new Map(model.nativeTypes.map(node => [node.id, node.publicType]));
	const raw = node => node.raw + (node.leaf ? "" : "*");
	const definitions = [support], methods = [], recovery = [];
	for(const callback of model.callbacks)
	{
		const node = nodes.get(callback.id), result = nodes.get(callback.result), i = node.index;
		const parameters = callback.parameters.slice(1).map(id => nodes.get(id));
		const automatic = ownedCallbackRecovery(model.c.native.model, node, id => id) !== null;
		const copy = [...model.c.retains, ...model.c.copies].find(fn => fn.id === result.id);
		const delegate = `_V.${callback.delegateType}`, publicResult = types.get(result.id);
		const unit = result.name === "unit", returnType = unit ? "void" : publicResult;
		const signature = ["nint context", "nint session", ...parameters.map((param, j) => `${raw(param)} arg${j}`), `${result.raw}* output`, "nint* owner"];
		const copyPointer = `delegate* unmanaged[Cdecl]<nint, ${raw(result)}, ${result.raw}*, nint*, uint>`;
		definitions.push(`[global::System.Runtime.InteropServices.UnmanagedFunctionPointer(global::System.Runtime.InteropServices.CallingConvention.Cdecl)]
internal unsafe delegate uint OwnedThunk${i}(${signature.join(", ")});
internal sealed class OwnedRecovery${i} : IOwnedRecovery
{
    internal readonly ${delegate} Callback;
    internal readonly ${publicResult} Recovery;
    global::System.Delegate IOwnedRecovery.Function => Callback;
    internal OwnedRecovery${i}(${delegate} callback, ${publicResult} recovery)
    { global::System.ArgumentNullException.ThrowIfNull(callback); Callback = callback; Recovery = recovery; }
    internal ${returnType} Invoke(${parameters.map((param, j) => `${types.get(param.id)} arg${j}`).join(", ")}) => Callback(${parameters.map((_, j) => `arg${j}`).join(", ")});
}`);
		recovery.push(`    public static ${callback.delegateType} WithRecovery(${callback.delegateType} callback, ${result.publicType} recovery)
        => new Interop.OwnedRecovery${i}(callback, recovery).Invoke;`);
		methods.push(`    private OwnedCallback${i} Host${i}(${delegate} value, OwnedValueScope scope, OwnedCallFrame? frame = null)
    {
        scope.Enter(null, 0, 32, true);
        OwnedCallFrame.Validate(value);
        bool wrapped = false;
        var recovery = default(${publicResult});
        var function = value;
        int nesting = 0;
        while (function.Target is OwnedRecovery${i} wrapper && function.Equals(new ${delegate}(wrapper.Invoke)))
        {
            if (++nesting > 32) throw new OwnedLimit("Callback recovery nesting exceeds its limit");
            if (!wrapped) { recovery = wrapper.Recovery; wrapped = true; }
            function = wrapper.Callback;
        }
        if (!wrapped && function.Target is _V.${node.publicType} closure && function.Equals(closure.AsCallback))
            return new OwnedCallback${i} { Closure = scope.Root(closure.Handle) };
${automatic ? "" : '        if (!wrapped) throw new global::System.ArgumentException("This callback requires OwnedCallbacks.WithRecovery(function, value)");\n'}        nint fallback = 0;
        if (wrapped) fallback = scope.Store(OwnedConvert.Write${result.index}(recovery!, scope));
        if (scope.CheckOnly) return default;
        if (frame is null) throw new global::System.InvalidOperationException("Callback construction requires an active call frame");
        scope.Storage(512); OwnedRuntime.Checkpoint();
        OwnedThunk${i} thunk = (${signature.join(", ")}) =>
        {
            if (frame.Failed) return 10;
            try
            {
                frame.Before(session); Ready();
                OwnedConvert.Checked<${result.raw}>((nint)output, 1, ${result.alignment});
                OwnedConvert.Checked<nint>((nint)owner, 1, 8);
                if (*owner != 0) throw new OwnedInvalidNative("Callback result slot is not empty");
                using var borrowed = new OwnedBorrowFrame(frame.State);
                using var incoming = new OwnedValueScope(frame.State, Factories, lease: () => borrowed.Lease, budget: frame.Budget);
${parameters.map((param, j) => `                var value${j} = OwnedConvert.Read${param.index}(${param.leaf ? "&" : ""}arg${j}, incoming);`).join("\n")}
                ${unit ? "" : "var reply = "}function(${parameters.map((_, j) => `value${j}`).join(", ")});
                Ready();
                using var replies = new OwnedValueScope(frame.State, Factories, budget: frame.Budget);
                var converted = OwnedConvert.Write${result.index}(${unit ? "default(_V.Unit)" : "reply"}, replies);
                // This slot belongs to C, even if a later managed checkpoint fails.
                OwnedRuntime.Check(((${copyPointer})symbols[${symbols.indexOf(copy.cName)}])(frame.State.Require(), ${result.leaf ? "" : "&"}converted, output, owner));
                OwnedRuntime.Checkpoint(); return 0;
            }
            catch (global::System.Exception error) { frame.Fail(error); return 10; }
        };
        frame.Keep(thunk); OwnedRuntime.Checkpoint();
        return new OwnedCallback${i} { Call = global::System.Runtime.InteropServices.Marshal.GetFunctionPointerForDelegate(thunk), Recovery = fallback };
    }`);
	}
	return { definitions: definitions.join("\n"), methods: methods.join("\n")
		, publicSource: `public static class OwnedCallbacks\n{\n${recovery.join("\n")}\n}\n` };
};
