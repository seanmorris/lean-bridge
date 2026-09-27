using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading;

namespace Probe;

internal static class Faults
{
    [ThreadStatic] internal static int Remaining;
    [ThreadStatic] internal static bool Enabled;
    internal static void Check()
    {
        if (Enabled && Remaining-- == 0) throw new OutOfMemoryException("injected managed ownership failure");
    }
}

internal static unsafe class Program
{
    private static int checks, managedFailures, nativeFailures;
    private static OwnedRuntime runtime = null!;
    private static nint library;
    private static delegate* unmanaged[Cdecl]<nuint> Live, Identities, Exits, ExitErrors, ReleaseCalls;
    private static delegate* unmanaged[Cdecl]<int, void> InvalidProcess;
    private static delegate* unmanaged[Cdecl]<nint, void> FailAfter;
    private static delegate* unmanaged[Cdecl]<void> Retire;
    private static delegate* unmanaged[Cdecl]<int> Fork;
    private static delegate* unmanaged[Cdecl]<nint, ulong, nint*, nint*, uint> New;
    private static delegate* unmanaged[Cdecl]<nint, nint, nint*, nint*, uint> Retain;
    private static delegate* unmanaged[Cdecl]<nint, nint, ulong*, nint*, uint> Serial;
    private static delegate* unmanaged[Cdecl]<nint, nint*, nint*, uint> Closure;
    private static delegate* unmanaged[Cdecl]<nint, nint, uint> ActiveCleanup;
    private static delegate* unmanaged[Cdecl]<nint, nint, delegate* unmanaged[Cdecl]<uint>, uint> CloseDuringCall;
    [ThreadStatic] private static OwnedState? closing;
    [ThreadStatic] private static Exception? callbackFailure;

