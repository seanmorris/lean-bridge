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
    private static int checks, remaining = -1;
    private static int managedBefore, managedAfter, nativeBefore, nativeAfter;
    private static delegate* unmanaged[Cdecl]<nuint> Live, Identities, Handoffs;
    private static delegate* unmanaged[Cdecl]<nint, void> Fail;
    private static readonly List<Exception> retainedFailures = new();
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
    private static Bundle Bundle(Ticket ticket) => new(ticket, Option<Ticket>.Some(ticket),
        new[] { ticket }, Array.Empty<Ticket>(), new Payload(-17, new byte[] { 0, 255 }));
    private static void Shape<T>(T raw, Func<T, Value<T>> copy, Func<Value<T>, Value<T>> borrow)
    {
        using var original = copy(raw);
        using var view = borrow(original);
        using var deeper = borrow(view);
        using var independent = view.Retain();
        Check(view.Equals(original) && deeper.Equals(view), "canonical whole-value equality");
        original.Dispose();
        Check(view.IsClosed && deeper.IsClosed, "transitive original-owner expiration");
        Reject<LeanBridgeException>(() => view.Get(), 4);
        Reject<LeanBridgeException>(() => deeper.Equals(deeper), 4);
        Check(!independent.IsClosed, "retained value remains independent");
        independent.Get();
    }
    private static void Shapes()
    {
        using var seed = Api.NewTicket(42, "whole\0🙂"); var ticket = seed.Get();
        var bundle = Bundle(ticket);
        Shape(bundle, Api.CopyValue, Api.EchoRecord);
        Shape(bundle, Api.CopyValue, Api.EchoAlias);
        Shape(Array.Empty<Ticket>(), Api.CopyEchoArrayResult, Api.EchoArray);
        Shape(new[] { ticket, ticket }, Api.CopyEchoArrayResult, Api.EchoArray);
        Shape(Array.Empty<Ticket>(), Api.CopyEchoListResult, Api.EchoList);
        Shape(new[] { ticket }, Api.CopyEchoListResult, Api.EchoList);
        Shape(Option<Ticket>.None, Api.CopyValue, Api.EchoOption);
        Shape(Option<Ticket>.Some(ticket), Api.CopyValue, Api.EchoOption);
        Shape(Result<Bundle, Ticket>.Ok(bundle), Api.CopyValue, Api.EchoResult);
        Shape(Result<Bundle, Ticket>.Err(ticket), Api.CopyValue, Api.EchoResult);
        Shape((ticket, (Option<Ticket>.None, bundle.Payload)), Api.CopyValue, Api.EchoTuple);
        foreach (Choice choice in new Choice[] { new ChoiceEmpty(), new ChoiceOne(ticket), new ChoicePair(ticket, ticket), new ChoiceMany(Array.Empty<Ticket>()), new ChoiceMany(new[] { ticket }) })
            Shape(choice, Api.CopyValue, Api.EchoVariant);
        Shape(new[] { Option<Ticket>.None, Option<Ticket>.Some(ticket) }, Api.CopyValue, Api.EchoRow);
        Shape(Array.Empty<Option<Ticket>>(), Api.CopyValue, Api.EchoRow);
        Tree tree = new TreeLeaf(ticket);
        for (int index = 0; index < 12; ++index) tree = new TreeBranch(new[] { tree });
        Shape(tree, Api.CopyValue, Api.EchoRecursive);
        Shape<Tree>(new TreeBranch(Array.Empty<Tree>()), Api.CopyValue, Api.EchoRecursive);
        Shape(Array.Empty<Option<Result<Bundle, Ticket>>[]>(), Api.CopyValue, Api.EchoNested);
        Shape(new[] { Array.Empty<Option<Result<Bundle, Ticket>>>(), new[] { Option<Result<Bundle, Ticket>>.Some(Result<Bundle, Ticket>.Ok(bundle)) } }, Api.CopyValue, Api.EchoNested);
        using var original = Api.CopyValue(bundle);
        using var shared = original.Share(); using var view = Api.EchoRecord(original);
        var raw = original.Get().Primary; using var retained = raw.Retain();
        Check(raw.SameIdentity(retained) && raw.Equals(retained), "resource equality uses native identity");
        original.Dispose(); Check(!view.IsClosed, "shared whole guard preserves original owner");
        shared.Dispose(); Check(view.IsClosed, "last whole guard expires descendants");
        Reject<LeanBridgeException>(() => Api.Serial(raw), 4);
        Reject<LeanBridgeException>(() => raw.Equals(raw), 4);
        Check(Api.Serial(retained) == 42, "independent resource retention");
        Reject<NotSupportedException>(() => retained.GetHashCode());
        Reject<NotSupportedException>(() => view.GetHashCode());
    }
    private static void Callbacks()
    {
        using var seed = Api.NewTicket(42, "callbacks");
        using var original = Api.CopyValue(Bundle(seed.Get()));
        Ticket? escaped = null, kept = null;
        using var reply = Api.CallbackRecord(original, value => {
            escaped = value.Primary; kept = escaped.Retain(); return value;
        });
        Check(Api.Serial(reply.Get().Primary) == 42, "borrowed callback reply");
        Check(escaped!.IsClosed, "callback borrow is closed");
        Reject<LeanBridgeException>(() => Api.Serial(escaped!), 4);
        Check(Api.Serial(kept!) == 42, "explicit callback retention");
        kept!.Dispose(); escaped!.Dispose();
        using var closure = Api.MakeRecord(original);
        using var retainedClosure = closure.Retain();
        using var direct = closure.Get().Invoke(true, Bundle(seed.Get()));
        Check(Api.Serial(direct.Get().Primary) == 42, "closure invocation publishes whole result");
        original.Dispose();
        Reject<LeanBridgeException>(() => closure.Get(), 4);
        Reject<LeanBridgeException>(() => reply.Get(), 4);
        using var independent = retainedClosure.Get().Invoke(true, Bundle(seed.Get()));
        Check(Api.Serial(independent.Get().Primary) == 42, "retained closure survives original owner");
    }
    private static void Transfers()
    {
        using var seed = Api.NewTicket(42, "transfers");
        using var original = Api.CopyValue(Bundle(seed.Get()));
        using var view = Api.EchoRecord(original); using var alias = original.Share();
        using var independent = original.Retain();
        Reject<LeanBridgeException>(() => Api.MoveRecord(view, value => value), 1);
        Check(!original.IsClosed && !view.IsClosed, "borrowed input rejects before handoff");
        using var received = Api.MoveRecord(original, value => {
            Check(original.IsClosed && view.IsClosed && alias.IsClosed, "callback reentry sees original owner consumed");
            return value;
        });
        Check(Api.Serial(received.Get().Primary) == 42 && !independent.IsClosed, "original-slot transfer and retained independence");
        using var empty = Api.CopyEchoArrayResult(Array.Empty<Ticket>());
        using var emptyView = Api.EchoArray(empty);
        using var moved = Api.MoveArray(empty);
        Check(empty.IsClosed && emptyView.IsClosed && moved.Get().Length == 0, "empty owner participates in handoff");
        using var root = Api.NewTicket(43, "conflict");
        using var borrowed = Api.RetainTicket(root);
        Reject<LeanBridgeException>(() => Api.MixedTicket(borrowed, root), 1);
        Check(!root.IsClosed && !borrowed.IsClosed, "anchor ancestor conflict preserves inputs");
        using var failing = Api.CopyValue(Bundle(seed.Get()));
        var sentinel = new InvalidOperationException("same exception");
        var caught = Reject<InvalidOperationException>(() => Api.MoveRecord(failing, _ => throw sentinel));
        Check(ReferenceEquals(caught, sentinel) && failing.IsClosed, "post-handoff error identity and consumption");
        retainedFailures.Add(caught);
    }
    private static void Faults(bool native)
    {
        using var seed = Api.NewTicket(42, "faults");
        var baselineLive = Live(); var baselineIdentities = Identities(); bool finished = false;
        for (int index = 0; index < 2000; ++index)
        {
            using var original = Api.CopyValue(Bundle(seed.Get()));
            using var borrowed = Api.EchoRecord(original);
            var before = Handoffs(); Value<Bundle>? received = null; Exception? failure = null;
            try
            {
                if (native) Fail(index); else remaining = index;
                received = Api.MoveRecord(original, value => value);
                finished = true;
            }
            catch (OutOfMemoryException error) when (!native) { failure = error; }
            catch (LeanBridgeException error) when (native && error.Status == 3) { failure = error; }
            finally { remaining = -1; Fail(-1); }
            var consumed = Handoffs() > before;
            Check(original.IsClosed == consumed && borrowed.IsClosed == consumed, "fault follows actual native handoff");
            if (failure is not null)
            {
                retainedFailures.Add(failure);
                if (native) { if (consumed) ++nativeAfter; else ++nativeBefore; }
                else { if (consumed) ++managedAfter; else ++managedBefore; }
            }
            received?.Dispose(); borrowed.Dispose(); original.Dispose(); Runtime.Current.Require();
            Check(Live() == baselineLive && Identities() == baselineIdentities, $"explicit fault cleanup without GC {native}/{index}");
            if (finished) break;
        }
        Check(finished, "allocation sweep completed");
    }
    private static void Threads()
    {
        using var original = Api.NewTicket(42, "thread");
        Exception? failure = null;
        var thread = new Thread(() => { try { original.Get(); } catch (Exception error) { failure = error; } });
        thread.Start(); thread.Join();
        Check(failure is LeanBridgeException { Status: 5 } && !original.IsClosed, "foreign thread rejects without closing owner");
        Value<Ticket>? escaped = null;
        thread = new Thread(() => { escaped = Api.NewTicket(43, "exit"); });
        thread.Start(); thread.Join();
        Check(escaped!.IsClosed, "creator-thread exit expires whole owner");
        Reject<LeanBridgeException>(() => escaped.Get(), 4);
        escaped.Dispose(); GC.KeepAlive(thread);
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static (WeakReference, Value<Ticket>, Ticket) Abandon()
    {
        var original = Api.NewTicket(44, "collected owner");
        return (new WeakReference(original), Api.RetainTicket(original), original.Get());
    }
    private static void Collection()
    {
        var (weak, borrowed, raw) = Abandon();
        GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect();
        Runtime.Current.Require();
        Check(!weak.IsAlive && borrowed.IsClosed && raw.IsClosed, "raw views and descendants do not keep whole owner alive");
        Reject<LeanBridgeException>(() => borrowed.Get(), 4);
        borrowed.Dispose(); raw.Dispose();
        using var owner = Api.NewTicket(45, "foreign disposal");
        using var view = Api.RetainTicket(owner);
        var thread = new Thread(owner.Dispose); thread.Start(); thread.Join();
        Runtime.Current.Require();
        Check(view.IsClosed, "foreign disposal queues native cleanup on creator thread");
        var cycle = new Tree[1]; cycle[0] = new TreeBranch(cycle);
        Reject<ArgumentException>(() => Api.CopyValue(cycle[0]));
    }
    private static void Main(string[] args)
    {
        var library = NativeLibrary.Load(args[0]); OwnedLoader.Bindings = new OwnedBindings(library);
        Live = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, "probe_live");
        Identities = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, "probe_identities");
        Handoffs = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, "probe_handoffs");
        Fail = (delegate* unmanaged[Cdecl]<nint, void>)NativeLibrary.GetExport(library, "probe_fail");
        Runtime.Current.Require(); Shapes(); Callbacks(); Transfers();
        Faults(false); Faults(true); Threads(); Collection();
        Runtime.Current.Require(); Runtime.Current.Dispose();
        Check(Live() == 0 && Identities() == 0, "all owners released");
        GC.KeepAlive(retainedFailures);
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { checks, managedBefore, managedAfter, nativeBefore, nativeAfter, live = (ulong)Live(), identities = (ulong)Identities() }));
    }
}
