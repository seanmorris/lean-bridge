using System;
using System.Numerics;
using System.Text;
using LeanBridge.OwnedAggregates;
using System.Collections.Generic;
using System.Threading;
using static LeanBridge.OwnedAggregates.Api;

internal static class InstalledCompositions
{
    private static int checks, boundedInvocations;
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
            switch (value)
            {
                case IDisposable owned: owned.Dispose(); break;
                case Bundle bundle:
                    pending.Push(bundle.Primary); pending.Push(bundle.Spare);
                    pending.Push(bundle.Peers); pending.Push(bundle.History); break;
                case Option<Ticket> option when option.IsSome: pending.Push(option.Value); break;
                case Option<Chain> option when option.IsSome: pending.Push(option.Value); break;
                case Option<Result<Bundle, Ticket>> option when option.IsSome: pending.Push(option.Value); break;
                case Result<Bundle, Ticket> result:
                    pending.Push(result.IsOk ? (object)result.Value : result.Error); break;
                case ValueTuple<Ticket, ValueTuple<Option<Ticket>, Payload>> tuple:
                    pending.Push(tuple.Item1); pending.Push(tuple.Item2.Item1); break;
                case TreeLeaf leaf: pending.Push(leaf.Ticket); break;
                case TreeBranch branch: pending.Push(branch.Children); break;
                case ChainLink link: pending.Push(link.Ticket); pending.Push(link.Next); break;
                case ChoiceOne one: pending.Push(one.Ticket); break;
                case ChoicePair pair: pending.Push(pair.First); pending.Push(pair.Second); break;
                case ChoiceMany many: pending.Push(many.Tickets); break;
                case Mixed mixed:
                    pending.Push(mixed.Ticket); pending.Push(mixed.Result);
                    pending.Push(mixed.Product); pending.Push(mixed.Chain); break;
                case Array array when value is not byte[]:
                    foreach (var element in array) pending.Push(element); break;
            }
        }
    }

    private static void Same(Ticket ticket, BigInteger serial)
    { Check(Serial(ticket) == serial, "resource identity payload"); }
    private static void Compositions()
    {
        var huge = (BigInteger.One << 200) + 37;
        using var ticket = NewTicket(huge, "C#\0🌱");
        Check(Label(ticket) == "C#\0🌱", "resource UTF8 label");
        var payload = new Payload(-huge, new byte[] { 0, 255, 1 });
        var bundle = new Bundle(ticket, Option<Ticket>.Some(ticket), new[] { ticket, ticket }, new[] { ticket }, payload);
        Check(bundle == bundle with { Peers = new[] { ticket, ticket }, Payload = payload with { Bytes = new byte[] { 0, 255, 1 } } }, "structural values with shared resource wrappers");
        var copied = EchoRecord(bundle);
        Same(copied.Primary, huge); Same(copied.Spare.Value, huge);
        Check(copied.Payload == payload && copied.Peers.Length == 2 && copied.History.Length == 1, "record children");
        copied.Primary.Dispose(); Same(copied.Peers[1], huge); Drop(copied);
        var alias = EchoAlias(bundle); Same(alias.Primary, huge); Drop(alias);
        var array = EchoArray(new[] { ticket, ticket }); Check(array.Length == 2, "array"); Drop(array);
        var list = EchoList(new[] { ticket }); Same(list[0], huge); Drop(list);
        Check(EchoOption(Option<Ticket>.None).IsNone, "none");
        var option = EchoOption(Option<Ticket>.Some(ticket)); Same(option.Value, huge); Drop(option);
        var row = EchoRow(new[] { Option<Ticket>.None, Option<Ticket>.Some(ticket) }); Check(row[0].IsNone, "alias row none"); Same(row[1].Value, huge); Drop(row);
        var product = EchoTuple((ticket, (Option<Ticket>.Some(ticket), payload))); Same(product.Item1, huge); Check(product.Item2.Item2 == payload, "nested product"); Drop(product);
        foreach (var result in new[] { Result<Bundle, Ticket>.Ok(bundle), Result<Bundle, Ticket>.Err(ticket) })
        {
            var echoed = EchoResult(result); Check(echoed.IsOk == result.IsOk, "result branches"); Drop(echoed);
        }
        foreach (Choice value in new Choice[] { new ChoiceEmpty(), new ChoiceOne(ticket), new ChoicePair(ticket, ticket), new ChoiceMany(new[] { ticket, ticket }) })
        {
            var echoed = EchoVariant(value); Check(echoed.GetType() == value.GetType(), "all variant constructors"); Drop(echoed);
        }
        var tree = new TreeBranch(new Tree[] { new TreeLeaf(ticket), new TreeBranch(new Tree[] { new TreeLeaf(ticket) }) });
        var copiedTree = EchoRecursive(tree); Check(copiedTree is TreeBranch { Children.Length: 2 }, "recursive array edge"); Drop(copiedTree);
        Chain chain = new ChainStop();
        for (int i = 0; i < 40; i++) chain = new ChainLink(ticket, Option<Chain>.Some(chain));
        var copiedChain = EchoChain(chain); Check(copiedChain is ChainLink, "boxed nominal recursion"); Drop(copiedChain);
        var nested = new[] { new[] { Option<Result<Bundle, Ticket>>.None, Option<Result<Bundle, Ticket>>.Some(Result<Bundle, Ticket>.Ok(bundle)), Option<Result<Bundle, Ticket>>.Some(Result<Bundle, Ticket>.Err(ticket)) } };
        var copiedNested = EchoNested(nested); Check(copiedNested[0].Length == 3, "nested array/list/option/result"); Drop(copiedNested);
        var mixed = new Mixed(ticket, new[] { Option<Option<bool>>.None, Option<Option<bool>>.Some(Option<bool>.None), Option<Option<bool>>.Some(Option<bool>.Some(false)) },
            Option<Unit>.Some(default), Result<Bundle, Ticket>.Ok(bundle), -huge, huge, new Rune(0x1f331), -0.0, 1.5f,
            new byte[] { 0, 255 }, new[] { 0ul, ulong.MaxValue }, (ticket, (Option<Ticket>.Some(ticket), payload)), new ChainLink(ticket, Option<Chain>.Some(new ChainStop())));
        var copiedMixed = EchoMixed(mixed); Check(copiedMixed.Markers[2].Value.Value == false && copiedMixed.Signed == -huge, "mixed copied and owned branches"); Drop(copiedMixed);
        using (var closure = MakeRecord(bundle))
        using (var kept = closure.Retain())
        {
            closure.Dispose(); var value = kept.Invoke(true, bundle); Same(value.Primary, huge); Drop(value);
            var supplied = kept.AsCallback(false, bundle); Same(supplied.Primary, huge); Drop(supplied);
        }
        using (var recursive = MakeRecursive(tree)) { var value = recursive.Invoke(true, tree); Check(value is TreeBranch, "returned recursive closure"); Drop(value); }
        var cycles = new Tree[1]; cycles[0] = new TreeBranch(cycles);
        Reject<ArgumentException>(() => EchoRecursive(cycles[0]));
        Reject<ArgumentException>(() => cycles[0].GetHashCode());
        Reject<ArgumentException>(() => EchoResult(default));
        Reject<ArgumentNullException>(() => EchoRecord(bundle with { Payload = null! }));
        Chain tooDeep = new ChainStop(); for (int i = 0; i < 130; i++) tooDeep = new ChainLink(ticket, Option<Chain>.Some(tooDeep));
        Reject<ArgumentException>(() => EchoChain(tooDeep));
        var independent = ticket.Retain(); ticket.Dispose(); Same(independent, huge);
        Reject<LeanBridgeException>(() => EchoRecord(bundle)); independent.Dispose();
    }
    private static Bundle Bundle(Ticket ticket) => new(ticket, Option<Ticket>.Some(ticket), new[] { ticket }, new[] { ticket }, new Payload(-7, new byte[] { 0, 255, 1 }));
    private static void Same(Bundle value, BigInteger serial)
    {
        Check(Api.Serial(value.Primary) == serial, "callback resource payload");
        Check(value.Payload.Count == -7, "callback copied payload"); Drop(value);
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
    }
    private static void Lifetimes()
    {
        var held = new List<Ticket>(); var threads = new List<Thread>();
        for (int i = 0; i < 12; i++)
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
        foreach (var ticket in held) Check(ticket.IsClosed, "held interrupted wrapper closed");
        using var victim = Api.NewTicket(29, "cross-thread disposal");
        var disposer = new Thread(victim.Dispose); disposer.Start(); disposer.Join();
        Check(victim.IsClosed, "cross-thread Dispose marks owner closed");
        Reject<LeanBridgeException>(() => Api.Serial(victim), 4);
        using var valid = Api.NewTicket(31, "still usable");
        Check(Api.Serial(valid) == 31, "creator drains cross-thread disposal");
        GC.KeepAlive(threads); GC.KeepAlive(held);
    }
    public static int Run()
    {
        checks = 0; boundedInvocations = 0;
        Compositions(); Callbacks(); Lifetimes();
        Check(boundedInvocations > 1 && boundedInvocations < 10000, "aggregate callback budget enforced");
        return checks;
    }
}
