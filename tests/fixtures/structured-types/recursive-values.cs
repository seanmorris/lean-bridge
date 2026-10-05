using System;
using System.Collections.Generic;
using System.Numerics;
using System.Text;
using LeanBridge.Recursive;
using Link = LeanBridge.Linked.Link;
using LinkOption = LeanBridge.Linked.Option<LeanBridge.Linked.Link>;

internal record ForgedTree : Tree
{
    internal ForgedTree(Tree original) : base(original) { }
}

internal static class Program
{
    private static int checks;
    private static int cycleRejections;
    private static void Check(bool value) { checks++; if (!value) throw new Exception("Check " + checks); }
    private static void Throws<T>(Action action) where T : Exception
    {
        checks++;
        try { action(); } catch (T) { return; }
        throw new Exception("Expected " + typeof(T).Name + " at check " + checks);
    }
    private static void Same<T>(T a, T b)
    {
        Check(EqualityComparer<T>.Default.Equals(a, b));
        Check(EqualityComparer<T>.Default.Equals(b, a));
        Check(a!.GetHashCode() == b!.GetHashCode());
        Check(new HashSet<T> { a }.Contains(b));
    }
    private static Scalars Scalars() => new(default, true, byte.MaxValue, ushort.MaxValue, uint.MaxValue, ulong.MaxValue,
        sbyte.MinValue, short.MinValue, int.MinValue, long.MinValue, BigInteger.One << 256, -(BigInteger.One << 257),
        float.NaN, -0.0, "tree\0\U0001f332", new byte[] { 0, 255, 17 }, new Rune(0x1f332), ulong.MaxValue, long.MinValue);
    private static Tree Tree() => new TreeBranch(new Tree[] { new TreeLeaf(Scalars()), new TreeBranch(Array.Empty<Tree>()) });
    private static WideNext Wide() => new(
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
        16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
        32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
        48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63,
        64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79,
        80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95,
        96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111,
        112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127,
        128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143,
        144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159,
        160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175,
        176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191,
        192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207,
        208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223,
        224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239,
        240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254,
        new WideLeaf(42));
    private static void RejectCycle(Action action) { Throws<ArgumentException>(action); cycleRejections++; }

