using System;
using System.Numerics;
using System.Text;
using System.Threading.Tasks;
using LeanBridge.Recursive;

internal static class Program
{
    private static int checks;
    private static void Check(bool value) { checks++; if (!value) throw new Exception("Check " + checks); }
    private static void Reject(Action action)
    {
        checks++;
        try { action(); } catch (ArgumentException) { return; }
        throw new Exception("Expected rejected value at check " + checks);
    }
    private static Scalars Scalars() => new(default, true, byte.MaxValue, ushort.MaxValue, uint.MaxValue, ulong.MaxValue,
        sbyte.MinValue, short.MinValue, int.MinValue, long.MinValue, (BigInteger.One << 128) + 1, -((BigInteger.One << 128) + 1),
        1.5f, -2.25, "A\0\U0001f331", new byte[] { 0, 255, 1 }, new Rune(0x1f331), uint.MaxValue, int.MinValue);
    private static Tree Tree() => new TreeBranch(new Tree[] { new TreeLeaf(Scalars()), new TreeBranch(Array.Empty<Tree>()) });

    private static void Main(string[] args)
    {
        // This executable has no unsafe code or native interop. All calls use
        // the public API of the exact installed NuGet archive.
        Reject(() => Api.Tree(null!));
        Reject(() => Api.JoinTrees(Tree(), new TreeLeaf(Scalars() with { Natural = -1 })));
        if (args.Length > 0 && args[0] == "tamper")
        {
            try { Api.Empty(); }
            catch (InvalidOperationException error) when (error.Message.Contains("differs from the compiled package"))
            { Console.WriteLine("tamper-rejected-before-call"); return; }
            throw new Exception("Tampered native asset loaded");
        }
        var scalars = Scalars(); Check(Api.Inspect(scalars));
        Check(Api.Scalars(scalars) == scalars);
        Check(Api.WordMax(ulong.MaxValue)); Check(!Api.WordMax(0));
        Check(Api.SignedMin(long.MinValue)); Check(!Api.SignedMin(0));
        foreach (var value in new[] {
            scalars with { Natural = (BigInteger.One << 1000) + 7, Integer = -((BigInteger.One << 1000) + 7) },
            scalars with { Natural = 0, Integer = 0, Text = "", Bytes = Array.Empty<byte>() },
            scalars with { F32 = float.NegativeInfinity, F64 = double.PositiveInfinity } })
            Check(Api.Scalars(value) == value);
        var special = Api.Scalars(scalars with { F32 = float.NaN, F64 = -0.0 });
        Check(float.IsNaN(special.F32)); Check(BitConverter.DoubleToInt64Bits(special.F64) == long.MinValue);
        var tree = Tree(); Check(Api.Tree(tree) == tree);
        Check(Api.Empty() == new TreeBranch(Array.Empty<Tree>()));
        Check(Api.JoinTrees(tree, tree) == new TreeBranch(new[] { tree, tree }));
        var forest = new Tree[512]; Array.Fill(forest, tree);
        var copiedForest = Api.Forest(forest); Check(copiedForest.Length == forest.Length);
        for (int i = 0; i < forest.Length; i++) Check(copiedForest[i] == tree && !ReferenceEquals(copiedForest[i], tree));
        var input = new TreeBranch(new Tree[] { new TreeLeaf(Scalars()) });
        var copied = (TreeBranch)Api.Tree(input);
        ((TreeLeaf)input.Children[0]).Payload.Bytes[0] = 17;
        Check(((TreeLeaf)copied.Children[0]).Payload.Bytes[0] == 0);
        input.Children[0] = new TreeBranch(Array.Empty<Tree>()); Check(copied.Children[0] is TreeLeaf);
        var envelope = new Envelope(tree, new[] { Array.Empty<Tree>(), new[] { tree } }, Option<Tree>.Some(tree),
            Result<(Tree, Tree), string>.Ok((tree, tree)), Option<Option<Unit>>.None);
        foreach (var marker in new[] { Option<Option<Unit>>.None, Option<Option<Unit>>.Some(Option<Unit>.None), Option<Option<Unit>>.Some(Option<Unit>.Some(default)) })
        foreach (var outcome in new[] { Result<(Tree, Tree), string>.Ok((tree, tree)), Result<(Tree, Tree), string>.Err("error\0\U0001f331") })
        {
            var value = envelope with { Marker = marker, Outcome = outcome, Fallback = Option<Tree>.None };
            Check(Api.Envelope(value) == value);
        }
        var left = new LeftTreeNext(new RightTreeMany(new LeftTree[] { new LeftTreeLeaf(9) }));
        Check(Api.Left(left) == left);
        var right = new RightTreeMany(new LeftTree[] { left }); Check(Api.Right(right) == right);
        Spine spine = new SpineLeaf(41);
        for (int i = 0; i < 127; i++) spine = new SpineNext(spine);
        var a = spine; var b = Api.Spine(spine);
        for (int i = 0; i < 127; i++) { Check(!ReferenceEquals(a, b)); a = ((SpineNext)a).Value; b = ((SpineNext)b).Value; }
        Check(((SpineLeaf)a).Value == 41 && ((SpineLeaf)b).Value == 41);
        Reject(() => Api.Grow(spine));
        Check(Api.Grow(new SpineLeaf(7)) == new SpineNext(new SpineLeaf(7)));
        Wide wide = new WideLeaf(17);
        for (int i = 0; i < 127; i++) wide = new WideNext(WIDE_ARGUMENTS, wide);
        var wideCopy = Api.Wide(wide); Check(wideCopy == wide); Check(!ReferenceEquals(wide, wideCopy));
        foreach (var value in new Marker[] { new MarkerEmpty(), new MarkerUnit(default), new MarkerNext(new MarkerEmpty()) })
            Check(Api.Marker(value) == value);
        Check(Api.EmptyRecord(new EmptyRecord()) == new EmptyRecord());
        Check(Api.Units(new Unit[123]).Length == 123);
        Reject(() => Api.Never(null!));
        Reject(() => Api.Envelope(envelope with { Outcome = default }));
        Reject(() => Api.Scalars(scalars with { Text = "\ud800" }));
        Reject(() => Api.Scalars(scalars with { Bytes = null! }));
        var children = new Tree[1]; var cycle = new TreeBranch(children); children[0] = cycle;
        Reject(() => Api.Tree(cycle));
        Reject(() => Api.Scalars(scalars with { Bytes = new byte[16 * 1024 * 1024 + 1] }));
        Reject(() => Api.Forest(new Tree[262145]));
        Check(Api.Envelope(envelope) == envelope);
        Parallel.For(0, 256, index => {
            var value = new SpineNext(new SpineLeaf((uint)index));
            if (Api.Spine(value) != value) throw new Exception("Concurrent copied call");
        });
        Check(Api.Tree(tree) == tree);
        Console.WriteLine("recursive-dotnet-installed:" + checks + ":256");
    }
}
