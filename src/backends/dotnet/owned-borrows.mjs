/**
 * Whole C# values retain original owner slots, including empty result shapes.
 *
 * @file
 */

export const ownedDotnetWholeValues = `/// <summary>A complete Lean value and its checked original lifetime. Get returns borrowed resource views.</summary>
public sealed class Value<T> : global::System.IDisposable, global::System.IEquatable<Value<T>>
{
    internal readonly Interop.OwnedWholeGuard<T> Guard;
    private readonly global::System.Func<T, Value<T>> retain;
    internal Value(Interop.OwnedLease lease, T value, global::System.Func<T, Value<T>> retain)
    { this.retain = retain; Guard = new(lease, value); }
    public T Get()
    {
        try { return Guard.Get(); }
        finally { global::System.GC.KeepAlive(this); }
    }
    public bool IsClosed => Guard.IsClosed;
    public void Dispose() => Guard.Dispose();
    public Value<T> Share()
    {
        try { return new(Guard.Lease, Get(), retain); }
        finally { global::System.GC.KeepAlive(this); }
    }
    public Value<T> Retain()
    {
        try { return retain(Get()); }
        finally { global::System.GC.KeepAlive(this); }
    }
    public bool Equals(Value<T>? other)
    {
        try
        {
            var value = Get();
            return other is not null && GraphValues.Equal(value, other.Get());
        }
        finally { global::System.GC.KeepAlive(this); global::System.GC.KeepAlive(other); }
    }
    public override bool Equals(object? other)
    {
        try
        {
            Get();
            return other is Value<T> value && Equals(value);
        }
        finally { global::System.GC.KeepAlive(this); global::System.GC.KeepAlive(other); }
    }
    public override int GetHashCode() => throw new global::System.NotSupportedException("Lean owners cannot be dictionary keys");
}
`;

export const ownedDotnetWholeGuard = `
internal sealed class OwnedWholeGuard<T> : global::System.IDisposable
{
    internal readonly OwnedLease Lease;
    private sealed class Payload
    {
        internal readonly T Value;
        internal Payload(T value) { Value = value; }
    }
    private Payload? payload;
    private bool acquired;
    private int closed;
    internal OwnedWholeGuard(OwnedLease lease, T value)
    {
        Lease = lease;
        OwnedRuntime.Checkpoint(); payload = new(value);
        OwnedRuntime.Checkpoint(); lease.Acquire(); acquired = true;
    }
    internal bool IsClosed => global::System.Threading.Volatile.Read(ref closed) != 0 || Lease.IsClosed;
    internal T Get()
    {
        var snapshot = global::System.Threading.Volatile.Read(ref payload);
        Lease.Require();
        if (global::System.Threading.Volatile.Read(ref closed) != 0) OwnedRuntime.Check(4);
        return snapshot!.Value;
    }
    internal OwnedLease Require(OwnedState state)
    {
        Get();
        if (!global::System.Object.ReferenceEquals(Lease.State, state)) OwnedRuntime.Check(1);
        return Lease;
    }
    private void Close(bool finalizing)
    {
        if (global::System.Threading.Interlocked.Exchange(ref closed, 1) != 0) return;
        global::System.Threading.Volatile.Write(ref payload, null);
        if (acquired) Lease.Release(finalizing);
    }
    public void Dispose()
    {
        Lease.State.Runtime.EnsureProcess(); Close(false);
        global::System.GC.SuppressFinalize(this);
    }
    ~OwnedWholeGuard() { try { Close(true); } catch { } }
}
`;

export const ownedDotnetOriginalTransfers = `
internal sealed class OwnedInputTransfers : global::System.IDisposable
{
    private readonly OwnedState state;
    private readonly OwnedLease?[] leases;
    private bool armed, finished;
    internal OwnedInputTransfers(OwnedState state, int count, OwnedValueScope scope)
    {
        this.state = state;
        scope.Storage((nuint)count, 256); OwnedRuntime.Checkpoint();
        leases = new OwnedLease?[count];
    }
    private void Ready(OwnedLease lease)
    {
        lease.Require();
        if (!global::System.Object.ReferenceEquals(lease.State, state)
            || lease.Scope is not null || lease.BorrowedResult || lease.Slot is null) OwnedRuntime.Check(1);
        if (lease.InputMove is not null) OwnedRuntime.Check(8);
    }
    internal void Add(OwnedLease lease, int group)
    {
        Ready(lease);
        if (leases[group] is not null) OwnedRuntime.Check(1);
        foreach (var previous in leases)
            if (global::System.Object.ReferenceEquals(previous, lease)) OwnedRuntime.Check(1);
        leases[group] = lease;
    }
    internal ref nint Slot(int group) => ref leases[group]!.Slot!.Value;
    internal void Arm()
    {
        state.Require();
        foreach (var lease in leases) Ready(lease!);
        armed = true;
        foreach (var lease in leases) lease!.InputMove = lease.Slot;
    }
    internal void Finish()
    {
        if (!armed || finished) return;
        foreach (var lease in leases)
        {
            if (lease!.Slot!.Value == 0) global::System.Threading.Volatile.Write(ref lease.Slot.Pending, 1);
            lease.InputMove = null;
        }
        finished = true; state.Drain();
    }
    public void Dispose() { try { Finish(); } finally { global::System.Array.Clear(leases); } }
}
`;

/**
 * Keep original whole owners rooted while serializing call arguments.
 *
 * @param transfers - Include the original-slot consuming input transport.
 */
