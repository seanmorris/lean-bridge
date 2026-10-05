using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Numerics;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using LeanBridge.OwnedAggregates;
using LeanBridge.OwnedAggregates.Interop;

internal static unsafe class Program
{
    private static int checks, remaining = -1;
    private static int managedBefore, managedAfter, nativeBefore, nativeAfter;
    private static int multiManagedBefore, multiManagedAfter, multiNativeBefore, multiNativeAfter;
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
    private static IEnumerable<object?> Children(object? value) => value switch
    {
        IGraphValue graph => Enumerable.Range(0, graph.GraphCount).Select(graph.GraphField),
        Array array => array.Cast<object?>(),
        ITuple tuple => Enumerable.Range(0, tuple.Length).Select(index => tuple[index]),
        _ => Array.Empty<object?>()
    };
    private static List<IDisposable> Resources(object? root)
    {
        var pending = new Stack<object?>(); pending.Push(root);
        var seen = new HashSet<object>(ReferenceEqualityComparer.Instance);
        var result = new List<IDisposable>();
        while (pending.TryPop(out var value))
        {
            if (value is null || !seen.Add(value)) continue;
            if (value is IOwnedValue owned) result.Add((IDisposable)owned);
            else foreach (var item in Children(value)) pending.Push(item);
        }
        return result;
    }
    private static bool Closed(IDisposable resource) => (bool)resource.GetType().GetProperty("IsClosed")!.GetValue(resource)!;
    private static void Drop(object? value) { foreach (var resource in Resources(value)) resource.Dispose(); }
    private static string Semantic(object? value)
    {
        if (value is Ticket ticket) return "ticket:" + Api.Serial(ticket).ToString(CultureInfo.InvariantCulture) + ":" + Api.Label(ticket);
        if (value is byte[] bytes) return Convert.ToHexString(bytes);
        if (value is double precise) return "f64:" + BitConverter.DoubleToInt64Bits(precise);
        if (value is float approximate) return "f32:" + BitConverter.SingleToInt32Bits(approximate);
        if (value is IGraphValue graph) return value.GetType().Name + ":" + graph.GraphTag + "[" + string.Join(";", Children(value).Select(Semantic)) + "]";
        if (value is Array or ITuple) return "[" + string.Join(";", Children(value).Select(Semantic)) + "]";
        return value is IFormattable number ? number.ToString(null, CultureInfo.InvariantCulture) : value?.ToString() ?? "null";
    }
    private static Ticket Ticket(int serial = 17) => Api.NewTicket(serial, "native\0🙂");
    private static Bundle Bundle()
    {
        var first = Ticket(); var second = Ticket(23);
        return new(first, Option<Ticket>.Some(second), new[] { first, second }, new[] { second }, new Payload(-(BigInteger.One << 180), new byte[] { 0, 127, 128, 255 }));
    }
    private static Tree Tree(int depth = 30)
    {
        Tree result = new TreeLeaf(Ticket());
        for (int index = 0; index < depth; index++) result = new TreeBranch(new[] { result });
        return result;
    }
    private static Chain Chain(int depth = 30)
    {
        Chain result = new ChainStop();
        for (int index = 0; index < depth; index++) result = new ChainLink(Ticket(index), Option<Chain>.Some(result));
        return result;
    }
    private static Mixed Mixed(bool error)
    {
        var ticket = Ticket();
        return new(ticket, new[] { Option<Option<bool>>.None, Option<Option<bool>>.Some(Option<bool>.None), Option<Option<bool>>.Some(Option<bool>.Some(false)), Option<Option<bool>>.Some(Option<bool>.Some(true)) },
            Option<Unit>.Some(default), error ? Result<Bundle, Ticket>.Err(Ticket(31)) : Result<Bundle, Ticket>.Ok(Bundle()),
            -(BigInteger.One << 180), BigInteger.One << 200, new Rune(0x1f642), -0.0, float.PositiveInfinity,
            new byte[] { 0, 127, 128, 255 }, new[] { 0ul, ulong.MaxValue },
            (ticket, (Option<Ticket>.Some(Ticket(32)), new Payload(-2, new byte[] { 4 }))), Chain(3));
    }
    private static void RoundTrip<T>(Func<T> make, Func<T, T> call)
    {
        var input = make(); var expected = Semantic(input); var resources = Resources(input);
        var result = call(input);
        Check(Semantic(result) == expected, "preserve copied fields, tags and resource payloads");
        Check(resources.All(Closed), "all represented input leases consumed");
        Drop(input); Drop(result);
    }
    private static void Values()
    {
        var ticket = Ticket(); var alias = ticket; var kept = ticket.Retain();
        var received = Api.RetainTicket(ticket);
        Check(alias.IsClosed && Api.Serial(received) == 17 && Api.Serial(kept) == 17, "shared aliases and independent retain");
        Reject<LeanBridgeException>(() => Api.Serial(alias), 4); Drop(new[] { ticket, alias, kept, received });
        var bundle = Api.EchoRecord(Bundle()); kept = bundle.Spare.Value.Retain();
        received = Api.RetainTicket(bundle.Primary);
        Check(Resources(bundle).All(Closed) && Api.Serial(kept) == 23, "whole result owner consumed by one leaf");
        Drop(bundle); kept.Dispose(); received.Dispose();
        RoundTrip(() => new[] { Ticket(), Ticket(2) }, Api.EchoArray);
        RoundTrip(() => Array.Empty<Ticket>(), Api.EchoArray);
        RoundTrip(() => new[] { Ticket(), Ticket(2) }, Api.EchoList);
        RoundTrip(() => Array.Empty<Ticket>(), Api.EchoList);
        RoundTrip(() => Option<Ticket>.Some(Ticket()), Api.EchoOption);
        RoundTrip(() => Option<Ticket>.None, Api.EchoOption);
        RoundTrip(() => Result<Bundle, Ticket>.Ok(Bundle()), Api.EchoResult);
        RoundTrip(() => Result<Bundle, Ticket>.Err(Ticket()), Api.EchoResult);
        RoundTrip(() => (Ticket(), (Option<Ticket>.Some(Ticket(2)), new Payload(-1, new byte[] { 5 }))), Api.EchoTuple);
        RoundTrip(Bundle, Api.EchoRecord); RoundTrip(Bundle, Api.EchoAlias);
        foreach (Func<Choice> make in new Func<Choice>[] { () => new ChoiceEmpty(), () => new ChoiceOne(Ticket()), () => new ChoicePair(Ticket(), Ticket(2)), () => new ChoiceMany(new[] { Ticket(), Ticket(2) }), () => new ChoiceMany(Array.Empty<Ticket>()) })
            RoundTrip(make, Api.EchoVariant);
        RoundTrip(() => new[] { Option<Ticket>.None, Option<Ticket>.Some(Ticket()), Option<Ticket>.None }, Api.EchoRow);
        RoundTrip(() => Tree(), Api.EchoRecursive);
        RoundTrip<Tree>(() => new TreeBranch(Array.Empty<Tree>()), Api.EchoRecursive);
        RoundTrip(() => new[] { Array.Empty<Option<Result<Bundle, Ticket>>>(), new[] { Option<Result<Bundle, Ticket>>.None, Option<Result<Bundle, Ticket>>.Some(Result<Bundle, Ticket>.Ok(Bundle())), Option<Result<Bundle, Ticket>>.Some(Result<Bundle, Ticket>.Err(Ticket())) } }, Api.EchoNested);
        RoundTrip(() => Chain(), Api.EchoChain);
        RoundTrip<Chain>(() => new ChainStop(), Api.EchoChain);
        RoundTrip<Chain>(() => new ChainLink(Ticket(), Option<Chain>.None), Api.EchoChain);
        RoundTrip(() => Mixed(false), Api.EchoMixed); RoundTrip(() => Mixed(true), Api.EchoMixed);
        ticket = Ticket(); var duplicate = Api.EchoArray(new[] { ticket, ticket });
        Check(ticket.IsClosed && duplicate.All(item => Api.Serial(item) == 17), "one lease repeated within one argument"); Drop(duplicate); ticket.Dispose();
        var first = Ticket(); var second = Ticket(29); var borrowed = Ticket(31);
        bundle = Api.Bundle(first, Option<Ticket>.Some(borrowed), new[] { second }, new[] { borrowed }, new Payload(5, Array.Empty<byte>()));
        Check(first.IsClosed && second.IsClosed && !borrowed.IsClosed, "only declared bundle arguments consumed");
        Check(Api.Serial(bundle.Primary) == 17 && Api.Serial(bundle.Peers[0]) == 29 && Api.Serial(borrowed) == 31, "mixed borrowed and transferred inputs");
        Drop(bundle); Drop(new[] { first, second, borrowed });
    }
    private static void Validation()
    {
        using var ticket = Ticket();
        var before = Handoffs();
        Reject<LeanBridgeException>(() => Api.Bundle(ticket, Option<Ticket>.None, new[] { ticket }, Array.Empty<Ticket>(), new Payload(0, Array.Empty<byte>())), 1);
        Check(!ticket.IsClosed && Handoffs() == before, "duplicate lease across arguments rejected before handoff");
        Reject<ArgumentNullException>(() => Api.EchoArray(new[] { ticket, null! }));
        Reject<ArgumentException>(() => Api.EchoResult(default));
        var bundle = Bundle(); Reject<ArgumentNullException>(() => Api.EchoRecord(bundle with { Payload = null! }));
        Check(Resources(bundle).All(value => !Closed(value)), "invalid fields preserve ownership"); Drop(bundle);
        var tooDeep = Tree(130); Reject<OwnedLimit>(() => Api.EchoRecursive(tooDeep));
        Check(Resources(tooDeep).All(value => !Closed(value)), "depth rejection preserves ownership"); Drop(tooDeep);
        var cyclic = new Tree[1]; cyclic[0] = new TreeBranch(cyclic);
        Reject<ArgumentException>(() => Api.EchoRecursive(cyclic[0]));
        Check(Handoffs() == before && Api.Serial(ticket) == 17, "validation cannot consume inputs");
    }
    private static void Callbacks()
    {
        var input = Bundle(); Ticket? escaped = null, retained = null;
        var received = Api.CallbackRecord(input, borrowed => {
            GC.Collect(); GC.WaitForPendingFinalizers();
            Check(Resources(input).All(Closed), "pinned owner signal survives callback GC");
            escaped = borrowed.Primary;
            Reject<LeanBridgeException>(() => Api.RetainTicket(borrowed.Primary), 1);
            using var independent = borrowed.Primary.Retain(); retained = Api.RetainTicket(independent);
            Check(independent.IsClosed && Api.Serial(retained) == 17, "retained callback borrow can transfer");
            var nested = Api.EchoRecord(Bundle()); Drop(nested);
            return borrowed;
        });
        Check(escaped!.IsClosed && Api.Serial(retained!) == 17, "callback expiry and independent returned owner");
        Drop(input); Drop(received); escaped.Dispose(); retained!.Dispose();
        input = Bundle(); var sentinel = new InvalidOperationException("same callback exception");
        var caught = Reject<InvalidOperationException>(() => Api.CallbackRecord(input, _ => throw sentinel));
        Check(ReferenceEquals(caught, sentinel) && Resources(input).All(Closed), "post-handoff error identity and consumption"); Drop(input);
        var tree = Tree(3); var echoed = Api.CallbackRecursive(tree, value => value);
        Check(Resources(tree).All(Closed), "recursive callback input consumed"); Drop(tree); Drop(echoed);
        input = Bundle(); var expected = Semantic(input); using var closure = Api.MakeRecord(input);
        Check(Resources(input).All(Closed), "closure capture consumes input"); Drop(input);
        var supplied = Bundle(); received = closure.Invoke(true, supplied);
        Check(Semantic(received) == expected && Resources(supplied).All(value => !Closed(value)), "closure invoke remains borrowed"); Drop(supplied); Drop(received);
        tree = Tree(3); using var recursive = Api.MakeRecursive(tree); Drop(tree);
        var suppliedTree = Tree(2); echoed = recursive.Invoke(true, suppliedTree); Drop(suppliedTree); Drop(echoed);
        using var identity = Api.NewRecordCallback(); using var kept = identity.Retain();
        using var moved = Api.TransferCallback(identity);
        Check(identity.IsClosed && !kept.IsClosed, "closure identity transfer");
        supplied = Bundle(); received = moved.Invoke(supplied); Check(Semantic(received) == Semantic(supplied), "transferred closure callable"); Drop(supplied); Drop(received);
    }
    private static void Faults(bool multi, bool native)
    {
        var baselineLive = Live(); var baselineIdentities = Identities(); bool finished = false;
        for (int index = 0; index < 2000; index++)
        {
            var input = Bundle(); var extra = Ticket(29); using var independent = input.Primary.Retain();
            var before = Handoffs(); object? output = null; Exception? failure = null;
            try
            {
                if (native) Fail(index); else remaining = index;
                output = multi ? Api.Bundle(input.Primary, Option<Ticket>.None, new[] { extra }, Array.Empty<Ticket>(), input.Payload)
                    : Api.CallbackRecord(input, value => value);
                finished = true;
            }
            catch (OutOfMemoryException error) when (!native) { failure = error; }
            catch (LeanBridgeException error) when (native && error.Status == 3) { failure = error; }
            finally { remaining = -1; Fail(-1); }
            var consumed = Handoffs() > before;
            Check(input.Primary.IsClosed == consumed && (!multi || extra.IsClosed == consumed), "failure follows actual native handoff");
            Check(Api.Serial(independent) == 17, "fault cannot consume independent retain");
            if (failure is not null)
            {
                retainedFailures.Add(failure);
                if (multi && native) { if (consumed) ++multiNativeAfter; else ++multiNativeBefore; }
                else if (multi) { if (consumed) ++multiManagedAfter; else ++multiManagedBefore; }
                else if (native) { if (consumed) ++nativeAfter; else ++nativeBefore; }
                else { if (consumed) ++managedAfter; else ++managedBefore; }
            }
            Drop(output); Drop(input); extra.Dispose(); independent.Dispose(); Runtime.Current.Require();
            Check(Live() == baselineLive && Identities() == baselineIdentities, $"explicit cleanup without GC {multi}/{native}/{index}");
            if (finished) break;
        }
        Check(finished, "allocation sweep completed");
    }
    private static void Threads()
    {
        using var ticket = Ticket(); Exception? wrongThread = null;
        var foreign = new Thread(() => { try { Api.RetainTicket(ticket); } catch (Exception error) { wrongThread = error; } });
        foreign.Start(); foreign.Join();
        Check(wrongThread is LeanBridgeException { Status: 5 } && !ticket.IsClosed, "foreign thread cannot consume owner");
        var baselineLive = Live(); var baselineIdentities = Identities();
        using var entered = new ManualResetEventSlim(); Exception? interruption = null;
        var thread = new Thread(() => {
            try
            {
                var input = Bundle();
                Api.CallbackRecord(input, borrowed => {
                    Check(Resources(input).All(Closed), "interrupted callback sees consumed aliases");
                    entered.Set(); Thread.Sleep(Timeout.Infinite); return borrowed;
                });
            }
            catch (Exception error) { interruption = error; }
        });
        thread.Start(); Check(entered.Wait(10000), "callback reached interruption point");
        thread.Interrupt(); Check(thread.Join(10000), "interrupted thread exited");
        Check(interruption is ThreadInterruptedException, "interrupt returns after native cleanup");
        Check(Live() == baselineLive && Identities() == baselineIdentities, "thread-exit transfer cleanup");
    }
    private static void Main(string[] args)
    {
        var library = NativeLibrary.Load(args[0]); OwnedLoader.Bindings = new OwnedBindings(library);
        Live = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, "probe_live");
        Identities = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, "probe_identities");
        Handoffs = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, "probe_handoffs");
        Fail = (delegate* unmanaged[Cdecl]<nint, void>)NativeLibrary.GetExport(library, "probe_fail");
        Runtime.Current.Require(); Values(); Validation(); Callbacks();
        Faults(false, false); Faults(false, true); Faults(true, false); Faults(true, true); Threads();
        Runtime.Current.Require(); Runtime.Current.Dispose();
        Check(Live() == 0 && Identities() == 0, "all transfer owners explicitly released");
        GC.KeepAlive(retainedFailures);
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { checks, managedBefore, managedAfter, nativeBefore, nativeAfter, multiManagedBefore, multiManagedAfter, multiNativeBefore, multiNativeAfter, live = (ulong)Live(), identities = (ulong)Identities() }));
    }
}
