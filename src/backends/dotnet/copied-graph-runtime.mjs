/**
 * Scoped native storage, graph budgets and retirement for C# copied adapters.
 *
 * @file
 */
import { componentRecursiveLimits } from "../../abi/component-recursive.mjs";

/** Private support. All managed names are qualified to avoid public-name capture. */
export const dotnetGraphRuntime = `internal sealed class GraphInvalidNative : global::System.Exception
{
    internal GraphInvalidNative(string message) : base(message) { }
}
internal sealed class GraphLimit : global::System.ArgumentException
{
    internal GraphLimit(string message) : base(message) { }
}

internal readonly unsafe struct GraphLifecycle
{
    internal readonly delegate* unmanaged[Cdecl]<uint> Initialize;
    internal readonly delegate* unmanaged[Cdecl]<int> Ready;
    internal readonly delegate* unmanaged[Cdecl]<void> Retire;
    internal GraphLifecycle(delegate* unmanaged[Cdecl]<uint> initialize, delegate* unmanaged[Cdecl]<int> ready, delegate* unmanaged[Cdecl]<void> retire)
    { Initialize = initialize; Ready = ready; Retire = retire; }
    internal void Before() { if (Initialize != null) GraphRuntime.Status(Initialize()); }
    internal void After()
    {
        if (Ready != null && Ready() == 0) throw new LeanBridgeException(5, "Lean runtime is unavailable");
    }
    internal void Poison() { if (Retire != null) Retire(); }
}

internal sealed unsafe class GraphScope : global::System.IDisposable
{
    internal readonly bool CheckOnly;
    internal int Nodes = ${componentRecursiveLimits.valueNodes};
    private nuint nativeRemaining = 16 * 1024 * 1024;
    private nuint storageRemaining = 16 * 1024 * 1024;
    private readonly global::System.Collections.Generic.HashSet<object> hosts = new(global::System.Collections.Generic.ReferenceEqualityComparer.Instance);
    private readonly global::System.Collections.Generic.HashSet<(int, nuint)> outputs = new();
    private readonly global::System.Collections.Generic.List<nint> allocations = new();
    internal GraphScope(bool checkOnly = false)
    {
        if (sizeof(nint) != 8 || !global::System.BitConverter.IsLittleEndian)
            throw new global::System.PlatformNotSupportedException("Native graphs require little-endian 64-bit storage");
        CheckOnly = checkOnly;
    }
    private static void Charge(ref nuint remaining, nuint count, nuint width)
    {
        if (width == 0 || count > remaining / width) throw new GraphLimit("16 MiB copied graph conversion budget exceeded");
        remaining -= count * width;
    }
    internal void Native(nuint count, nuint width = 1) => Charge(ref nativeRemaining, count, width);
    internal void Storage(nuint count, nuint width = 1) => Charge(ref storageRemaining, count, width);
    private void Visit(int depth, int size, bool storage)
    {
        if (depth > ${componentRecursiveLimits.valueDepth} || Nodes == 0) throw new GraphLimit("Copied graph depth or node limit exceeded");
        Nodes--;
        if (storage) Native((nuint)size);
    }
    internal void Enter(object? identity, int depth, int size, bool storage)
    {
        Visit(depth, size, storage);
        if (identity != null && !hosts.Add(identity)) throw new global::System.ArgumentException("Cyclic copied input");
    }
    internal void Leave(object? identity) { if (identity != null) hosts.Remove(identity); }
    internal void Enter(int type, nuint pointer, int depth, int size, bool storage)
    {
        Visit(depth, size, storage);
        if (!outputs.Add((type, pointer))) throw new GraphInvalidNative("Cyclic native copied value");
    }
    internal void Leave(int type, nuint pointer) => outputs.Remove((type, pointer));
    internal nint Allocate<T>(nuint count) where T : unmanaged
    {
        Storage(count, (nuint)sizeof(T)); Storage(32);
        if (CheckOnly || count == 0) return 0;
        GraphRuntime.Checkpoint();
        var pointer = (nint)global::System.Runtime.InteropServices.NativeMemory.AllocZeroed(count, (nuint)sizeof(T));
        if (pointer == 0) throw new global::System.OutOfMemoryException();
        try { GraphRuntime.Checkpoint(); allocations.Add(pointer); }
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
        allocations.Clear(); hosts.Clear(); outputs.Clear();
    }
}

internal static unsafe partial class GraphRuntime
{
    private static readonly global::System.Text.UTF8Encoding Utf8 = new(false, true);
    internal static void Checkpoint() { }
    internal static void Status(uint status)
    {
        switch (status)
        {
            case 0: return;
            case 1: throw new global::System.ArgumentException("Invalid native copied input");
            case 2: throw new GraphLimit("Native copied graph limit exceeded");
            case 3: throw new global::System.OutOfMemoryException("Native copied graph allocation failed");
            case 5: throw new LeanBridgeException(5, "Lean runtime is unavailable");
            default: throw new GraphInvalidNative("Invalid native copied result or status");
        }
    }
    internal static T* Checked<T>(nint pointer, nuint count, nuint alignment) where T : unmanaged
    {
        if (count == 0) return null;
        if (pointer == 0 || (nuint)pointer % alignment != 0 || count > (nuint)nint.MaxValue / (nuint)sizeof(T)
            || (nuint)pointer > nuint.MaxValue - count * (nuint)sizeof(T))
            throw new GraphInvalidNative("Missing, misaligned or overflowing native span");
        // The authenticated native adapter supplies readable process memory.
        // These checks cannot make arbitrary foreign pointers safe to read.
        return (T*)pointer;
    }
    internal static void Clear(ref nint owner, ref nint release)
    {
        var savedOwner = owner; var savedRelease = release;
        owner = 0; release = 0;
        if (savedOwner != 0 && savedRelease != 0)
            ((delegate* unmanaged[Cdecl]<nint, void>)savedRelease)(savedOwner);
    }
}
`;

/** Compiled calls use the same public failure type as other NuGet projections. */
export const dotnetGraphException = `/// <summary>A failure reported by a compiled Lean call.</summary>
public sealed class LeanBridgeException : global::System.Exception
{
    public int Status { get; }
    internal LeanBridgeException(int status, string message, global::System.Exception? inner = null) : base(message, inner) => Status = status;
}
`;
