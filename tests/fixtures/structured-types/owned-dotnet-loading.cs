using System;
using System.Collections.Generic;
using System.IO;
using System.Numerics;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Threading;
using LeanBridge.OwnedAggregates;

internal static unsafe class Program
{
    private static int checks;
    private static void Trace(string stage)
    { if (Environment.GetEnvironmentVariable("LEAN_BRIDGE_DOTNET_DEBUG") == "1") Console.Error.WriteLine(stage); }
    private static void Check(bool value, string message)
    { if (!value) throw new Exception(message); checks++; }
    private static void Reject(Action action, string message)
    {
        try { action(); }
        catch (InvalidOperationException error) when (error.Message.Contains(message)) { checks++; return; }
        throw new Exception("Expected rejection: " + message);
    }
    private static Bundle Bundle(Ticket ticket) => new(ticket, Option<Ticket>.Some(ticket), new[] { ticket }, new[] { ticket }, new Payload(-7, new byte[] { 0, 255 }));
    private static void Drop(Bundle value)
    {
        value.Primary.Dispose();
        if (value.Spare.IsSome) value.Spare.Value.Dispose();
        foreach (var item in value.Peers) item.Dispose();
        foreach (var item in value.History) item.Dispose();
    }
    private static void Calls()
    {
        var number = (BigInteger.One << 257) + 19;
        using var ticket = Api.NewTicket(number, "room\0🌿");
        for (int i = 0; i < 128; i++) Check(Api.Serial(ticket) == number, "private GMP round trip");
        Check(Api.Label(ticket) == "room\0🌿", "Unicode and embedded NUL");
        using var retained = ticket.Retain();
        var input = Bundle(ticket);
        Ticket? escaped = null, kept = null;
        var result = Api.CallbackRecord(input, value => { escaped = value.Primary; kept = value.Primary.Retain(); return value; });
        Check(escaped!.IsClosed, "callback borrow expired");
        Check(Api.Serial(kept!) == number && Api.Serial(result.Primary) == number, "callback retain and reply");
        kept!.Dispose(); Drop(result);
        using var closure = Api.IdentityClosure(default);
        using var dispatch = Api.Dispatch(input);
        result = dispatch.Invoke(closure.AsCallback);
        Check(Api.Serial(result.Primary) == number, "higher-order native pass through"); Drop(result);
        var sentinel = new InvalidOperationException("installed callback");
        try { Api.CallbackRecord(input, _ => throw sentinel); throw new Exception("Exception was lost"); }
        catch (InvalidOperationException error) { Check(ReferenceEquals(error, sentinel), "original callback exception"); }
        using var made = Api.Factory(OwnedCallbacks.WithRecovery((Unit _) => ticket, ticket));
        Check(Api.Serial(made) == number, "typed recovery");
        var held = new List<Ticket>(); var threads = new List<Thread>();
        for (int i = 0; i < 12; i++)
        {
            Exception? failure = null;
            var thread = new Thread(() => { try { held.Add(Api.NewTicket(number, "thread")); } catch (Exception error) { failure = error; } });
            thread.Start(); thread.Join(); threads.Add(thread);
            Check(failure is null, "thread call");
        }
        foreach (var item in held) Check(item.IsClosed, "retained dead-thread wrapper closed");
        GC.KeepAlive(threads); GC.KeepAlive(held);
        // Materialize the reverse P/Invoke entry before fork. CoreCLR's JIT
        // mappings are shared across fork; the child must not compile this stub.
        Check(((delegate* unmanaged[Cdecl]<int>)&Child)() == 1, "parent callback prepared");
    }
    [UnmanagedCallersOnly(CallConvs = new[] { typeof(CallConvCdecl) })]
    private static int Child()
    {
        try { using var value = Api.NewTicket(1, "fork"); return 1; }
        catch (InvalidOperationException error) { return error.Message.Contains("fresh process") ? 0 : 2; }
        catch { return 3; }
    }
    private static void Main(string[] args)
    {
        string root = Path.Combine(AppContext.BaseDirectory, "runtimes", "linux-x64", "native");
        if (args[0] == "preload")
        {
            NativeLibrary.Load(Path.Combine(root, "libleanshared.so"));
            Reject(() => { using var value = Api.NewTicket(1, "preload"); }, "already loaded");
            Console.WriteLine("preload rejected"); return;
        }
        // Session identities are cached for a live creator thread. Exit that
        // thread before checking complete reclamation, including its session.
        Exception? failure = null;
        var caller = new Thread(() => { try { Calls(); } catch (Exception error) { failure = error; } });
        Trace("starting public calls"); caller.Start(); caller.Join(); Trace("creator exited");
        if (failure is not null) throw new Exception("Public package consumer failed", failure);
        var library = NativeLibrary.Load(Path.Combine(root, "libowned_aggregates_dotnet.so"));
        var identities = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, "probe_identities");
        var gmpPath = (delegate* unmanaged[Cdecl]<nint>)NativeLibrary.GetExport(library, "probe_gmp_path");
        var path = Marshal.PtrToStringUTF8(gmpPath())!;
        Trace("GMP: " + path + "; identities: " + identities());
        Check(path.EndsWith("libgmp-lean-bridge.so.10") && Path.GetFullPath(path).StartsWith(root + "/"), "private GMP dependency");
        Check(identities() == 0, "all native identities released");
        Trace("matching assets"); Check(MatchedAssets.Handle == library, "matching package reuses authenticated libraries");
        Reject(() => { _ = RuntimeConflictAssets.Handle; }, "runtime identities");
        Reject(() => { _ = ComponentConflictAssets.Handle; }, "same Lean component");
        var fork = (delegate* unmanaged[Cdecl]<delegate* unmanaged[Cdecl]<int>, int>)NativeLibrary.GetExport(library, "probe_fork");
        using var locked = new ManualResetEventSlim(); using var release = new ManualResetEventSlim();
        var holder = new Thread(() => { lock (AppDomain.CurrentDomain) { locked.Set(); release.Wait(); } });
        holder.Start(); Check(locked.Wait(10000), "registry lock held"); Trace("starting fork");
        int status;
        try { status = fork(&Child); }
        finally { release.Set(); holder.Join(); }
        Trace("fork status: " + status); Check(status == 0, "fork rejection precedes inherited registry lock");
        Check(identities() == 0, "fork rejection leaves parent unchanged");
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { checks, privateGmp = true, forkBeforeLock = true, identities = (ulong)identities() }));
    }
}
