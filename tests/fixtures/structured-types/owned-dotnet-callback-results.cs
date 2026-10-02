using System;
using System.Runtime.InteropServices;
using System.Threading;
using LeanBridge.OwnedAggregates;
using LeanBridge.OwnedAggregates.Interop;

internal static unsafe class Program
{
    private static int checks, remaining = -1;
    private static delegate* unmanaged[Cdecl]<nuint> Live, Identities;
    private static delegate* unmanaged[Cdecl]<nint, void> Fail;
    private static OwnedRuntime Runtime => OwnedLoader.Bindings.Runtime;
    internal static void Allocation()
    {
        if (remaining == 0) throw new OutOfMemoryException("injected managed failure");
        if (remaining > 0) --remaining;
    }
    private static void Check(bool value, string message)
    { if (!value) throw new Exception(message); checks++; }
    private static void Expired(Action action)
    {
        try { action(); }
        catch (LeanBridgeException error) when (error.Status == 4) { checks++; return; }
        throw new Exception("expired callback owner was accepted");
    }
    private static Bundle Bundle(Ticket ticket) => new(ticket, Option<Ticket>.Some(ticket),
        new[] { ticket }, new[] { ticket }, new Payload(-17, new byte[] { 0, 255 }));
    private static void Collect()
    { GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect(); Runtime.Current.Require(); }
    private static void OriginalOwners()
    {
        using var capturedTicket = Api.NewTicket(42, "captured");
        using var suppliedTicket = Api.NewTicket(7, "supplied");
        using var captured = Api.CopyValue(Bundle(capturedTicket.Get()));
        using var supplied = Api.CopyValue(Bundle(suppliedTicket.Get()));
        using var closure = Api.MakeRecord(captured.Get());
        using var retainedClosure = closure.Get().Retain();
        using var result = retainedClosure.Invoke(true, supplied);
        using var nested = retainedClosure.Invoke(false, result);
        using var kept = result.Retain();
        using var shared = supplied.Share();
        var raw = nested.Get().Primary;
        Check(Api.Serial(raw) == 42, "callback result keeps captured data");
        captured.Dispose(); closure.Dispose();
        Check(Api.Serial(result.Get().Primary) == 42, "captured owner and closure are not the result anchor");
        supplied.Dispose();
        Check(!result.IsClosed && !nested.IsClosed, "a shared original owner preserves descendants");
        shared.Dispose();
        Check(result.IsClosed && nested.IsClosed && raw.IsClosed, "callback-local owner expires transitively");
        Expired(() => result.Get()); Expired(() => nested.Get());
        Expired(() => Api.Serial(raw)); Expired(() => retainedClosure.Invoke(false, supplied));
        Check(Api.Serial(kept.Get().Primary) == 42, "retained result has independent ownership");
        using var later = Api.CopyValue(Bundle(suppliedTicket.Get()));
        using var valid = retainedClosure.Invoke(false, later);
        Check(Api.Serial(valid.Get().Primary) == 7, "closure remains usable with a live owner");
        Exception? foreign = null;
        var thread = new Thread(() => { try { retainedClosure.Invoke(false, later); } catch (Exception error) { foreign = error; } });
        thread.Start(); thread.Join();
        Check(foreign is LeanBridgeException, "callback invocation rejects another thread");
        using var native = Api.MakeRecordCallback(kept.Get());
        using var passed = Api.CallbackRecord(later.Get(), native.Get());
        native.Dispose();
        Check(Api.Serial(passed.Get().Primary) == 42, "native closure input preserves its identity and reply");
        using var secondNative = Api.MakeRecordCallback(later.Get());
        using var firstNative = Api.MakeRecordCallback(kept.Get());
        using var twice = Api.ApplyTwice(later.Get(), firstNative.Get(), secondNative.Get());
        Check(Api.Serial(twice.Get().Primary) == 7, "two native closure arguments use their own identities");
        using var dispatch = Api.Dispatch(later.Get());
        using var dispatched = dispatch.Get().Invoke(firstNative.Get());
        firstNative.Dispose(); dispatch.Dispose();
        Check(Api.Serial(dispatched.Get().Primary) == 42, "higher-order native invocation publishes an independent owner");
    }
    private static void EmptyOwners()
    {
        Tree empty = new TreeBranch(Array.Empty<Tree>());
        using var original = Api.CopyValue(empty);
        using var closure = Api.MakeRecursive(empty);
        using var result = closure.Get().Invoke(false, original);
        using var nested = closure.Get().Invoke(true, result);
        using var independent = result.Retain();
        Check(result.Get() is TreeBranch { Children.Length: 0 }, "empty callback result");
        original.Dispose();
        Check(result.IsClosed && nested.IsClosed, "empty values retain their original owner");
        Expired(() => result.Get()); Expired(() => nested.Get()); Expired(() => nested.Equals(nested));
        Check(independent.Get() is TreeBranch { Children.Length: 0 }, "retained empty result is independent");
        using var native = Api.MakeTreeCallback(empty);
        using var passed = Api.CallbackRecursive(empty, native.Get());
        native.Dispose();
        Check(passed.Get() is TreeBranch { Children.Length: 0 }, "empty native callback reply");
    }
    private static int Faults(bool managed)
    {
        using var seed = Api.NewTicket(9, "faults");
        using var original = Api.CopyValue(Bundle(seed.Get()));
        using var closure = Api.MakeRecord(original.Get());
        Collect(); var live = Live(); var identities = Identities(); int rejected = 0;
        for (int index = 0; index < 1024; ++index)
        {
            bool succeeded = false;
            try
            {
                if (managed) remaining = index; else Fail(index);
                using var result = closure.Get().Invoke(false, original);
                Check(Api.Serial(result.Get().Primary) == 9, "fault run preserves the callback result");
                succeeded = true;
            }
            catch (OutOfMemoryException) when (managed) { rejected++; }
            catch (LeanBridgeException error) when (!managed && error.Status == 3) { rejected++; }
            finally { remaining = -1; Fail(-1); }
            Collect();
            Check(Live() == live && Identities() == identities, "failed callback publication leaves no owners");
            Check(!original.IsClosed, "pre-call failure preserves the original owner");
            if (succeeded) { Check(rejected > 0, "allocation failures were exercised"); return rejected; }
        }
        throw new Exception("callback fault injection never reached success");
    }
    private static void Main(string[] args)
    {
        var library = NativeLibrary.Load(args[0]); OwnedLoader.Bindings = new OwnedBindings(library);
        Live = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, "probe_live");
        Identities = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, "probe_identities");
        Fail = (delegate* unmanaged[Cdecl]<nint, void>)NativeLibrary.GetExport(library, "probe_fail");
        Runtime.Current.Require(); OriginalOwners(); EmptyOwners();
        int managedFaults = Faults(true), nativeFaults = Faults(false);
        Collect(); Runtime.Current.Dispose();
        Check(Live() == 0 && Identities() == 0, "callback owners are drained at shutdown");
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { checks, managedFaults, nativeFaults,
            live = (ulong)Live(), identities = (ulong)Identities() }));
    }
}
