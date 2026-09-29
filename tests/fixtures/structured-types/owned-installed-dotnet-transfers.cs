using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Numerics;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading;
using LeanBridge.OwnedAggregates;

internal static class Program
{
    private static int checks;
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
        Bundle bundle => new object?[] { bundle.Primary, bundle.Spare, bundle.Peers, bundle.History, bundle.Payload },
        Payload payload => new object?[] { payload.Count, payload.Bytes },
        Option<Ticket> option when option.IsSome => new object?[] { option.Value },
        Option<Chain> option when option.IsSome => new object?[] { option.Value },
        Option<Result<Bundle, Ticket>> option when option.IsSome => new object?[] { option.Value },
        Result<Bundle, Ticket> result => new object?[] { result.IsOk ? (object)result.Value : result.Error },
        TreeLeaf leaf => new object?[] { leaf.Ticket },
        TreeBranch branch => new object?[] { branch.Children },
        ChainLink link => new object?[] { link.Ticket, link.Next },
        ChoiceOne one => new object?[] { one.Ticket },
        ChoicePair pair => new object?[] { pair.First, pair.Second },
        ChoiceMany many => new object?[] { many.Tickets },
        Mixed mixed => new object?[] { mixed.Ticket, mixed.Markers, mixed.Unit, mixed.Result, mixed.Signed,
            mixed.Unsigned, mixed.Scalar, mixed.Precise, mixed.Approximate, mixed.Bytes, mixed.Words, mixed.Product, mixed.Chain },
        Array array => array.Cast<object?>(),
        ITuple tuple => Enumerable.Range(0, tuple.Length).Select(index => tuple[index]),
        _ => Array.Empty<object?>()
    };
    private static List<Ticket> Resources(object? root)
    {
        var pending = new Stack<object?>(); pending.Push(root);
        var seen = new HashSet<object>(ReferenceEqualityComparer.Instance);
        var result = new List<Ticket>();
        while (pending.TryPop(out var value))
        {
            if (value is null || !seen.Add(value)) continue;
            if (value is Ticket ticket) result.Add(ticket);
            else foreach (var item in Children(value)) pending.Push(item);
        }
        return result;
    }
    private static void Drop(object? value) { foreach (var resource in Resources(value)) resource.Dispose(); }
    private static string OptionKey<T>(Option<T> option) => option.IsSome ? "some(" + Semantic(option.Value) + ")" : "none";
    private static string Semantic(object? value) => value switch
    {
        Ticket ticket => "ticket:" + Api.Serial(ticket).ToString(CultureInfo.InvariantCulture) + ":" + Api.Label(ticket),
        byte[] bytes => Convert.ToHexString(bytes),
        double precise => "f64:" + BitConverter.DoubleToInt64Bits(precise),
        float approximate => "f32:" + BitConverter.SingleToInt32Bits(approximate),
        Option<Ticket> option => OptionKey(option),
        Option<Chain> option => OptionKey(option),
        Option<Result<Bundle, Ticket>> option => OptionKey(option),
        Option<Unit> option => OptionKey(option),
        Option<Option<bool>> option => OptionKey(option),
        Option<bool> option => OptionKey(option),
        Result<Bundle, Ticket> result => result.IsOk ? "ok(" + Semantic(result.Value) + ")" : "err(" + Semantic(result.Error) + ")",
        Bundle { } or Payload { } or Tree { } or Chain { } or Choice { } or Mixed { } => value.GetType().Name + "[" + string.Join(";", Children(value).Select(Semantic)) + "]",
        Array or ITuple => "[" + string.Join(";", Children(value).Select(Semantic)) + "]",
        IFormattable number => number.ToString(null, CultureInfo.InvariantCulture),
        _ => value?.ToString() ?? "null"
    };
    private static Ticket Ticket(int serial = 17) => Api.NewTicket(serial, "C#\0🙂");
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
        var returned = Resources(result);
        Check(Semantic(result) == expected, "preserve copied fields, tags and resource payloads");
        Check(resources.All(resource => resource.IsClosed), "all represented input leases consumed");
        Check(returned.All(resource => !resource.IsClosed), "returned resource owners are live");
        Drop(input); Drop(result);
        Check(returned.All(resource => resource.IsClosed), "explicit disposal closes returned wrappers");
    }
    private static void Values()
    {
        var ticket = Ticket(); var alias = ticket; var kept = ticket.Retain();
        var received = Api.RetainTicket(ticket);
        Check(alias.IsClosed && Api.Serial(received) == 17 && Api.Serial(kept) == 17, "shared aliases and independent retain");
        Reject<LeanBridgeException>(() => Api.Serial(alias), 4); Drop(new[] { ticket, alias, kept, received });
        var huge = (BigInteger.One << 200) + 37;
        using (var original = Api.NewTicket(huge, "huge\0🌱"))
        using (var moved = Api.RetainTicket(original))
            Check(original.IsClosed && Api.Serial(moved) == huge && Api.Label(moved) == "huge\0🌱", "big integer and Unicode payload");
        var bundle = Api.EchoRecord(Bundle()); kept = bundle.Spare.Value.Retain();
        received = Api.RetainTicket(bundle.Primary);
        Check(Resources(bundle).All(resource => resource.IsClosed) && Api.Serial(kept) == 23, "whole result owner consumed by one leaf");
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
        RoundTrip(() => Mixed(false) with { Markers = Array.Empty<Option<Option<bool>>>(), Unit = Option<Unit>.None, Precise = double.NegativeInfinity, Approximate = -0.0f }, Api.EchoMixed);
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
        Reject<LeanBridgeException>(() => Api.Bundle(ticket, Option<Ticket>.None, new[] { ticket }, Array.Empty<Ticket>(), new Payload(0, Array.Empty<byte>())), 1);
        Check(!ticket.IsClosed, "duplicate lease across arguments rejected before handoff");
        Reject<ArgumentNullException>(() => Api.EchoArray(new[] { ticket, null! }));
        Reject<ArgumentException>(() => Api.EchoResult(default));
        var bundle = Bundle(); Reject<ArgumentNullException>(() => Api.EchoRecord(bundle with { Payload = null! }));
        Check(Resources(bundle).All(resource => !resource.IsClosed), "invalid fields preserve ownership");
        Reject<ArgumentException>(() => Api.EchoRecord(bundle with { Payload = new Payload(0, new byte[17 * 1024 * 1024]) }));
        Check(Resources(bundle).All(resource => !resource.IsClosed), "allocation limit preserves ownership"); Drop(bundle);
        var tooDeep = Tree(130); Reject<ArgumentException>(() => Api.EchoRecursive(tooDeep));
        Check(Resources(tooDeep).All(resource => !resource.IsClosed), "depth rejection preserves ownership"); Drop(tooDeep);
        var cyclic = new Tree[1]; cyclic[0] = new TreeBranch(cyclic);
        Reject<ArgumentException>(() => Api.EchoRecursive(cyclic[0]));
        Check(Api.Serial(ticket) == 17, "validation cannot consume inputs");
    }
    private static void Callbacks()
    {
        var input = Bundle(); Ticket? escaped = null, retained = null;
        var received = Api.CallbackRecord(input, borrowed => {
            GC.Collect(); GC.WaitForPendingFinalizers();
            Check(Resources(input).All(resource => resource.IsClosed), "handoff precedes callback and survives GC");
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
        Check(ReferenceEquals(caught, sentinel) && Resources(input).All(resource => resource.IsClosed), "post-handoff error identity and consumption");
        Check(caught.StackTrace!.Contains(nameof(Callbacks)), "callback exception stack preserved"); Drop(input);
        var tree = Tree(3); var echoed = Api.CallbackRecursive(tree, value => value);
        Check(Resources(tree).All(resource => resource.IsClosed), "recursive callback input consumed"); Drop(tree); Drop(echoed);
        input = Bundle(); var expected = Semantic(input); using var closure = Api.MakeRecord(input);
        Check(Resources(input).All(resource => resource.IsClosed), "closure capture consumes input"); Drop(input);
        var supplied = Bundle(); received = closure.Invoke(true, supplied);
        Check(Semantic(received) == expected && Resources(supplied).All(resource => !resource.IsClosed), "closure invoke remains borrowed"); Drop(supplied); Drop(received);
        tree = Tree(3); using var recursive = Api.MakeRecursive(tree); Drop(tree);
        var suppliedTree = Tree(2); echoed = recursive.Invoke(true, suppliedTree); Drop(suppliedTree); Drop(echoed);
        using var identity = Api.NewRecordCallback(); using var kept = identity.Retain();
        using var moved = Api.TransferCallback(identity);
        Check(identity.IsClosed && !kept.IsClosed, "closure identity transfer");
        supplied = Bundle(); received = moved.Invoke(supplied); Check(Semantic(received) == Semantic(supplied), "transferred closure callable"); Drop(supplied); Drop(received);
    }
    private static void Threads()
    {
        using var ticket = Ticket(); Exception? wrongThread = null;
        var foreign = new Thread(() => { try { Api.RetainTicket(ticket); } catch (Exception error) { wrongThread = error; } });
        foreign.Start(); foreign.Join();
        Check(wrongThread is LeanBridgeException { Status: 5 } && !ticket.IsClosed, "foreign thread cannot consume owner");
        using var entered = new ManualResetEventSlim(); Exception? interruption = null;
        var held = new List<Ticket>();
        var thread = new Thread(() => {
            try
            {
                var input = Bundle(); held.AddRange(Resources(input));
                Api.CallbackRecord(input, borrowed => {
                    Check(Resources(input).All(resource => resource.IsClosed), "interrupted callback sees consumed aliases");
                    held.Add(borrowed.Primary); held.Add(borrowed.Primary.Retain());
                    entered.Set(); Thread.Sleep(Timeout.Infinite); return borrowed;
                });
            }
            catch (Exception error) { interruption = error; }
        }) { IsBackground = true };
        thread.Start(); Check(entered.Wait(10000), "callback reached interruption point");
        thread.Interrupt(); Check(thread.Join(10000), "interrupted thread exited");
        Check(interruption is ThreadInterruptedException, "interrupt returns after native cleanup");
        Check(held.All(resource => resource.IsClosed), "thread exit closes reachable borrowed and retained wrappers");
        foreach (var resource in held) resource.Dispose();
        GC.KeepAlive(thread);
    }
    private static void Main()
    {
        Values(); Validation(); Callbacks(); Threads();
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { checks, safePublicApi = true }));
    }
}
