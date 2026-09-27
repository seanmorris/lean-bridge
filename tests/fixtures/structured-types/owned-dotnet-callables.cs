using System;
using System.Collections.Generic;
using System.Numerics;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Threading;
using LeanBridge.OwnedAggregates;
using LeanBridge.OwnedAggregates.Interop;

internal static unsafe class Program
{
    private static int checks, managedFailures, nativeFailures, boundedInvocations;
    private static int remaining = -1;
    private static delegate* unmanaged[Cdecl]<nuint> Live, Identities;
    private static delegate* unmanaged[Cdecl]<nint, void> Fail;
    private static delegate* unmanaged[Cdecl]<void> Retire;
    private static OwnedRuntime Runtime => OwnedLoader.Bindings.Runtime;
    internal static void Allocation()
    {
        if (remaining == 0) throw new OutOfMemoryException("injected managed failure");
        if (remaining > 0) --remaining;
    }
    private static void Check(bool value, string message)
    { if (!value) throw new Exception(message); Interlocked.Increment(ref checks); }
    private static T Reject<T>(Action action, int? status = null) where T : Exception
    {
        try { action(); }
        catch (T error)
        {
            Check(status is null || error is LeanBridgeException bridge && bridge.Status == status, "exception status");
            return error;
        }
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
        }
    }
    private static Bundle Bundle(Ticket ticket) => new(ticket, Option<Ticket>.Some(ticket), new[] { ticket }, new[] { ticket }, new Payload(-7, new byte[] { 0, 255, 1 }));
    private static void Same(Bundle value, BigInteger serial)
    {
        Check(Api.Serial(value.Primary) == serial, "callback resource payload");
        Check(value.Payload.Count == -7, "callback copied payload"); Drop(value);
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static bool Attempt(Bundle value, int index, bool native)
    {
        try
        {
            if (native) Fail(index); else remaining = index;
            var result = Api.CallbackRecord(value, item => item);
            remaining = -1; Fail(-1); Drop(result); return true;
        }
        catch (OutOfMemoryException) when (!native) { ++managedFailures; return false; }
        catch (LeanBridgeException error) when (native && error.Status == 3) { ++nativeFailures; return false; }
        finally { remaining = -1; Fail(-1); }
    }
    private static void Collect()
    { GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect(); Runtime.Current.Require(); }
    private static void Failures(Bundle value)
    {
        Collect(); var live = Live(); var identities = Identities();
        foreach (bool native in new[] { false, true })
        {
            bool finished = false;
            for (int index = 0; index < 2000; index++)
            {
                finished = Attempt(value, index, native); Collect();
                Check(Live() == live, $"callback allocation rollback {native}/{index}");
                Check(Identities() == identities, $"callback identity rollback {native}/{index}");
                if (finished) break;
            }
            Check(finished, "fault sweep completed");
        }
    }
    private static void Callbacks()
    {
        using var ticket = Api.NewTicket(42, "callback");
        var bundle = Bundle(ticket);
        Ticket? escaped = null, kept = null, local = null;
        var value = Api.CallbackRecord(bundle, input => {
            escaped = input.Primary; kept = input.Primary.Retain();
            local = Api.NewTicket(91, "local"); GC.Collect(); GC.WaitForPendingFinalizers();
            return input with { Primary = local };
        });
        Check(escaped!.IsClosed && Api.Serial(kept!) == 42, "argument expiry and independent retain");
        Check(Api.Serial(value.Primary) == 91, "owned callback-local reply");
        Drop(value); kept!.Dispose(); local!.Dispose();
        Reject<LeanBridgeException>(() => Api.Serial(escaped), 4);
        var sentinel = new InvalidOperationException("original callback error");
        var caught = Reject<InvalidOperationException>(() => Api.CallbackRecord(bundle, input => { escaped = input.Primary; throw sentinel; }));
        Check(ReferenceEquals(caught, sentinel) && escaped.IsClosed, "exception identity and expiry");
        Check(caught.StackTrace!.Contains(nameof(Callbacks)), "callback exception stack preserved");
        Same(Api.CallbackRecord(bundle, input => {
            Check(ReferenceEquals(Reject<InvalidOperationException>(() => Api.CallbackRecord(input, _ => throw sentinel)), sentinel), "nested error containment");
            return input;
        }), 42);
        int invoked = 0;
        CallbackRecordArgument1ClosureCallback mutable = input => { ++invoked; return input; };
        Same(Api.Twice(bundle, mutable), 42); Check(invoked == 2, "repeated callback invocation");
        using var dispatch = Api.Dispatch(bundle);
        Same(dispatch.Invoke(mutable), 42); Check(invoked == 3, "returned higher-order closure");
        using var identity = Api.IdentityClosure(default);
        Same(dispatch.Invoke(identity.AsCallback), 42);
        Same(Api.CallbackRecord(bundle, identity.AsCallback), 42);
        using var retained = Api.RetainCallback(identity.AsCallback);
        identity.Dispose(); Same(retained.Invoke(bundle), 42);
        CallbackRecordArgument1ClosureCallback multicast = input => { ++invoked; return input; };
        multicast += retained.AsCallback;
        Same(Api.CallbackRecord(bundle, multicast), 42); Check(invoked == 4, "multicast keeps earlier side effects");
        using var expired = Api.RetainCallback(input => input);
        Reject<LeanBridgeException>(() => expired.Invoke(bundle), 10);
        Same(dispatch.Invoke(input => { dispatch.Dispose(); return input; }), 42);
        Reject<LeanBridgeException>(() => dispatch.Invoke(mutable), 4);
        Reject<ArgumentException>(() => Api.Factory(_ => ticket));
        using var made = Api.Factory(OwnedCallbacks.WithRecovery((Unit _) => ticket, ticket));
        Check(Api.Serial(made) == 42, "explicit typed recovery");
        Check(ReferenceEquals(Reject<InvalidOperationException>(() => Api.Factory(OwnedCallbacks.WithRecovery((Unit _) => throw sentinel, ticket))), sentinel), "failure never publishes recovery");
        Same(Api.Construct(ticket, argument => Bundle(argument)), 42);
        var tree = new TreeBranch(new Tree[] { new TreeLeaf(ticket), new TreeBranch(new Tree[] { new TreeLeaf(ticket) }) });
        var result = Api.CallbackRecursive(tree, input => input); Check(result is TreeBranch, "recursive callback"); Drop(result);
        using var victim = Api.NewTicket(93, "pinned");
        Same(Api.CallbackRecord(Bundle(victim), input => { victim.Dispose(); GC.Collect(); return input; }), 93);
        Reject<ArgumentNullException>(() => Api.CallbackRecord(bundle, null!));
        Reject<ArgumentNullException>(() => Api.CallbackRecord(bundle, _ => null!));
        Reject<ArgumentException>(() => Api.CallbackRecord(bundle, input => input with { Payload = new Payload(0, new byte[17 * 1024 * 1024]) }));
        Reject<LeanBridgeException>(() => Api.Repeatedly(bundle, input => { ++boundedInvocations; return input; }, 10000), 2);
        Check(boundedInvocations > 1 && boundedInvocations < 10000, "bounded generated callback work");
        Same(Api.CallbackRecord(bundle, input => input), 42);
        Failures(bundle);
        Threads();
    }
    private static void Threads()
    {
        Collect(); var live = Live(); var identities = Identities();
        var held = new List<Ticket>(); var threads = new List<Thread>();
        for (int i = 0; i < 8; i++)
        {
            Exception? failure = null;
            var thread = new Thread(() => {
                try
                {
                    var ticket = Api.NewTicket(71, "thread"); held.Add(ticket);
                    var result = Api.CallbackRecord(Bundle(ticket), input => { held.Add(input.Primary); return input; });
                    held.Add(result.Primary); Drop(result);
                }
                catch (Exception error) { failure = error; }
            });
            thread.Start(); thread.Join(); threads.Add(thread);
            Check(failure is null, "thread callback completed");
            Check(Live() == live && Identities() == identities, "thread-exit callback cleanup");
        }
        foreach (var ticket in held) Check(ticket.IsClosed, "dead-thread wrapper closed");
        using var entered = new ManualResetEventSlim();
        Exception? interruption = null;
        var interrupted = new Thread(() => {
            try
            {
                var ticket = Api.NewTicket(81, "interrupted"); held.Add(ticket);
                Api.CallbackRecord(Bundle(ticket), input => { held.Add(input.Primary); entered.Set(); Thread.Sleep(Timeout.Infinite); return input; });
            }
            catch (Exception error) { interruption = error; }
        });
        interrupted.Start(); Check(entered.Wait(10000), "callback reached blocking point");
        interrupted.Interrupt(); Check(interrupted.Join(10000), "interrupted thread exited"); threads.Add(interrupted);
        Check(interruption is ThreadInterruptedException, "interruption contained before native return");
        Check(Live() == live && Identities() == identities, "interruption cleanup");
        foreach (var ticket in held) Check(ticket.IsClosed, "held interrupted wrapper closed");
        GC.KeepAlive(threads); GC.KeepAlive(held);
    }
    private static void Retirement()
    {
        using var ticket = Api.NewTicket(1, "retire");
        Reject<LeanBridgeException>(() => Api.CallbackRecord(Bundle(ticket), input => { Retire(); return input; }), 7);
        Reject<LeanBridgeException>(() => Api.Serial(ticket), 7);
    }
    private static void Main(string[] args)
    {
        var library = NativeLibrary.Load(args[0]); OwnedLoader.Bindings = new OwnedBindings(library);
        Live = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, "probe_live");
        Identities = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, "probe_identities");
        Fail = (delegate* unmanaged[Cdecl]<nint, void>)NativeLibrary.GetExport(library, "probe_fail");
        Retire = (delegate* unmanaged[Cdecl]<void>)NativeLibrary.GetExport(library, "probe_retire");
        if (args[1] == "retirement") Retirement(); else Callbacks();
        Collect(); Runtime.Current.Dispose();
        Check(Live() == 0 && Identities() == 0, "all callback owners released");
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { checks, managedFailures, nativeFailures, boundedInvocations, live = (ulong)Live(), identities = (ulong)Identities() }));
    }
}
