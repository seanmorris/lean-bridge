using System;
using System.Runtime.InteropServices;

internal static unsafe class GraphFaults
{
    internal static int Hits, Fail, Live, Attempts, Allocations, Frees, FailAllocation;
    internal static bool Interrupted;
    internal static Action? During;
    internal static void Reset(int fail = 0, int failAllocation = 0, bool interrupted = false)
    {
        if (Live != 0) throw new Exception("Unreleased scratch");
        Hits = Attempts = Allocations = Frees = 0;
        Fail = fail; FailAllocation = failAllocation; Interrupted = interrupted; During = null;
    }
    internal static void Hit()
    {
        Hits++; During?.Invoke();
        if (Hits != Fail) return;
        if (Interrupted) throw new OperationCanceledException("Injected conversion interruption");
        throw new OutOfMemoryException("Injected conversion failure");
    }
    internal static void* Allocate(nuint count, nuint size)
    {
        if (++Attempts == FailAllocation) return null;
        var result = NativeMemory.AllocZeroed(count, size);
        if (result != null) { Live++; Allocations++; }
        return result;
    }
    internal static void Free(void* pointer)
    {
        if (pointer == null || Live <= 0) throw new Exception("Double free");
        Live--; Frees++; NativeMemory.Free(pointer);
    }
}
