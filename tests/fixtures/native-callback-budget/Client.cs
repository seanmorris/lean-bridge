using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using LeanBridge.Budget;

internal static class Program
{
    static void Check(bool value, [CallerLineNumber] int line = 0)
    {
        if (!value) throw new Exception("Failed check at client line " + line);
    }
    static async Task<E> Caught<E>(Func<Task> run) where E : Exception
    {
        try { await run(); }
        catch (E e) { Check(e.GetType() == typeof(E)); return e; }
        throw new Exception("Expected " + typeof(E).Name);
    }
    static async Task<CallbackAlreadyInvokedException> Denied(string declaration, Func<Task> run)
    {
        var e = await Caught<CallbackAlreadyInvokedException>(run);
        Check(e.Declaration == declaration && e.Message == "callback-already-invoked");
        return e;
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static (WeakReference, RetainedCallback<Func<uint, uint>>) Tracked(int[] calls)
    {
        var captured = new object();
        return (new WeakReference(captured), RetainedCallback.Create<uint, uint>(n => {
            ++calls[0]; GC.KeepAlive(captured); return n + 1;
        }));
    }
    static async Task Cases()
    {
        int[] calls = [0, 0];
        var (weak, registration) = Tracked(calls);
        var f = registration.Callback;
        await Denied("Budget.probe", () => Api.Probe(1, f, n => { ++calls[1]; return n + 1; }));
        Check(calls[0] == 1 && calls[1] == 2);
        Check(await Api.Pair(40, f, f) == 42);
        var a = Api.Single(3, f); var b = Api.Single(41, f);
        Check(await b == 42 && await a == 4 && calls[0] == 5);

        var original = new ApplicationException("callback-already-invoked");
        int failed = 0;
        Func<uint, uint> boom = _ => { ++failed; throw original; };
        await Denied("Budget.retry", () => Api.Retry(1, boom));
        Check(failed == 1);
        Check(ReferenceEquals(await Caught<ApplicationException>(() => Api.Single(1, boom)), original));
        var prior = await Denied("Racing.duringStart", () => Api.DuringStart(1, f));
        Check(ReferenceEquals(await Caught<CallbackAlreadyInvokedException>(() => Api.Single(1, _ => throw prior)), prior));
        var factory = await Caught<LeanIOException>(() => Api.Start(0, f));
        Check(factory.Declaration == "FactoryFault.start" && factory.Message.Contains(original.Message));
        var terminal = await Caught<TaskIOException>(() => Api.Replace(1, f));
        Check(terminal.Declaration == "Racing.replace" && terminal.Message.Contains(original.Message));
        int before = calls[0];
        var typed = await Caught<DeclaredError<uint>>(() => Api.Checked(0, f));
        Check(typed.Payload == 73 && typed.Declaration == "TypedBudget.checked" && calls[0] == before);
        await Denied("TypedBudget.checked", () => Api.Checked(1, f));
        Check(calls[0] == before + 1);
        for (uint n = 0; n < 16; ++n) {
            before = calls[0]; await Denied("Racing.race", () => Api.Race(n, f));
            Check(calls[0] == before + 1);
        }
        Check(weak.IsAlive); registration.Dispose();
        for (int i = 0; weak.IsAlive && i < 6; ++i) { GC.Collect(); GC.WaitForPendingFinalizers(); }
        Check(!weak.IsAlive && registration.IsClosed);
    }
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate void ReadSnapshot(nint dst);
    static void Main()
    {
        LeanRuntime.Run(Cases);
        // Observe the native broker that actually served these calls. Do not load another.
        var loaded = (Dictionary<string, object>)AppDomain.CurrentDomain.GetData("lean-bridge.native-library-v1.dotnet")!;
        var read = Marshal.GetDelegateForFunctionPointer<ReadSnapshot>(
            NativeLibrary.GetExport((nint)loaded["broker"], "lean_bridge_native_snapshot_read"));
        var p = Marshal.AllocHGlobal(40);
        try { read(p); Check(Marshal.ReadInt32(p) == 1 && Marshal.ReadInt32(p, 8) == 1 && Marshal.ReadInt32(p, 20) == 0); }
        finally { Marshal.FreeHGlobal(p); }
        Console.WriteLine("CLR: 16 one-call worker races; factory, terminal, typed and original errors distinct; capture released; zero leases");
    }
}
