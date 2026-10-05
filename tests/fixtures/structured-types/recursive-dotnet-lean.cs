using System;
using System.Numerics;
using System.Runtime.InteropServices;
using System.Text;
using LeanBridge.Recursive;

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
        sbyte.MinValue, short.MinValue, int.MinValue, long.MinValue, (BigInteger.One << 128) + 1, -((BigInteger.One << 128) + 1),
        1.5f, -2.25, "A\0\U0001f331", new byte[] { 0, 255, 1 }, new Rune(0x1f331), uint.MaxValue, int.MinValue);
    private static Tree Tree() => new TreeBranch(new Tree[] { new TreeLeaf(Scalars()), new TreeBranch(Array.Empty<Tree>()) });
    private static Envelope Envelope() => new(Tree(), new[] { Array.Empty<Tree>(), new[] { Tree() } }, Option<Tree>.Some(Tree()),
        Result<(Tree, Tree), string>.Ok((Tree(), Tree())), Option<Option<Unit>>.Some(Option<Unit>.Some(default)));
    private static void ScratchClean() { Check(GraphFaults.Live == 0); Check(GraphFaults.Allocations == GraphFaults.Frees); }
    private static void Clean() { ScratchClean(); Check(GraphProbe.Count("live") == 0); }
    private static void Reset(nuint fail = 0, int managed = 0, bool interrupted = false, int allocation = 0)
    {
        Clean(); GraphProbe.Reset(fail: fail); GraphFaults.Reset(managed, allocation, interrupted);
    }

    private static void Main(string[] args)
    {
        GraphProbe.Handle = NativeLibrary.Load(args[0]);
        var expected = GraphProbe.Layout();
        Check(((delegate* unmanaged[Cdecl]<nuint>)GraphProbe.Symbol("layout_count"))() == (nuint)expected.Length);
        for (nuint i = 0; i < (nuint)expected.Length; i++) Check(expected[i] == ((delegate* unmanaged[Cdecl]<nuint, nuint>)GraphProbe.Symbol("layout"))(i));
        Reset(); Check(GraphProbe.Count("ready") == 0);
        Spine excessive = new SpineLeaf(0);
        for (int i = 0; i < 128; i++) excessive = new SpineNext(excessive);
        Throws<ArgumentException>(() => GraphProbe.Spine(excessive));
        Throws<ArgumentException>(() => GraphProbe.JoinTrees(Tree(), new TreeLeaf(Scalars() with { Natural = -1 })));
        Check(GraphProbe.Count("ready") == 0); Check(GraphProbe.Count("decodes") == 0); Check(GraphFaults.Attempts == 0); Clean();

        var scalars = Scalars(); Check(GraphProbe.Inspect(scalars)); // Lean checks all nineteen fields independently.
        Check(GraphProbe.Scalars(scalars) == scalars);
        Check(GraphProbe.WordMax(ulong.MaxValue)); Check(!GraphProbe.WordMax(0));
        Check(GraphProbe.SignedMin(long.MinValue)); Check(!GraphProbe.SignedMin(0));
        foreach (var value in new[] {
            scalars with { Natural = (BigInteger.One << 1000) + 7, Integer = -((BigInteger.One << 1000) + 7) },
            scalars with { Natural = 0, Integer = 0, Text = "", Bytes = Array.Empty<byte>() },
            scalars with { F32 = float.NegativeInfinity, F64 = double.PositiveInfinity } })
            Check(GraphProbe.Scalars(value) == value);
        var special = GraphProbe.Scalars(scalars with { F32 = float.NaN, F64 = -0.0 });
        Check(float.IsNaN(special.F32)); Check(BitConverter.DoubleToInt64Bits(special.F64) == long.MinValue); Clean();

        var tree = Tree(); Check(GraphProbe.Tree(tree) == tree);
        Check(GraphProbe.Empty() == new TreeBranch(Array.Empty<Tree>()));
        Check(GraphProbe.JoinTrees(tree, tree) == new TreeBranch(new[] { tree, tree }));
        var forest = new Tree[512]; Array.Fill(forest, tree);
        var copiedForest = GraphProbe.Forest(forest);
        Check(copiedForest.Length == forest.Length);
        for (int i = 0; i < forest.Length; i++) Check(copiedForest[i] == tree && !ReferenceEquals(copiedForest[i], tree));
        var input = new TreeBranch(new Tree[] { new TreeLeaf(Scalars()) });
        var copied = (TreeBranch)GraphProbe.Tree(input);
        ((TreeLeaf)input.Children[0]).Payload.Bytes[0] = 17;
        Check(((TreeLeaf)copied.Children[0]).Payload.Bytes[0] == 0);
        input.Children[0] = new TreeBranch(Array.Empty<Tree>()); Check(copied.Children[0] is TreeLeaf);
        var envelope = Envelope();
        foreach (var marker in new[] { Option<Option<Unit>>.None, Option<Option<Unit>>.Some(Option<Unit>.None), Option<Option<Unit>>.Some(Option<Unit>.Some(default)) })
        foreach (var outcome in new[] { Result<(Tree, Tree), string>.Ok((tree, tree)), Result<(Tree, Tree), string>.Err("error\0\U0001f331") })
        {
            var value = envelope with { Marker = marker, Outcome = outcome, Fallback = Option<Tree>.None };
            Check(GraphProbe.Envelope(value) == value);
        }
        var left = new LeftTreeNext(new RightTreeMany(new LeftTree[] { new LeftTreeLeaf(9) }));
        Check(GraphProbe.Left(left) == left);
        var right = new RightTreeMany(new LeftTree[] { left }); Check(GraphProbe.Right(right) == right);
        Spine spine = new SpineLeaf(41);
        for (int i = 0; i < 127; i++) spine = new SpineNext(spine);
        var a = spine; var b = GraphProbe.Spine(spine);
        for (int i = 0; i < 127; i++) { Check(!ReferenceEquals(a, b)); a = ((SpineNext)a).Value; b = ((SpineNext)b).Value; }
        Check(((SpineLeaf)a).Value == 41 && ((SpineLeaf)b).Value == 41);
        Throws<ArgumentException>(() => GraphProbe.Grow(spine));
        Check(GraphProbe.Grow(new SpineLeaf(7)) == new SpineNext(new SpineLeaf(7)));
        Wide wide = new WideLeaf(17);
        for (int i = 0; i < 127; i++) wide = new WideNext(WIDE_ARGUMENTS, wide);
        var wideCopy = GraphProbe.Wide(wide); Check(wideCopy == wide);
        Check(!ReferenceEquals(wide, wideCopy));
        foreach (var value in new Marker[] { new MarkerEmpty(), new MarkerUnit(default), new MarkerNext(new MarkerEmpty()) })
            Check(GraphProbe.Marker(value) == value);
        Check(GraphProbe.EmptyRecord(new EmptyRecord()) == new EmptyRecord());
        Check(GraphProbe.Units(new Unit[123]).Length == 123);
        Throws<ArgumentException>(() => GraphProbe.Never(null!)); Clean();

        Reset(); Check(GraphProbe.Envelope(envelope) == envelope);
        uint nativeCheckpoints = GraphProbe.Count("attempts");
        int managedCheckpoints = GraphFaults.Hits, allocationCheckpoints = GraphFaults.Attempts;
        Clean();
        for (uint fail = 1; fail <= nativeCheckpoints; fail++)
        {
            Reset(fail: fail); Throws<OutOfMemoryException>(() => GraphProbe.Envelope(envelope)); Clean();
            Check(GraphProbe.Count("ready") == 1);
        }
        int inputFailures = 0, outputFailures = 0;
        for (int fail = 1; fail <= managedCheckpoints; fail++)
        foreach (bool interrupted in new[] { false, true })
        {
            Reset(managed: fail, interrupted: interrupted);
            if (interrupted) Throws<OperationCanceledException>(() => GraphProbe.Envelope(envelope));
            else
            {
                Throws<OutOfMemoryException>(() => GraphProbe.Envelope(envelope));
                if (GraphProbe.Count("decodes") == 0) inputFailures++; else outputFailures++;
            }
            Clean(); Check(GraphProbe.Count("ready") == 1);
        }
        for (int fail = 1; fail <= allocationCheckpoints; fail++)
        {
            Reset(allocation: fail); Throws<OutOfMemoryException>(() => GraphProbe.Envelope(envelope)); Clean();
            Check(GraphProbe.Count("decodes") == 0); Check(GraphProbe.Count("ready") == 1);
        }
        Check(inputFailures > 0 && outputFailures > 0);
        Reset(); Check(GraphProbe.Envelope(envelope) == envelope); Clean();

        Check(GraphProbe.Count("hold") == 0); uint retained = GraphProbe.Count("live"); Check(retained > 0);
        string mode = args[1];
        if (mode == "carrier") GraphProbe.Reset(bad: 1);
        else if (mode == "raw") GraphProbe.Reset(mode: 1);
        else if (mode == "cycle") GraphProbe.Reset(mode: 2);
        else if (mode == "during")
        {
            GraphProbe.Reset();
            GraphFaults.During = () => { if (GraphProbe.Count("decodes") > 0) GraphProbe.Retire(); };
        }
        else throw new Exception("Unknown retirement scenario");
        Check(Throws<LeanBridgeException>(() => GraphProbe.Tree(tree)).Status == (mode == "during" ? 5 : 4));
        Check(GraphProbe.Count("ready") == 0); Check(GraphProbe.Count("live") == retained); ScratchClean();
        GraphProbe.Reset(); GraphFaults.Reset();
        Check(Throws<LeanBridgeException>(() => GraphProbe.Envelope(envelope)).Status == 5);
        Check(GraphProbe.Count("decodes") == 0); Check(GraphProbe.Count("live") == retained); ScratchClean();
        GraphProbe.Release(); GraphProbe.Release(); GraphProbe.Detach(); Clean();
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { checks, nativeCheckpoints, managedCheckpoints,
            allocationCheckpoints, inputFailures, outputFailures, layoutChecks = expected.Length, compiledLean = true, live = GraphFaults.Live }));
    }
}
