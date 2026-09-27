using System;
using System.Numerics;
using System.Text;
using LeanBridge.OwnedAggregates;
using LeanBridge.OwnedAggregates.Interop;

internal static unsafe partial class Program
{
    private static void Same(Ticket ticket, BigInteger serial)
    { Check(Serial(ticket) == serial, "resource identity payload"); }
    private static void Exercise()
    {
        var huge = (BigInteger.One << 200) + 37;
        using var ticket = NewTicket(huge, "C#\0🌱"); Borrowed(ticket);
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
        Reject<OwnedLimit>(() => EchoChain(tooDeep));
        Failures(() => EchoMixed(mixed));
        Failures(() => MakeRecord(bundle));
        var independent = ticket.Retain(); ticket.Dispose(); Same(independent, huge);
        Reject<LeanBridgeException>(() => EchoRecord(bundle)); independent.Dispose();
    }
}