    private static nint Symbol(string name) => NativeLibrary.GetExport(library, name);
    private static void Check(bool condition)
    {
        int index = Interlocked.Increment(ref checks);
        if (!condition) throw new Exception("ownership check failed at " + index);
    }
    private static T Reject<T>(Action action) where T : Exception
    {
        try { action(); }
        catch (T error) { Check(true); return error; }
        throw new Exception("Expected " + typeof(T).Name);
    }
    private static void Rejected(int status, Action action) => Check(Reject<LeanBridgeException>(action).Status == status);
    private static void Empty()
    {
        Check(SpinWait.SpinUntil(() => Live() == 0 && Identities() == 0, TimeSpan.FromSeconds(10)));
        Check(Live() == 0); Check(Identities() == 0); Check(ExitErrors() == 0);
    }
    private static OwnedHandle Make(OwnedState state, ulong serial)
    {
        using var owner = new OwnedResult(state);
        nint output = 0;
        fixed (nint* value = &owner.Value) OwnedRuntime.Check(New(state.Require(), serial, &output, value));
        var result = new OwnedHandle(owner.Adopt(), output);
        owner.Complete(); return result;
    }
    private static OwnedHandle Keep(OwnedHandle handle)
    {
        var state = handle.Lease.State;
        using var owner = new OwnedResult(state);
        nint output = 0;
        fixed (nint* value = &owner.Value) OwnedRuntime.Check(Retain(state.Require(), handle.Raw(state), &output, value));
        var result = new OwnedHandle(owner.Adopt(), output);
        owner.Complete(); GC.KeepAlive(handle); return result;
    }
    private static ulong Read(OwnedHandle handle)
    {
        var state = handle.Lease.State;
        using var owner = new OwnedResult(state);
        ulong output = 0;
        fixed (nint* value = &owner.Value) OwnedRuntime.Check(Serial(state.Require(), handle.Raw(state), &output, value));
        GC.KeepAlive(handle); return output;
    }
    private static OwnedHandle MakeClosure(OwnedState state)
    {
        using var owner = new OwnedResult(state);
        nint output = 0;
        fixed (nint* value = &owner.Value) OwnedRuntime.Check(Closure(state.Require(), &output, value));
        var result = new OwnedHandle(owner.Adopt(), output);
        owner.Complete(); return result;
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static WeakReference Abandon(OwnedState state)
    {
        var handle = Make(state, 100);
        Check(Read(handle) == 100);
        return new WeakReference(handle);
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static WeakReference AbandonTransaction(OwnedState state, out OwnedHandle escaped)
    {
        var owner = new OwnedResult(state);
        nint output = 0;
        fixed (nint* value = &owner.Value) OwnedRuntime.Check(New(state.Require(), 102, &output, value));
        escaped = new OwnedHandle(owner.Adopt(), output);
        return new WeakReference(owner);
    }
    private static void Collect()
    {
        for (int i = 0; i < 3; ++i) { GC.Collect(); GC.WaitForPendingFinalizers(); }
    }
    [UnmanagedCallersOnly(CallConvs = new[] { typeof(CallConvCdecl) })]
    private static uint CloseCallback()
    {
        try { closing!.Dispose(); return 0; }
        catch (Exception error) { callbackFailure = error; return 10; }
    }

    private static void Lifetimes()
    {
        OwnedRuntime.Check(0);
        foreach (uint status in new uint[] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 99 })
            Rejected((int)status, () => OwnedRuntime.Check(status));
        using (var state = new OwnedState(runtime))
        {
            var first = Make(state, 41);
            var shared = new OwnedHandle(first.Lease, first.Raw(state));
            var kept = Keep(first);
            Check(first.Raw(state) == shared.Raw(state) && first.Raw(state) == kept.Raw(state));
            first.Dispose(); first.Dispose(); Check(first.IsClosed);
            Rejected(4, () => Read(first));
            Check(Read(shared) == 41); shared.Dispose(); Check(Read(kept) == 41);
            using (var other = new OwnedState(runtime)) Rejected(1, () => kept.Raw(other));
            OwnedHandle borrowed, borrowedCopy, retained;
            using (var frame = new OwnedBorrowFrame(state))
            {
                borrowed = new OwnedHandle(frame.Lease, kept.Raw(state));
                borrowedCopy = new OwnedHandle(frame.Lease, borrowed.Raw(state));
                retained = Keep(borrowed);
                Check(Read(borrowed) == 41);
            }
            Check(borrowed.IsClosed && borrowedCopy.IsClosed);
            Rejected(4, () => Read(borrowed)); Rejected(4, () => Read(borrowedCopy));
            Check(Read(retained) == 41); retained.Dispose(); borrowed.Dispose(); borrowedCopy.Dispose();
            OwnedHandle? unwound = null;
            var marker = new Exception("scope unwind");
            var caught = Reject<Exception>(() => {
                using var frame = new OwnedBorrowFrame(state);
                unwound = new OwnedHandle(frame.Lease, kept.Raw(state));
                throw marker;
            });
            Check(ReferenceEquals(caught, marker) && unwound!.IsClosed);
            Rejected(4, () => Read(unwound!)); unwound!.Dispose();
            Check(Read(kept) == 41);
            nuint before = Live(), identities = Identities();
            OwnedHandle? escaped = null;
            caught = Reject<Exception>(() => {
                using var owner = new OwnedResult(state);
                nint output = 0;
                fixed (nint* value = &owner.Value) OwnedRuntime.Check(New(state.Require(), 72, &output, value));
                escaped = new OwnedHandle(owner.Adopt(), output);
                Check(Read(escaped) == 72);
                throw marker;
            });
            Check(ReferenceEquals(caught, marker)); Check(escaped!.IsClosed);
            Rejected(4, () => Read(escaped)); Check(Live() == before && Identities() == identities);
            escaped.Dispose();
            OwnedRuntime.Check(ActiveCleanup(state.Require(), kept.Raw(state)));
            Check(Read(kept) == 41);
            Check(Fork() == 1); Check(Read(kept) == 41);
            Exception? wrongThread = null;
            var reader = new Thread(() => { try { Read(kept); } catch (Exception error) { wrongThread = error; } });
            reader.Start(); reader.Join(); Check(wrongThread is LeanBridgeException { Status: 5 });
            Check(Read(kept) == 41);
            var disposer = new Thread(kept.Dispose); disposer.Start(); disposer.Join();
            Check(kept.IsClosed); state.Drain();
            before = Live(); identities = Identities();
            for (int i = 0; i < 16; ++i)
            {
                var garbage = Abandon(state); Collect(); Check(!garbage.IsAlive);
                // The managed finalizer only flags cleanup. Native release waits
                // for this owning thread, which can still make valid calls.
                state.Drain(); Check(Live() == before && Identities() == identities);
                using var valid = Make(state, 99); Check(Read(valid) == 99);
            }
            var unfinished = AbandonTransaction(state, out var unpublished);
            nuint nativeReleases = ReleaseCalls();
            Collect(); Check(!unfinished.IsAlive); Check(unpublished.IsClosed);
            Check(ReleaseCalls() == nativeReleases);
            state.Drain(); Check(Live() == before && Identities() == identities);
            unpublished.Dispose();
            var abandoned = Abandon(state);
            nativeReleases = ReleaseCalls(); Collect();
            Check(!abandoned.IsAlive); Check(ReleaseCalls() == nativeReleases);
            state.Drain(); Check(Live() == before && Identities() == identities);
            using var callable = MakeClosure(state); Check(!callable.IsClosed);
        }
        Empty();
        int loaderCalls = 0;
        var guarded = new OwnedRuntime(library, () => ++loaderCalls);
        using (var state = new OwnedState(guarded))
        {
            using var handle = Make(state, 53);
            int before = loaderCalls;
            InvalidProcess(1);
            try
            {
                Rejected(6, () => state.Require()); Rejected(6, () => Read(handle));
                Rejected(6, handle.Dispose); Check(handle.IsClosed);
                Check(loaderCalls == before);
            }
            finally { InvalidProcess(0); }
            Check(!handle.IsClosed); Check(Read(handle) == 53);
        }
        Empty();
        using (var state = new OwnedState(runtime))
        {
            using var handle = Make(state, 55);
            closing = state;
            OwnedRuntime.Check(CloseDuringCall(state.Require(), handle.Raw(state), &CloseCallback));
            closing = null;
            Check(callbackFailure is null); Check(state.IsClosed && handle.IsClosed);
            Rejected(4, () => Read(handle));
        }
        Empty();
    }

    private static void Failures()
    {
        using (var state = new OwnedState(runtime))
        {
            nuint before = Live(), identities = Identities();
            for (int point = 0; point < 128; ++point)
            {
                bool passed = false;
                try
                {
                    Faults.Remaining = point; Faults.Enabled = true;
                    using var ticket = Make(state, 1000); Check(Read(ticket) == 1000); passed = true;
                }
                catch (OutOfMemoryException) { ++managedFailures; }
                finally { Faults.Enabled = false; }
                state.Drain(); Check(Live() == before && Identities() == identities);
                using (var good = Make(state, 17)) Check(Read(good) == 17);
                if (passed) break;
            }
            Check(managedFailures > 4);
            for (int point = 0; point < 256; ++point)
            {
                bool passed = false;
                try
                {
                    FailAfter(point);
                    using var ticket = Make(state, 1001); Check(Read(ticket) == 1001); passed = true;
                }
                catch (LeanBridgeException error) when (error.Status == 3) { ++nativeFailures; }
                finally { FailAfter(-1); }
                state.Drain(); Check(Live() == before && Identities() == identities);
                using (var good = Make(state, 18)) Check(Read(good) == 18);
                if (passed) break;
            }
            Check(nativeFailures > 4);
        }
        Empty();
    }

    private static int ThreadExit()
    {
        var heldThreads = new List<Thread>();
        var heldValues = new List<OwnedHandle>();
        var errors = new List<Exception>();
        var gate = new object();
        for (int index = 0; index < 32; ++index)
        {
            var thread = new Thread(() => {
                try
                {
                    var state = runtime.Current; Check(ReferenceEquals(state, runtime.Current));
                    var first = Make(state, 812); var retained = Keep(first);
                    Check(Read(first) == 812 && Read(retained) == 812);
                    var closure = MakeClosure(state);
                    lock (gate) { heldValues.Add(first); heldValues.Add(retained); heldValues.Add(closure); }
                }
                catch (Exception error) { lock (gate) errors.Add(error); }
            });
            heldThreads.Add(thread); thread.Start(); thread.Join();
            Check(errors.Count == 0); Empty();
        }
        using var start = new Barrier(9);
        for (int index = 0; index < 8; ++index)
        {
            var thread = new Thread(() => {
                start.SignalAndWait();
                try
                {
                    var state = runtime.Current;
                    for (int i = 0; i < 32; ++i)
                    {
                        var value = Make(state, (ulong)i);
                        Check(Read(value) == (ulong)i);
                        lock (gate) heldValues.Add(value);
                    }
                }
                catch (Exception error) { lock (gate) errors.Add(error); }
            });
            heldThreads.Add(thread); thread.Start();
        }
        start.SignalAndWait();
        for (int i = 32; i < heldThreads.Count; ++i) heldThreads[i].Join();
        if (errors.Count != 0) throw errors[0];
        Empty(); Check(Exits() == 40); Check(heldValues.Count == 352);
        foreach (var value in heldValues)
        {
            Check(value.IsClosed); Rejected(4, () => value.Raw(value.Lease.State)); value.Dispose();
        }
        foreach (var thread in heldThreads) Check(!thread.IsAlive);
        GC.KeepAlive(heldThreads); GC.KeepAlive(heldValues); Collect(); Empty();
        return heldThreads.Count;
    }

    private static int Retirement()
    {
        using var ready = new Barrier(5);
        using var leave = new ManualResetEventSlim();
        var threads = new Thread[4]; var values = new OwnedHandle?[4];
        for (int i = 0; i < threads.Length; ++i)
        {
            int index = i;
            threads[i] = new Thread(() => {
                values[index] = Make(runtime.Current, (ulong)index);
                ready.SignalAndWait(); leave.Wait();
            });
            threads[i].Start();
        }
        ready.SignalAndWait();
        var state = new OwnedState(runtime); var resource = Make(state, 91); var closure = MakeClosure(state);
        Check(Read(resource) == 91); Retire();
        Rejected(7, () => Read(resource));
        resource.Dispose(); closure.Dispose(); state.Dispose();
        leave.Set(); foreach (var thread in threads) thread.Join(); Empty();
        foreach (var value in values) { Check(value!.IsClosed); value.Dispose(); }
        Check(Exits() == 4); GC.KeepAlive(threads); GC.KeepAlive(values);
        return threads.Length;
    }

    private static void Main(string[] arguments)
    {
        library = NativeLibrary.Load(arguments[0]);
        Live = (delegate* unmanaged[Cdecl]<nuint>)Symbol("owned_test_live");
        Identities = (delegate* unmanaged[Cdecl]<nuint>)Symbol("owned_test_identities");
        Exits = (delegate* unmanaged[Cdecl]<nuint>)Symbol("owned_test_exits");
        ExitErrors = (delegate* unmanaged[Cdecl]<nuint>)Symbol("owned_test_exit_errors");
        ReleaseCalls = (delegate* unmanaged[Cdecl]<nuint>)Symbol("owned_test_release_calls");
        InvalidProcess = (delegate* unmanaged[Cdecl]<int, void>)Symbol("owned_test_invalid_process");
        FailAfter = (delegate* unmanaged[Cdecl]<nint, void>)Symbol("owned_test_fail_after");
        Retire = (delegate* unmanaged[Cdecl]<void>)Symbol("owned_test_retire");
        Fork = (delegate* unmanaged[Cdecl]<int>)Symbol("owned_test_fork");
        New = (delegate* unmanaged[Cdecl]<nint, ulong, nint*, nint*, uint>)Symbol("owned_test_new");
        Retain = (delegate* unmanaged[Cdecl]<nint, nint, nint*, nint*, uint>)Symbol("owned_test_retain");
        Serial = (delegate* unmanaged[Cdecl]<nint, nint, ulong*, nint*, uint>)Symbol("owned_test_serial");
        Closure = (delegate* unmanaged[Cdecl]<nint, nint*, nint*, uint>)Symbol("owned_test_closure");
        ActiveCleanup = (delegate* unmanaged[Cdecl]<nint, nint, uint>)Symbol("owned_test_active_cleanup");
        CloseDuringCall = (delegate* unmanaged[Cdecl]<nint, nint, delegate* unmanaged[Cdecl]<uint>, uint>)Symbol("owned_test_close_during_call");
        runtime = new OwnedRuntime(library);
        int deadThreadsHeld = 0;
        if (arguments[1] == "retirement") deadThreadsHeld = Retirement();
        else { Lifetimes(); Failures(); deadThreadsHeld = ThreadExit(); }
        Empty();
        Console.WriteLine(JsonSerializer.Serialize(new { checks, managedFailures, nativeFailures, deadThreadsHeld
            , live = (ulong)Live(), identities = (ulong)Identities(), exits = (ulong)Exits(), exitErrors = (ulong)ExitErrors() }));
    }
}