export const ownedDotnetWholeScope = transfers => `
    private readonly global::System.Collections.Generic.List<OwnedLease> leases = new();
    internal void Pin(OwnedLease lease)
    {
        lease.Require();
        if (!global::System.Object.ReferenceEquals(lease.State, State)) OwnedRuntime.Check(1);
        Storage(64); OwnedRuntime.Checkpoint(); leases.Add(lease);
        try { lease.Acquire(); }
        catch { leases.RemoveAt(leases.Count - 1); throw; }
    }
    internal T Whole<T>(Value<T> value)
    {
        global::System.ArgumentNullException.ThrowIfNull(value);
        var owner = value.Guard.Require(State);
        Pin(owner); return value.Get();
    }
    private void Unpin()
    {
        try
        {
            global::System.Exception? failure = null;
            for (int index = leases.Count - 1; index >= 0; --index)
                try { leases[index].Release(false); } catch (global::System.Exception error) { failure ??= error; }
            if (failure is not null) global::System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(failure).Throw();
        }
        finally { leases.Clear();${transfers ? " Moves = null;" : ""} }
    }
`;

/**
 * Emit a checked call with an explicit owner for every resource-bearing output.
 *
 * @param context - Typed value layout, symbols, names and call catalog.
 * @param fn - One public function, copy, retain or closure invocation.
 */
export const ownedDotnetAnchoredCall = (context, fn) => {
	const { c, nodes, calls, symbols, parameterType, returnType } = context;
	const result = nodes.get(fn.result), parameters = fn.parameters.map(id => nodes.get(id));
	const moving = fn.transfers ?? [], wraps = index => moving.includes(index) || fn.anchor === index;
	const whole = result.representation !== "copied" && !fn.rawResult;
	const copy = calls.find(item => item.wholeCopy && item.id === result.id);
	if(whole && !copy) throw new TypeError(`Missing C# whole-value copy for ${result.id}`);
	const write = (node, index, scope, checking) => fn.handle && index === 0 ? `${scope}.Root(arg${index})`
		: c.hostArgument?.(fn, index) ? `Host${node.index}(arg${index}, ${scope}${checking ? "" : ", frame"})`
			: `OwnedConvert.Write${node.index}(${wraps(index) ? `${scope}.Whole(arg${index})` : `arg${index}`}, ${scope})`;
	const nativeTypes = parameters.flatMap((node, index) => [
		c.hostArgument?.(fn, index) ? `OwnedCallback${node.index}*` : node.raw + (node.leaf ? "" : "*")
		, ...moving.includes(index) ? ["nint*"] : []
		, ...fn.anchor === index ? ["nint"] : []
	]);
	const pointer = `delegate* unmanaged[Cdecl]<${["nint", ...nativeTypes, `${result.raw}*`, "nint*", "uint"].join(", ")}>`;
	const nativeArguments = parameters.flatMap((node, index) => [
		`${c.hostArgument?.(fn, index) || !node.leaf ? "&" : ""}input${index}`
		, ...moving.includes(index) ? [`inputOwner${index}`] : []
		, ...fn.anchor === index ? ["anchor"] : []
	]);
	const arguments_ = ["session", ...nativeArguments, "&output", "resultOwner"].join(", ");
	const invoke = moving.length ? `            moves.Arm();
            uint status;
            try
            {
                fixed (nint* resultOwner = &owner.Value)
${moving.map((index, group) => `                fixed (nint* inputOwner${index} = &moves.Slot(${group}))`).join("\n")}
                    status = invoke(${arguments_});
            }
            finally { moves.Finish(); }
            frame.Finish(status);` : `            fixed (nint* resultOwner = &owner.Value)
                frame.Finish(invoke(${arguments_}));`;
	return `    internal ${returnType(fn)} ${fn.method}(${parameters.map((_, index) => `${parameterType(fn, index)} arg${index}`).join(", ")})
    {
        var state = Runtime.Current; state.Require(); Ready();
        using (var check = new OwnedValueScope(state, Factories, checkOnly: true))
        {
${parameters.map((node, index) => `            ${write(node, index, "check", true)};`).join("\n")}
        }
        using var inputs = new OwnedValueScope(state, Factories);
        using var frame = new OwnedCallFrame(inputs);
${parameters.map((node, index) => `        var input${index} = ${write(node, index, "inputs", false)};`).join("\n")}
${moving.length ? `        using var moves = new OwnedInputTransfers(state, ${moving.length}, inputs);
${moving.map((index, group) => `        moves.Add(arg${index}.Guard.Require(state), ${group});`).join("\n")}\n` : ""}\
        using var owner = new OwnedResult(state);
        using var outputs = new OwnedValueScope(state, Factories, lease: () => owner.Adopt(${fn.anchor === undefined ? "false" : "true"}, ${whole ? "true" : "false"}));
        var output = default(${result.raw});
        try
        {
            var invoke = (${pointer})symbols[${symbols.indexOf(fn.cName)}];
            var session = state.Require();
${fn.anchor === undefined ? "" : `            var anchor = arg${fn.anchor}.Guard.Require(state).Owner(state);\n`}\
${invoke}
            Ready();
            var result = OwnedConvert.Read${result.index}(&output, outputs);
${whole ? `            OwnedRuntime.Checkpoint();
            var value = new ${returnType(fn)}(owner.Adopt(${fn.anchor === undefined ? "false" : "true"}, true), result, ${copy.method});
            try { OwnedRuntime.Checkpoint(); Ready(); owner.Complete(); return value; }
            catch { value.Dispose(); throw; }` : "            OwnedRuntime.Checkpoint(); Ready(); owner.Complete(); return result;"}
        }
        catch (OwnedInvalidNative error)
        {
            Runtime.EnsureProcess(); retire();
            throw new _V.LeanBridgeException(9, error.Message, error);
        }
    }`;
};
