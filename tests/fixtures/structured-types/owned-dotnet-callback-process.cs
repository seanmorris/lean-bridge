using System;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Threading;
using LeanBridge.OwnedAggregates;
using LeanBridge.OwnedAggregates.Interop;

internal static unsafe class Program
{
    private static int checks, rejected, forkChecks;
    private static delegate* unmanaged[Cdecl]<nuint> Live, Identities;
    private static delegate* unmanaged[Cdecl]<void> Retire;
    private static Action[] calls = Array.Empty<Action>();
    internal static void Allocation() { }
    private static void Check(bool value, string message)
    { if (!value) throw new Exception(message); checks++; }
    private static Bundle Bundle(Ticket ticket) => new(ticket, Option<Ticket>.Some(ticket),
        new[] { ticket }, new[] { ticket }, new Payload(-17, new byte[] { 0, 255 }));
    private static void Unavailable(Action action, int status = 7)
    {
        try { action(); }
        catch (LeanBridgeException error) when (error.Status == status) { rejected++; return; }
        throw new Exception("retired callback owner remained callable");
    }
    [UnmanagedCallersOnly(CallConvs = new[] { typeof(CallConvCdecl) })]
    private static int Child(int kind)
    {
        try
        {
            if (kind < 0) throw new LeanBridgeException(6, "Start a fresh process after fork");
            calls[kind](); return 1;
        }
        catch (LeanBridgeException error) { return error.Status == 6 ? 0 : 2; }
        catch { return 3; }
    }
    private static void Exercise(string mode, nint library)
    {
        using var seed = Api.NewTicket(42, "process");
        using var owner = Api.CopyValue(Bundle(seed.Get()));
        using var closure = Api.MakeRecord(owner.Get());
        var invoke = closure.Get();
        using var result = invoke.Invoke(false, owner);
        using var native = Api.MakeRecordCallback(owner.Get());
        var pass = native.Get(); var raw = owner.Get();
        using var empty = Api.CopyValue((Tree)new TreeBranch(Array.Empty<Tree>()));
        using var emptyClosure = Api.MakeRecursive(empty.Get());
        using var emptyResult = emptyClosure.Get().Invoke(false, empty);
        using var retained = result.Retain();
        calls = new Action[] {
            () => { _ = result.Get(); },
            () => { using var kept = result.Retain(); },
            () => { using var next = invoke.Invoke(false, owner); },
            () => { using var next = Api.CallbackRecord(raw, pass); },
            () => { _ = emptyResult.Get(); },
            () => { using var shared = result.Share(); },
#if HOST_CALLBACKS
            () => { using var next = Api.CallbackRecord(raw, _ => result); },
#endif
        };
        foreach (var call in calls) call();
        if (mode == "fork")
        {
            // JIT every reverse-P/Invoke and exception path before fork.
            Check(((delegate* unmanaged[Cdecl]<int, int>)&Child)(-1) == 0, "exception path prepared");
            for (int index = 0; index < calls.Length; index++)
                Check(((delegate* unmanaged[Cdecl]<int, int>)&Child)(index) == 1, "parent call prepared");
            var probe = NativeLibrary.Load(System.IO.Path.Combine(System.IO.Path.GetDirectoryName(Environment.GetCommandLineArgs()[1])!, "fork-probe.so"));
            var fork = (delegate* unmanaged[Cdecl]<delegate* unmanaged[Cdecl]<int, int>, int, int>)NativeLibrary.GetExport(probe, "probe_fork");
            var live = Live(); var identities = Identities();
            using var locked = new ManualResetEventSlim(); using var release = new ManualResetEventSlim();
            var holder = new Thread(() => { lock (AppDomain.CurrentDomain) { locked.Set(); release.Wait(); } });
            holder.Start();
            try
            {
                Check(locked.Wait(10000), "registry lock held by another thread");
                for (int index = 0; index < calls.Length; index++)
                {
                    Check(fork(&Child, index) == 0, "callback process rejection before inherited locks: " + index);
                    forkChecks++;
                }
            }
            finally { release.Set(); Check(holder.Join(10000), "lock holder exited"); }
            Check(Live() == live && Identities() == identities, "child calls leave parent owners unchanged");
            Check(Api.Serial(result.Get().Primary) == 42, "parent callback result remains live");
            foreach (var call in calls) call();
        }
        else
        {
#if HOST_CALLBACKS
            if (mode == "host-retirement")
                Unavailable(() => { using var next = Api.CallbackRecord(raw, _ => { Retire(); return result; }); });
            else if (mode == "transfer-retirement")
            {
                using var moving = Api.CopyValue(raw);
                using var alias = moving.Share();
                using var descendant = invoke.Invoke(false, moving);
                Unavailable(() => { using var next = moving.MoveRecord(_ => { Retire(); return result; }); });
                Check(moving.IsClosed && alias.IsClosed && descendant.IsClosed,
                    "retirement after handoff keeps the original owner consumed");
            }
            else
#endif
                Retire();
            for (int index = 0; index < calls.Length; index++)
                Unavailable(calls[index], index is 0 or 1 or 4 or 5 ? 4 : 7);
            Unavailable(() => { _ = retained.Get(); }, 4);
            Check(raw.Payload.Count == -17, "copied payload survives runtime retirement");
        }
        calls = Array.Empty<Action>();
    }
    private static void Main(string[] args)
    {
        var library = NativeLibrary.Load(args[0]); OwnedLoader.Bindings = new OwnedBindings(library);
        Live = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, "probe_live");
        Identities = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, "probe_identities");
        Retire = (delegate* unmanaged[Cdecl]<void>)NativeLibrary.GetExport(library, "probe_retire");
        var state = OwnedLoader.Bindings.Runtime.Current; state.Require();
        Exercise(args[1], library);
        GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect(); state.Dispose();
        Check(Live() == 0 && Identities() == 0, "process scenario drains callback owners");
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new {
            mode = args[1], checks, rejected, forkChecks, live = (ulong)Live(), identities = (ulong)Identities()
        }));
    }
}
