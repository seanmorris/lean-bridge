/**
 * Typed managed callbacks and owned Lean closures over the private C ABI.
 *
 * @file
 */

/**
 * Resolve either an admitted copied type or a primitive callable.
 *
 * @param model - Checked C# projection.
 * @param ref - Binding IR reference.
 */
export const dotnetValue = (model, ref) => model.surface.callbacks.get(ref.id) ?? model.surface.copy(ref);
const callable = value => Boolean(value.type?.callable);
const unit = value => value.scalarName === "unit";

/**
 * Spell a result without exposing its native lease.
 *
 * @param model - Checked C# projection.
 * @param value - Admitted value.
 */
export const dotnetResult = (model, value) => callable(value) ? `LeanClosure<${model.publicType(value)}>` : unit(value) ? "void" : model.publicType(value);

/** Public ownership wrapper; its Invoke delegate shares the same private lease. */
export const dotnetClosurePublic = `
/// <summary>An owned, synchronous Lean function. Invoke on its creating thread; dispose after use.</summary>
public sealed class LeanClosure<TDelegate> : global::System.IDisposable where TDelegate : global::System.Delegate
{
    private readonly Interop.ClosureLease lease;
    public TDelegate Invoke { get; }
    public bool IsClosed => lease.IsClosed;
    internal LeanClosure(TDelegate invoke, Interop.ClosureLease lease) { Invoke = invoke; this.lease = lease; }
    public void Dispose() => lease.Dispose();
}
`;

/** Keep reverse-P/Invoke delegates alive, contain exceptions, and defer active disposal. */
export const dotnetCallableState = `
internal static class ProcessGuard
{
    [DllImport("libc", EntryPoint = "getpid", CallingConvention = CallingConvention.Cdecl)]
    private static extern int GetPid();
    private static readonly int Process = GetPid();
    internal static bool IsCurrent => Process == GetPid();
    internal static void Ensure()
    {
        if (!IsCurrent) throw new InvalidOperationException("Start a fresh process after fork to use Lean");
    }
}

internal sealed class CallbackFrame : IDisposable
{
    internal Exception? Failure;
    private readonly global::System.Collections.Generic.List<global::System.Delegate> roots = new();
    internal void Keep(global::System.Delegate callback) => roots.Add(callback);
    internal static void Validate(global::System.Delegate callback)
    {
        ArgumentNullException.ThrowIfNull(callback);
        foreach (var entry in callback.GetInvocationList())
            if (entry.Method.IsDefined(typeof(global::System.Runtime.CompilerServices.AsyncStateMachineAttribute), false))
                throw new ArgumentException("Lean callbacks must return synchronously; async void is not supported");
    }
    internal void ThrowIfFailed()
    {
        if (Failure is not null) global::System.Runtime.ExceptionServices.ExceptionDispatchInfo.Throw(Failure);
    }
    public void Dispose() { global::System.GC.KeepAlive(roots); roots.Clear(); }
}

internal sealed class ClosureLease : IDisposable
{
    internal delegate void Release(ref nint pointer);
    private readonly Release release;
    private readonly object gate = new();
    private readonly global::System.Threading.Thread thread = global::System.Threading.Thread.CurrentThread;
    private nint pointer;
    private int active;
    private bool closed;
    internal ClosureLease(Release release) { ProcessGuard.Ensure(); this.release = release; }
    internal void Adopt(ref nint value) { pointer = value; value = 0; }
    internal bool IsClosed { get { ProcessGuard.Ensure(); lock (gate) return closed; } }
    internal ActiveCall Enter()
    {
        ProcessGuard.Ensure();
        lock (gate)
        {
            if (closed || pointer == 0) throw new global::System.ObjectDisposedException("LeanClosure");
            if (!ReferenceEquals(thread, global::System.Threading.Thread.CurrentThread))
                throw new InvalidOperationException("Lean closure must be invoked on its creating thread");
            ++active;
            return new ActiveCall(this, pointer);
        }
    }
    internal void Leave()
    {
        lock (gate) { --active; if (closed && active == 0) release(ref pointer); }
    }
    public void Dispose()
    {
        ProcessGuard.Ensure();
        lock (gate) { closed = true; if (active == 0) release(ref pointer); }
        global::System.GC.SuppressFinalize(this);
    }
    ~ClosureLease()
    {
        // The finalizer must never enter an inherited native mutex after fork.
        try { if (ProcessGuard.IsCurrent) Dispose(); } catch (Exception) { }
    }
}

internal readonly struct ActiveCall : IDisposable
{
    private readonly ClosureLease lease;
    internal readonly nint Pointer;
    internal ActiveCall(ClosureLease lease, nint pointer) { this.lease = lease; Pointer = pointer; }
    public void Dispose() => lease.Leave();
}
`;

/**
 * Generate one managed call, preserving cleanup and the original callback exception.
 *
 * @param model - Checked C# projection.
 * @param options - Generated call signature and native entry point.
 * @param options.name - Managed helper name.
 * @param options.native - P/Invoke entry point name.
 * @param options.parameters - Binding IR argument sites.
 * @param options.result - Binding IR output site.
 * @param options.closure - Invoke an existing owned lease.
 */
