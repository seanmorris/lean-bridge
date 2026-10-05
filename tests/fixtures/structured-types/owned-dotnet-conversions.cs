using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using LeanBridge.OwnedAggregates;
using LeanBridge.OwnedAggregates.Interop;

internal static unsafe partial class Program
{
    private static int checks, managedFailures, nativeFailures;
    private static int remaining = -1;
    private static delegate* unmanaged[Cdecl]<nuint> Live, Identities;
    private static delegate* unmanaged[Cdecl]<nint, void> Fail;

    internal static void Allocation()
    {
        if (remaining == 0) throw new OutOfMemoryException("injected managed failure");
        if (remaining > 0) --remaining;
    }
    private static void Check(bool value, string message)
    { if (!value) throw new Exception(message); ++checks; }
    private static void Reject<T>(Action action) where T : Exception
    {
        try { action(); }
        catch (T) { ++checks; return; }
        throw new Exception("Expected " + typeof(T).Name);
    }
    private static void Drop(object? root)
    {
        var pending = new Stack<object?>(); pending.Push(root);
        var seen = new HashSet<object>(ReferenceEqualityComparer.Instance);
        while (pending.TryPop(out var value))
        {
            if (value is null || !seen.Add(value)) continue;
            if (value is IOwnedValue owned) ((IDisposable)owned).Dispose();
            else if (value is IGraphValue graph)
                for (int i = 0; i < graph.GraphCount; i++) pending.Push(graph.GraphField(i));
            else if (value is Array array && value is not byte[])
                foreach (var element in array) pending.Push(element);
            else if (value is ITuple tuple)
                for (int i = 0; i < tuple.Length; i++) pending.Push(tuple[i]);
        }
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static bool Attempt(Func<object> action, int index, bool native)
    {
        try
        {
            if (native) Fail(index); else remaining = index;
            var result = action();
            remaining = -1; Fail(-1); Drop(result);
            return true;
        }
        catch (OutOfMemoryException) when (!native) { ++managedFailures; return false; }
        catch (LeanBridgeException error) when (native && error.Status == 3) { ++nativeFailures; return false; }
        finally { remaining = -1; Fail(-1); }
    }
    private static void Collect()
    { GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect(); Runtime.Current.Require(); }
    private static void Failures(Func<object> action)
    {
        Collect(); var baseline = Live(); var identities = Identities();
        foreach (bool native in new[] { false, true })
        {
            bool finished = false;
            for (int index = 0; index < 2000; index++)
            {
                finished = Attempt(action, index, native); Collect();
                Check(Live() == baseline, $"allocation rollback {native}/{index}: {Live()} != {baseline}");
                Check(Identities() == identities, $"identity rollback {native}/{index}");
                if (finished) break;
            }
            Check(finished, "fault injection reached successful call");
        }
    }
    private static void Main(string[] args)
    {
        Library = NativeLibrary.Load(args[0]); Runtime = new OwnedRuntime(Library);
        Live = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(Library, "probe_live");
        Identities = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(Library, "probe_identities");
        Fail = (delegate* unmanaged[Cdecl]<nint, void>)NativeLibrary.GetExport(Library, "probe_fail");
        Exercise(); Malformed(); Collect(); Runtime.Current.Dispose();
        Check(Live() == 0 && Identities() == 0, "all owners released");
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new {
            checks, managedFailures, nativeFailures, live = (ulong)Live(), identities = (ulong)Identities()
        }));
    }
}
