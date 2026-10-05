using System;
using System.Numerics;
using System.Runtime.InteropServices;
using System.Text;
using LeanBridge.Recursive;
using LeanBridge.Recursive.Interop;

internal static unsafe class Program
{
    private static int checks;
    private static void Check(bool value) { checks++; if (!value) throw new Exception("Check " + checks); }
    private static T Throws<T>(Action action) where T : Exception
    {
        checks++;
        try { action(); } catch (T error) { return error; }
        throw new Exception("Expected " + typeof(T).Name + " at check " + checks);
    }
    private static Scalars Scalars() => new(default, true, byte.MaxValue, ushort.MaxValue, uint.MaxValue, ulong.MaxValue,
        sbyte.MinValue, short.MinValue, int.MinValue, long.MinValue, (BigInteger.One << 1000) + 7, -((BigInteger.One << 1000) + 7),
        float.PositiveInfinity, -0.0, "a\0\U0001f33f", new byte[] { 0, 255, 128 }, new Rune(0x1f33f), ulong.MaxValue, long.MinValue);
    private static Tree Tree() => new TreeBranch(new Tree[] { new TreeLeaf(Scalars()), new TreeBranch(Array.Empty<Tree>()) });
    private static Envelope Envelope() => new(Tree(), new[] { new[] { Tree(), Tree() }, Array.Empty<Tree>() }, Option<Tree>.Some(Tree()),
        Result<(Tree, Tree), string>.Ok((Tree(), Tree())), Option<Option<Unit>>.Some(Option<Unit>.None));
    private static void Clean() { Check(GraphFaults.Live == 0); Check(GraphFaults.Allocations == GraphFaults.Frees); Check(GraphProbe.Count("live") == 0); }
    private static void Reset(uint mode = 0, int fail = 0) { Clean(); GraphProbe.Reset(mode); GraphFaults.Reset(fail); }
    private static void Reject(Action action)
    {
        Reset(); Throws<ArgumentException>(action); Clean();
        Check(GraphFaults.Allocations == 0); Check(GraphProbe.Count("calls") == 0); Check(GraphProbe.Count("initialized") == 0);
    }

