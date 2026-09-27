using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Threading;
using A = LeanBridge.OwnedAggregates;
using B = LeanBridge.OwnedPeer;
using C = LeanBridge.CopiedPeer;
using D = LeanBridge.PlainPeer;

// Native interop here only observes the original installed broker and probes
// fork/retirement. Normal calls use each assembly's public API.
internal static unsafe class Program
{
    private static int checks, rejectedCalls, threadedCalls;
    private static void Trace(string text)
    { if (Environment.GetEnvironmentVariable("LEAN_BRIDGE_DOTNET_DEBUG") == "1") Console.Error.WriteLine(text); }
    [StructLayout(LayoutKind.Sequential)]
    private struct Snapshot
    {
        internal uint Abi, State, RuntimeInitializations, Components, Attached, Identities;
        internal ulong Instance, Domain;
    }
    private static Dictionary<string, object> Registry =>
        (Dictionary<string, object>)AppDomain.CurrentDomain.GetData("lean-bridge.native-library-v1.dotnet")!;
    private static void Check(bool value, string message)
    { if (!value) throw new Exception(message); Interlocked.Increment(ref checks); }
    private static Snapshot Read()
    {
        var read = (delegate* unmanaged[Cdecl]<Snapshot*, void>)NativeLibrary.GetExport((nint)Registry["broker"], "lean_bridge_native_snapshot_read");
        var result = default(Snapshot); read(&result); return result;
    }
    private static void Unavailable(Action call)
    {
        try { call(); }
        catch (A.LeanBridgeException error) when (error.Status == 7) { ++rejectedCalls; return; }
        catch (B.LeanBridgeException error) when (error.Status == 7) { ++rejectedCalls; return; }
        catch (C.LeanBridgeException error) when (error.Status == 5) { ++rejectedCalls; return; }
        catch (D.LeanBridgeException error) when (error.Status == 5) { ++rejectedCalls; return; }
        throw new Exception("Retired package remained callable");
    }
    private static void Close(A.Bundle value)
    {
        value.Primary.Dispose(); if (value.Spare.IsSome) value.Spare.Value.Dispose();
        foreach (var item in value.Peers) item.Dispose();
        foreach (var item in value.History) item.Dispose();
    }
    [UnmanagedCallersOnly(CallConvs = new[] { typeof(CallConvCdecl) })]
    private static int Child(int kind)
    {
        try
        {
            if (kind < 0) throw new InvalidOperationException("fresh process");
            if (kind == 0) { using var ticket = A.Api.NewTicket(1, "fork"); }
            else if (kind == 1) _ = C.Api.Answer();
            else _ = D.Api.Answer();
            return 1;
        }
        catch (InvalidOperationException error)
        { return error.Message.Contains("fresh process") ? 0 : 2; }
        catch { return 3; }
    }
    private static void Calls(string order, string retiredBy, int forkKind)
    {
        var huge = (BigInteger.One << 200) + 31;
        Trace("first package: " + order);
        if (order == "copied-first") Check(C.Api.Answer() == huge, "copied first");
        if (order == "plain-first") Check(D.Api.Answer() == 42, "plain first");
        using var first = A.Api.NewTicket(huge, "primary");
        using var second = B.Api.NewTicket(huge + 1, "peer");
        Trace("owned peers loaded");
        Check(A.Api.Serial(first) == huge && B.Api.Serial(second) == huge + 1, "owned peers");
        Check(C.Api.Answer() == huge && D.Api.Answer() == 42, "all packages initialized");
        var tree = new C.TreeBranch(new C.Tree[] { new C.TreeTip(huge), new C.TreeBranch(Array.Empty<C.Tree>()) });
        Check(C.Api.Echo(tree) == tree && C.Api.Apply(tree, value => value) == tree, "copied recursive callback");
        Check(D.Api.Apply(40, value => value + 2) == 42, "ordinary callback");
        Trace("copied and ordinary callbacks passed");
        var input = new A.Bundle(first, default, Array.Empty<A.Ticket>(), Array.Empty<A.Ticket>(), new A.Payload(-huge, new byte[] { 0, 255 }));
        var returned = A.Api.CallbackRecord(input, value => {
            Check(C.Api.Apply(tree, node => node) == tree, "copied call during owned callback");
            Check(D.Api.Apply(40, number => number + 2) == 42, "ordinary call during owned callback");
            Check(B.Api.Serial(second) == huge + 1, "owned peer during callback");
            return value;
        });
        Check(A.Api.Serial(returned.Primary) == huge, "composed resource output"); Close(returned);
        Trace("cross-package callback passed");
        var threads = new List<Thread>(); var failures = new List<Exception>();
        for (int n = 0; n < 4; n++)
        {
            int index = n;
            var thread = new Thread(() => {
                try
                {
                    for (int i = 0; i < 16; i++)
                    {
                        using var ticket = A.Api.NewTicket(index, "thread");
                        Check(A.Api.Serial(ticket) == index, "thread-owned resource");
                        Check(C.Api.Apply(tree, value => value) == tree, "thread-copied callback");
                        Check(D.Api.Apply(40, value => value + 2) == 42, "thread-ordinary callback");
                        Interlocked.Increment(ref threadedCalls);
                    }
                }
                catch (Exception error) { lock (failures) failures.Add(error); }
            });
            threads.Add(thread); thread.Start();
        }
        foreach (var thread in threads) thread.Join();
        Trace("parallel calls finished");
        Check(failures.Count == 0, "concurrent package calls: " + string.Join("; ", failures));
        Check(Read().Components == 4 && Read().RuntimeInitializations == 1, "one runtime, four components");
        var libraries = (Dictionary<string, Tuple<string, nint>>)Registry["libraries"];
        Check(libraries.Count == 11 && Equals(Registry["policy"], "linux-x64-deepbind-v1"), "shared authenticated policy");
        Check(Registry.Keys.Count(name => name.StartsWith("component:", StringComparison.Ordinal)) == 4, "four loader registrations");

        // Prepare reverse P/Invoke and call sites in the parent before fork.
        Check(((delegate* unmanaged[Cdecl]<int, int>)&Child)(-1) == 0, "parent exception path prepared");
        for (int kind = 0; kind < 3; kind++) Check(((delegate* unmanaged[Cdecl]<int, int>)&Child)(kind) == 1, "parent fork probe prepared");
        Trace("parent fork probes prepared");
        var probe = NativeLibrary.Load(System.IO.Path.Combine(AppContext.BaseDirectory, "fork-probe.so"));
        var fork = (delegate* unmanaged[Cdecl]<delegate* unmanaged[Cdecl]<int, int>, int, int>)NativeLibrary.GetExport(probe, "probe_fork");
        using var locked = new ManualResetEventSlim(); using var release = new ManualResetEventSlim();
        var holder = new Thread(() => { lock (AppDomain.CurrentDomain) { locked.Set(); release.Wait(); } });
        holder.Start(); Check(locked.Wait(10000), "registry lock held");
        try
        {
            Trace("fork " + forkKind);
            Check(fork(&Child, forkKind) == 0, "fork guard before inherited lock or cached call: " + forkKind);
            Trace("fork passed " + forkKind);
        }
        finally { release.Set(); holder.Join(); }
        var library = libraries[retiredBy == "copied" ? "libcopied_peer.so" : "libowned_aggregates_dotnet.so"].Item2;
        var symbol = retiredBy == "copied" ? "copied_peer_graph_retire" : "lean_bridge_native_runtime_retire";
        ((delegate* unmanaged[Cdecl]<void>)NativeLibrary.GetExport(library, symbol))();
        Trace("runtime retired by " + retiredBy);
        Unavailable(() => A.Api.Serial(first)); Unavailable(() => B.Api.Serial(second));
        Unavailable(() => C.Api.Echo(tree)); Unavailable(() => D.Api.Answer());
        Check(tree is C.TreeBranch { Children.Length: 2 }, "copied value survives retirement");
        GC.KeepAlive(threads);
    }
    private static void Main(string[] args)
    {
        Exception? failure = null;
        var creator = new Thread(() => {
            try { Calls(args[0], args[1], int.Parse(args[2])); }
            catch (Exception error) { failure = error; }
        });
        creator.Start(); creator.Join();
        Trace("creator exited");
        if (failure is not null) throw new Exception("Installed peer composition failed", failure);
        var final = Read(); Check(final.Identities == 0, "creator exit drains every owner");
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new {
            checks, order = args[0], retiredBy = args[1], rejectedCalls, threadedCalls,
            components = final.Components, runtimeInitializations = final.RuntimeInitializations,
            liveIdentities = final.Identities, forkChecks = 1, forkKind = int.Parse(args[2]), libraries = 11
        }));
    }
}