    private static void Main()
    {
        Same(Scalars(), Scalars());
        Same(Scalars(), Scalars() with { F64 = 0.0 });
        Same(Tree(), Tree());
        Same<Tree>(new TreeBranch(new TreeLeaf[] { new(Scalars()) }), new TreeBranch(new Tree[] { new TreeLeaf(Scalars()) }));
        Check(Tree() is TreeBranch { Children: [TreeLeaf { Payload: { Word: ulong.MaxValue } }, TreeBranch { Children.Length: 0 }] });
        Check(!Equals(new TreeBranch(Array.Empty<Tree>()), new TreeLeaf(Scalars())));
        Check(!Tree().Equals(null));
        Throws<ArgumentException>(() => _ = new ForgedTree(Tree()));
        var leaf = new TreeLeaf(Scalars());
        Same(leaf, leaf with { });
        var a = new LeftTreeNext(new RightTreeMany(new LeftTree[] { new LeftTreeLeaf(41) }));
        var b = new LeftTreeNext(new RightTreeMany(new LeftTree[] { new LeftTreeLeaf(41) }));
        Same(a, b);
        Check(a is LeftTreeNext { Right: RightTreeMany { Lefts: [LeftTreeLeaf { Value: 41 }] } });
        Same(new Link(LinkOption.Some(new Link(LinkOption.None, 7)), 9), new Link(LinkOption.Some(new Link(LinkOption.None, 7)), 9));
        var nestedArray = typeof(LeanBridge.Deep.Box).GetProperty("Value")!.PropertyType;
        int arrayDepth = 0;
        while (nestedArray.IsArray) { arrayDepth++; nestedArray = nestedArray.GetElementType()!; }
        Check(arrayDepth == 32 && nestedArray == typeof(uint));
        Check(new Link(LinkOption.None, 7) != new Link(LinkOption.None, 8));
        Same(new EmptyRecord(), new EmptyRecord());
        Same(Wide(), Wide());
        Check(Wide().Child is WideLeaf { Value: 42 });
        for (int i = 0; i < 255; i++) Check((ushort)typeof(WideNext).GetProperty("Field" + i)!.GetValue(Wide())! == i);
        Same<Marker>(new MarkerEmpty(), new MarkerEmpty());
        Same<Marker>(new MarkerUnit(default), new MarkerUnit(default));
        Check(!Equals(new MarkerEmpty(), new MarkerUnit(default)));
        Same<Marker>(new MarkerNext(new MarkerUnit(default)), new MarkerNext(new MarkerUnit(default)));

        Same(Option<Unit>.None, default);
        Same(Option<Unit>.Some(default), Option<Unit>.Some(default));
        Check(Option<Unit>.None != Option<Unit>.Some(default));
        Same(Option<Option<Unit>>.Some(Option<Unit>.None), Option<Option<Unit>>.Some(Option<Unit>.None));
        Check(Option<Option<Unit>>.None != Option<Option<Unit>>.Some(Option<Unit>.None));
        Check(Option<Option<Unit>>.Some(Option<Unit>.None) != Option<Option<Unit>>.Some(Option<Unit>.Some(default)));
        Throws<InvalidOperationException>(() => _ = Option<Unit>.None.Value);
        Same(Option<Tree[]>.Some(new[] { Tree() }), Option<Tree[]>.Some(new[] { Tree() }));
        Same(Result<Unit, Unit>.Ok(default), Result<Unit, Unit>.Ok(default));
        Same(Result<Unit, Unit>.Err(default), Result<Unit, Unit>.Err(default));
        Check(Result<Unit, Unit>.Ok(default) != Result<Unit, Unit>.Err(default));
        Check(!default(Result<Unit, Unit>).IsInitialized);
        Check(default(Result<Unit, Unit>) != Result<Unit, Unit>.Ok(default));
        Throws<InvalidOperationException>(() => _ = Result<Unit, Unit>.Ok(default).Error);
        Throws<InvalidOperationException>(() => _ = Result<Unit, Unit>.Err(default).Value);
        Throws<InvalidOperationException>(() => _ = default(Result<Unit, Unit>).Value);
        Same(Result<(Tree, Tree), string>.Ok((Tree(), Tree())), Result<(Tree, Tree), string>.Ok((Tree(), Tree())));
        Same(Result<Tree, string>.Err("bad\0branch"), Result<Tree, string>.Err("bad\0branch"));
        Same(new Envelope(Tree(), new[] { new[] { Tree() }, Array.Empty<Tree>() }, Option<Tree>.None,
            Result<(Tree, Tree), string>.Ok((Tree(), Tree())), Option<Option<Unit>>.Some(Option<Unit>.None)),
            new Envelope(Tree(), new[] { new[] { Tree() }, Array.Empty<Tree>() }, Option<Tree>.None,
            Result<(Tree, Tree), string>.Ok((Tree(), Tree())), Option<Option<Unit>>.Some(Option<Unit>.None)));

        var shared = Tree();
        Same<Tree>(new TreeBranch(new[] { shared, shared }), new TreeBranch(new[] { Tree(), Tree() }));
        var mutable = new TreeBranch(new[] { Tree() });
        Same<Tree>(mutable, new TreeBranch(new[] { Tree() }));
        mutable.Children[0] = new TreeBranch(Array.Empty<Tree>());
        Check(!mutable.Equals(new TreeBranch(new[] { Tree() })));
        Check(Tree().ToString().Contains("tree\0\U0001f332", StringComparison.Ordinal));
        Check(new TreeLeaf(Scalars() with { Text = new string('x', 100000) }).ToString().Length < 4200);

        var cycle = new TreeBranch(new Tree[1]); cycle.Children[0] = cycle;
        RejectCycle(() => _ = cycle.Equals(cycle));
        RejectCycle(() => _ = cycle.GetHashCode());
        RejectCycle(() => _ = cycle.ToString());
        RejectCycle(() => _ = Option<Tree>.Some(cycle).Equals(Option<Tree>.None));
        RejectCycle(() => _ = Option<Tree>.Some(cycle).GetHashCode());
        RejectCycle(() => _ = Result<Tree, Unit>.Ok(cycle).Equals(Result<Tree, Unit>.Err(default)));
        RejectCycle(() => _ = Result<Tree, Unit>.Ok(cycle).GetHashCode());
        var mutual = new RightTreeMany(new LeftTree[1]); mutual.Lefts[0] = new LeftTreeNext(mutual);
        RejectCycle(() => _ = mutual.Equals(mutual));
        RejectCycle(() => _ = mutual.GetHashCode());

        Spine deepA = new SpineLeaf(7), deepB = new SpineLeaf(7);
        for (int i = 0; i < 127; i++) { deepA = new SpineNext(deepA); deepB = new SpineNext(deepB); }
        Same(deepA, deepB);
        deepA = new SpineNext(deepA); deepB = new SpineNext(deepB);
        Throws<ArgumentException>(() => _ = deepA.Equals(deepB));
        Throws<ArgumentException>(() => _ = deepA.GetHashCode());
        Throws<ArgumentException>(() => _ = deepA.ToString());
        var huge = new TreeBranch(new Tree[262144]);
        Throws<ArgumentException>(() => _ = huge.GetHashCode());
        Throws<ArgumentException>(() => _ = huge.Equals(huge));
        // Shared subtrees must still consume the visit budget on every edge.
        Tree repeated = new TreeBranch(Array.Empty<Tree>());
        for (int i = 0; i < 18; i++) repeated = new TreeBranch(new[] { repeated, repeated });
        Throws<ArgumentException>(() => _ = repeated.GetHashCode());
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { checks, cycleRejections, nativeCalls = 0,
            wideFields = typeof(WideNext).GetConstructors()[0].GetParameters().Length, dotnet = Environment.Version.ToString() }));
    }
}