export const dotnetNativeCall = (model, { name, native, parameters, result, closure = false }) => {
	const inputs = parameters.map(site => dotnetValue(model, site.type)), output = dotnetValue(model, result.type);
	const hasCallbacks = inputs.some(callable), scope = hasCallbacks || inputs.some(value => value.aggregate);
	const args = [...closure ? ["active.Pointer"] : [], ...inputs.map((value, i) => `${value.aggregate || callable(value) ? "in " : ""}input${i}`), ...unit(output) ? [] : ["ref output"], "out var error"];
	return `    internal static ${dotnetResult(model, output)} ${name}(${[...closure ? ["ClosureLease lease"] : [], ...inputs.map((value, i) => `${model.publicType(value)} arg${i}`)].join(", ")})
    {
        ${model.surface.callbacks.size ? "ProcessGuard.Ensure();" : ""}
        ${closure ? "using var active = lease.Enter();" : ""}
        ${scope ? "using var scope = new Scope();" : ""}
        ${hasCallbacks ? "using var callbacks = new CallbackFrame();" : ""}
${inputs.map((value, i) => `        var input${i} = ${callable(value) ? `Borrow${value.index}(arg${i}, scope, callbacks)` : `To${value.index}(arg${i}${value.aggregate ? ", scope" : ""})`};`).join("\n")}
        ${unit(output) ? "" : `${callable(output) ? "nint" : model.nativeType(output)} output = default;`}
        try
        {
            var status = Native.${native}(${args.join(", ")});
            ${hasCallbacks ? "callbacks.ThrowIfFailed();" : ""}
            Check(status, error);
            ${unit(output) ? "" : `return ${callable(output) ? `Own${output.index}(ref output)` : `From${output.index}(output)`};`}
        }
        finally { ${callable(output) ? `Native.Dispose${output.index}(ref output);` : output.aggregate ? `Native.Clear${output.index}(ref output);` : ""} }
    }`;
};

/**
 * Render private callback layouts and reverse-P/Invoke signatures.
 *
 * @param model - Checked C# projection.
 */
export const dotnetCallableTypes = model => [...model.surface.callbacks.values()].map(callback => {
	const { parameters, result } = callback.type.callable, output = dotnetValue(model, result.type);
	const args = parameters.map((site, i) => { const value = dotnetValue(model, site.type); return `${value.aggregate ? "in " : ""}${model.nativeType(value)} arg${i}`; });
	return `[StructLayout(LayoutKind.Sequential)]
internal struct B${callback.index} { internal nint Call; internal nint Context; }
[UnmanagedFunctionPointer(CallingConvention.Cdecl)]
internal delegate int Callback${callback.index}(${["nint context", ...args, ...unit(output) ? [] : [`ref ${model.nativeType(output)} output`], "out NativeError error"].join(", ")});`;
}).join("\n");

/**
 * Render exception-contained trampolines, scoped results and ownership transfer.
 *
 * @param model - Checked C# projection.
 */
export const dotnetCallableSupport = model => [...model.surface.callbacks.values()].map(callback => {
	const { parameters, result } = callback.type.callable, output = dotnetValue(model, result.type);
	const inputs = parameters.map(site => dotnetValue(model, site.type)), i = callback.index;
	const args = ["nint context", ...inputs.map((value, n) => `${value.aggregate ? "in " : ""}${model.nativeType(value)} arg${n}`), ...unit(output) ? [] : [`ref ${model.nativeType(output)} output`], "out NativeError error"];
	return `    private static B${i} Borrow${i}(${model.publicType(callback)} callback, Scope scope, CallbackFrame frame)
    {
        CallbackFrame.Validate(callback);
        Callback${i} function = (${args.join(", ")}) =>
        {
            error = default;
            if (frame.Failure is not null) return 4;
            try
            {
                ${unit(output) ? "" : "var result = "}callback(${inputs.map((value, n) => `From${value.index}(arg${n})`).join(", ")});
                ${unit(output) ? "" : `output = To${output.index}(result${output.aggregate ? ", scope" : ""});`}
                return 0;
            }
            catch (Exception failure) { frame.Failure ??= failure; return 4; }
        };
        frame.Keep(function);
        return new B${i} { Call = Marshal.GetFunctionPointerForDelegate(function) };
    }
    private static LeanClosure<${model.publicType(callback)}> Own${i}(ref nint pointer)
    {
        if (pointer == 0) throw new InvalidOperationException("Missing returned Lean closure");
        var lease = new ClosureLease(Native.Dispose${i});
        var result = new LeanClosure<${model.publicType(callback)}>((${inputs.map((_, n) => `arg${n}`).join(", ")}) => Invoke${i}(lease, ${inputs.map((_, n) => `arg${n}`).join(", ")}), lease);
        lease.Adopt(ref pointer);
        return result;
    }
${dotnetNativeCall(model, { name: `Invoke${i}`, native: `Owned${i}`, parameters, result, closure: true })}`;
}).join("\n");

/**
 * Declare closure call and disposal entry points from the private C header.
 *
 * @param model - Checked C# projection.
 */
export const dotnetCallableImports = model => [...model.surface.callbacks.values()].map(callback => {
	const { parameters, result } = callback.type.callable, output = dotnetValue(model, result.type);
	const args = parameters.map((site, i) => { const value = dotnetValue(model, site.type); return `${value.aggregate ? "in " : ""}${model.nativeType(value)} arg${i}`; });
	return `    [DllImport(Library, EntryPoint = "${model.surface.prefix}_owned_${callback.field}_call", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Owned${callback.index}(${["nint self", ...args, ...unit(output) ? [] : [`ref ${model.nativeType(output)} output`], "out NativeError error"].join(", ")});
    [DllImport(Library, EntryPoint = "${model.surface.prefix}_owned_${callback.field}_dispose", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Dispose${callback.index}(ref nint self);`;
}).join("\n");
