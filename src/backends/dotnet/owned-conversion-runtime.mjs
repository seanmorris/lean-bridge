/**
 * Bounded temporary storage and rooted identities for C# ownership conversion.
 *
 * @file
 */
import { componentRecursiveLimits } from "../../abi/component-recursive.mjs";

/** No finalizer calls native code. The enclosing synchronous call owns storage. */
export const ownedDotnetConversionRuntime = `internal sealed class OwnedInvalidNative : global::System.Exception
{
    internal OwnedInvalidNative(string message) : base(message) { }
}
internal sealed class OwnedLimit : global::System.ArgumentException
{
    internal OwnedLimit(string message) : base(message) { }
}

internal sealed class OwnedValueBudget
{
    internal int Nodes = ${componentRecursiveLimits.valueNodes};
    internal nuint Native = 16 * 1024 * 1024;
    internal nuint Managed = 16 * 1024 * 1024;
}

internal sealed unsafe class OwnedValueScope : global::System.IDisposable
{
    internal readonly OwnedState State;
    internal readonly OwnedFactories Factories;
    internal readonly bool CheckOnly;
    private readonly global::System.Func<OwnedLease>? lease;
    internal readonly OwnedValueBudget Budget;
    internal int Nodes => Budget.Nodes;
    private readonly global::System.Collections.Generic.HashSet<object> hosts = new(global::System.Collections.Generic.ReferenceEqualityComparer.Instance);
    private readonly global::System.Collections.Generic.HashSet<(int, nuint)> outputs = new();
    private readonly global::System.Collections.Generic.List<nint> allocations = new();
    private readonly global::System.Collections.Generic.List<OwnedHandle> roots = new();
    internal OwnedValueScope(OwnedState state, OwnedFactories factories, bool checkOnly = false, global::System.Func<OwnedLease>? lease = null, OwnedValueBudget? budget = null)
    { state.Require(); State = state; Factories = factories; CheckOnly = checkOnly; this.lease = lease; Budget = budget ?? new(); }
    internal OwnedLease Lease()
    {
        State.Require();
        if (lease is null) throw new global::System.InvalidOperationException("Native identities require an owning result or borrowed callback frame");
        return lease();
    }
    private static void Charge(ref nuint remaining, nuint count, nuint width)
    {
        if (width == 0 || count > remaining / width) throw new OwnedLimit("16 MiB ownership conversion budget exceeded");
        remaining -= count * width;
    }
    internal void Native(nuint count, nuint width = 1) => Charge(ref Budget.Native, count, width);
    internal void Storage(nuint count, nuint width = 1) => Charge(ref Budget.Managed, count, width);
    private void Visit(int depth, int size, bool storage)
    {
        if (depth > ${componentRecursiveLimits.valueDepth} || Nodes == 0) throw new OwnedLimit("Ownership value depth or node limit exceeded");
        --Budget.Nodes;
        if (storage) Native((nuint)size);
    }
    internal void Enter(object? identity, int depth, int size, bool storage)
    {
        Visit(depth, size, storage);
        if (identity is not null && !hosts.Add(identity)) throw new global::System.ArgumentException("Cyclic ownership input");
    }
    internal void Leave(object? identity) { if (identity is not null) hosts.Remove(identity); }
    internal void Enter(int type, nuint pointer, int depth, int size, bool storage)
    {
        Visit(depth, size, storage);
        if (!outputs.Add((type, pointer))) throw new OwnedInvalidNative("Cyclic native ownership value");
    }
    internal void Leave(int type, nuint pointer) => outputs.Remove((type, pointer));
    internal nint Root(OwnedHandle handle)
    {
        var value = handle.Raw(State);
        Storage((nuint)sizeof(nint)); OwnedRuntime.Checkpoint(); roots.Add(handle);
        return value;
    }
    internal nint Allocate<T>(nuint count) where T : unmanaged
    {
        Storage(count, (nuint)sizeof(T)); Storage(32);
        if (CheckOnly || count == 0) return 0;
        OwnedRuntime.Checkpoint();
        var pointer = (nint)global::System.Runtime.InteropServices.NativeMemory.AllocZeroed(count, (nuint)sizeof(T));
        if (pointer == 0) throw new global::System.OutOfMemoryException();
        try { OwnedRuntime.Checkpoint(); allocations.Add(pointer); }
        catch { global::System.Runtime.InteropServices.NativeMemory.Free((void*)pointer); throw; }
        return pointer;
    }
    internal nint Store<T>(T value) where T : unmanaged
    {
        var pointer = Allocate<T>(1);
        if (!CheckOnly) *(T*)pointer = value;
        return pointer;
    }
    public void Dispose()
    {
        foreach (var pointer in allocations) global::System.Runtime.InteropServices.NativeMemory.Free((void*)pointer);
        allocations.Clear(); roots.Clear(); hosts.Clear(); outputs.Clear();
    }
}

internal static unsafe partial class OwnedConvert
{
    private static readonly global::System.Text.UTF8Encoding Utf8 = new(false, true);
    internal static void Checkpoint() => OwnedRuntime.Checkpoint();
    internal static T* Checked<T>(nint pointer, nuint count, nuint alignment) where T : unmanaged
    {
        if (count == 0) return null;
        if (pointer == 0 || (nuint)pointer % alignment != 0 || count > (nuint)nint.MaxValue / (nuint)sizeof(T)
            || (nuint)pointer > nuint.MaxValue - count * (nuint)sizeof(T))
            throw new OwnedInvalidNative("Missing, misaligned or overflowing native span");
        // Pointer contents come from the authenticated adapter. No arithmetic
        // check can make an arbitrary foreign address safe to dereference.
        return (T*)pointer;
    }
}
`;