    private static void Main(string[] args)
    {
        GraphProbe.Handle = NativeLibrary.Load(args[0]);
        var expected = GraphProbe.Layout();
        var count = ((delegate* unmanaged[Cdecl]<nuint>)GraphProbe.Symbol("layout_count"))();
        Check(count == (nuint)expected.Length);
        for (nuint i = 0; i < count; i++) Check(expected[i] == ((delegate* unmanaged[Cdecl]<nuint, nuint>)GraphProbe.Symbol("layout"))(i));
        Reset(); var scalars = GraphProbe.Scalars(Scalars()); Check(scalars == Scalars()); Clean();
        Check(BitConverter.DoubleToInt64Bits(scalars.F64) == long.MinValue);
        Check(GraphProbe.Count("clears") == 1); Check(GraphProbe.Count("initialized") == 1);
        Reset(); var tree = Tree(); var copied = GraphProbe.Tree(tree); Check(tree == copied); Clean();
        Check(!ReferenceEquals(tree, copied));
        var originalLeaf = (TreeLeaf)((TreeBranch)tree).Children[0];
        var copiedLeaf = (TreeLeaf)((TreeBranch)copied).Children[0];
        originalLeaf.Payload.Bytes[0] = 17; Check(copiedLeaf.Payload.Bytes[0] == 0);
        Reset(); var envelope = Envelope(); var output = GraphProbe.Envelope(envelope); Check(output == envelope); Clean();
        Check(!ReferenceEquals(output.Alternatives, envelope.Alternatives));
        int checkpoints = GraphFaults.Hits;
        Reset(); Check(GraphProbe.Marker(new MarkerEmpty()) == new MarkerEmpty()); Clean();
        Reset(); Check(GraphProbe.Marker(new MarkerUnit(default)) == new MarkerUnit(default)); Clean();
        Reset(); Check(GraphProbe.Marker(new MarkerNext(new MarkerUnit(default))) == new MarkerNext(new MarkerUnit(default))); Clean();
        Reset(); var link = new Link(Option<Link>.Some(new Link(Option<Link>.None))); Check(GraphProbe.EchoLink(link) == link); Clean();
        Reset(); var resultLink = new ResultLink(Result<ResultLink, string>.Ok(new ResultLink(Result<ResultLink, string>.Err("done\0"))));
        Check(GraphProbe.EchoResultLink(resultLink) == resultLink); Clean();
        Reset(); var left = new LeftTreeNext(new RightTreeMany(new LeftTree[] { new LeftTreeLeaf(41) })); Check(GraphProbe.Left(left) == left); Clean();

        Reject(() => GraphProbe.Scalars(Scalars() with { Natural = -1 }));
        Reject(() => GraphProbe.Scalars(Scalars() with { Text = "\ud800" }));
        Reject(() => GraphProbe.Scalars(Scalars() with { Text = null! }));
        Reject(() => GraphProbe.Scalars(Scalars() with { Bytes = null! }));
        Reject(() => GraphProbe.Tree(null!));
        Reject(() => GraphProbe.Tree(new TreeBranch(null!)));
        Reject(() => GraphProbe.Tree(new TreeBranch(new Tree[] { null! })));
        Reject(() => GraphProbe.Tree(new TreeLeaf(null!)));
        Reject(() => GraphProbe.Envelope(Envelope() with { Outcome = default }));
        Reject(() => GraphProbe.Envelope(Envelope() with { Fallback = Option<Tree>.Some(null!) }));
        Reject(() => GraphProbe.Envelope(Envelope() with { Outcome = Result<(Tree, Tree), string>.Err(null!) }));
        var cyclic = new TreeBranch(new Tree[1]); cyclic.Children[0] = cyclic; Reject(() => GraphProbe.Tree(cyclic));
        Spine deep = new SpineLeaf(7);
        for (int i = 0; i < 129; i++) deep = new SpineNext(deep);
        Reject(() => GraphProbe.Spine(deep));
        Reject(() => GraphProbe.Tree(new TreeBranch(new Tree[262144])));
        Reject(() => GraphProbe.Scalars(Scalars() with { Bytes = new byte[16 * 1024 * 1024] }));

        int inputFailures = 0, outputFailures = 0;
        for (int fail = 1; fail <= checkpoints; fail++)
        {
            Reset(0, fail); Throws<OutOfMemoryException>(() => GraphProbe.Envelope(envelope)); Clean();
            uint calls = GraphProbe.Count("calls"); Check(calls <= 1); Check(GraphProbe.Count("clears") == calls);
            if (calls == 0) inputFailures++; else outputFailures++;
            Check(GraphProbe.Count("retired") == 0);
            Reset(); Check(GraphProbe.Envelope(envelope) == envelope); Clean();
        }
        foreach (uint mode in new uint[] { 2, 3, 4, 5, 6, 7, 8, 104, 106 })
        {
            Reset(mode); Check(Throws<LeanBridgeException>(() => GraphProbe.Scalars(Scalars())).Status == 4); Clean();
            Check(GraphProbe.Count("clears") == 1); Check(GraphProbe.Count("retired") == 1);
        }
        Reset(9); Throws<ArgumentException>(() => GraphProbe.Scalars(Scalars())); Clean(); Check(GraphProbe.Count("retired") == 0);
        foreach (uint mode in new uint[] { 12, 13 })
        {
            Reset(mode); Check(Throws<LeanBridgeException>(() => GraphProbe.Envelope(envelope)).Status == 4); Clean();
            Check(GraphProbe.Count("clears") == 1); Check(GraphProbe.Count("retired") == 1);
        }
        Reset(101); Throws<ArgumentException>(() => GraphProbe.Scalars(Scalars())); Clean(); Check(GraphProbe.Count("retired") == 0);
        Reset(102); Throws<ArgumentException>(() => GraphProbe.Scalars(Scalars())); Clean(); Check(GraphProbe.Count("retired") == 0);
        Reset(103); Throws<OutOfMemoryException>(() => GraphProbe.Scalars(Scalars())); Clean(); Check(GraphProbe.Count("retired") == 0);
        Reset(105); Check(Throws<LeanBridgeException>(() => GraphProbe.Scalars(Scalars())).Status == 5); Clean();
        Reset(); GraphFaults.During = () => { if (GraphProbe.Count("calls") > 0) GraphProbe.Retire(); };
        Check(Throws<LeanBridgeException>(() => GraphProbe.Envelope(envelope)).Status == 5); Clean(); Check(GraphProbe.Count("clears") == 1);
        Reset(); Check(GraphProbe.Tree(Tree()) == Tree()); Clean();
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { checks, checkpoints, inputFailures, outputFailures,
            layoutChecks = expected.Length, compiledLean = false, live = GraphFaults.Live }));
    }
}
