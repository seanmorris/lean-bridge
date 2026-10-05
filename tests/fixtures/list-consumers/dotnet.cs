// Independent checks against the installed public assembly.
using System;
using System.Linq;
using System.Numerics;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using LeanBridge.Lists;
using Choice = LeanBridge.Lists.Option<LeanBridge.Lists.Result<(System.Numerics.BigInteger, LeanBridge.Lists.Unit), string>>;
using Nested = LeanBridge.Lists.Option<LeanBridge.Lists.Result<LeanBridge.Lists.Unit[], string>[]>;
using SwapInput = LeanBridge.Lists.Result<(System.Numerics.BigInteger[], uint[]), string[]>;
using SwapOutput = LeanBridge.Lists.Result<string[], (System.Numerics.BigInteger[], uint[])>;

static class Program
{
    static int checks;
    static void Check(bool value) { var n = Interlocked.Increment(ref checks); if (!value) throw new Exception($"Check {n} failed"); }
    static void Reject<T>(Action action) where T : Exception
    {
        try { action(); } catch (T) { Check(true); return; }
        throw new Exception("Expected " + typeof(T).Name);
    }
    static void Same(object a, object b)
    {
        Check(a.GetType() == b.GetType());
        if (a is float f && b is float g) Check(float.IsNaN(f) && float.IsNaN(g) || BitConverter.SingleToInt32Bits(f) == BitConverter.SingleToInt32Bits(g));
        else if (a is double d && b is double e) Check(double.IsNaN(d) && double.IsNaN(e) || BitConverter.DoubleToInt64Bits(d) == BitConverter.DoubleToInt64Bits(e));
        else if (a is Array aa && b is Array ab) { Check(aa.Length == ab.Length); for (int i = 0; i < aa.Length; ++i) Same(aa.GetValue(i)!, ab.GetValue(i)!); }
        else if (a is ITuple ta && b is ITuple tb) { Check(ta.Length == tb.Length); for (int i = 0; i < ta.Length; ++i) Same(ta[i]!, tb[i]!); }
        else if (a.GetType().IsGenericType && a.GetType().GetGenericTypeDefinition() == typeof(Option<>))
        {
            var type = a.GetType(); var present = type.GetProperty("IsSome")!;
            Check(Equals(present.GetValue(a), present.GetValue(b)));
            if ((bool)present.GetValue(a)!) Same(type.GetProperty("Value")!.GetValue(a)!, type.GetProperty("Value")!.GetValue(b)!);
        }
        else if (a.GetType().IsGenericType && a.GetType().GetGenericTypeDefinition() == typeof(Result<,>))
        {
            var type = a.GetType(); var ok = type.GetProperty("IsOk")!;
            Check((bool)type.GetProperty("IsInitialized")!.GetValue(a)!);
            Check(Equals(ok.GetValue(a), ok.GetValue(b)));
            var property = type.GetProperty((bool)ok.GetValue(a)! ? "Value" : "Error")!;
            Same(property.GetValue(a)!, property.GetValue(b)!);
        }
        else Check(Equals(a, b));
    }
    static void Exercise<T>(Func<T[], T[]> reverse, T[] values)
    {
        Same(reverse(Array.Empty<T>()), Array.Empty<T>());
        for (int i = 0; i < 32; ++i)
        {
            T a = values[i % values.Length], b = values[(i + 1) % values.Length];
            Same(reverse(new[] { a, b, a, a }), new[] { a, a, b, a });
            Same(reverse(new[] { a }), new[] { a });
        }
        Reject<ArgumentNullException>(() => reverse(null!));
    }
    static void DeepCases()
    {
        var types = new Type[25]; types[0] = typeof(uint);
        for (int i = 1; i <= 24; ++i) types[i] = types[i - 1].MakeArrayType();
        var call = typeof(Api).GetMethod(nameof(Api.Deep))!;
        Check(call.GetParameters().Single().ParameterType == types[24]); Check(call.ReturnType == types[24]);
        for (int depth = 0; depth <= 24; ++depth)
        {
            object value = depth == 24 ? 42u : Array.CreateInstance(types[23 - depth], 0);
            for (int level = 25 - depth; level <= 24; ++level) {
                var outer = Array.CreateInstance(types[level - 1], 1); outer.SetValue(value, 0); value = outer;
            }
            Same(call.Invoke(null, new[] { value })!, value);
        }
    }
    static void Main()
    {
        var huge = (BigInteger.One << 5120) + (BigInteger.One << 255) + 17;
        Exercise(Api.ReverseUnit, new Unit[] { default });
        Exercise(Api.ReverseBool, new[] { false, true });
        Exercise(Api.ReverseUint8, new byte[] { 0, 1, byte.MaxValue });
        Exercise(Api.ReverseUint16, new ushort[] { 0, 1, ushort.MaxValue });
        Exercise(Api.ReverseUint32, new uint[] { 0, 1, uint.MaxValue });
        Exercise(Api.ReverseUint64, new ulong[] { 0, 1, 1UL << 32, (1UL << 53) + 1, ulong.MaxValue });
        Exercise(Api.ReverseInt8, new sbyte[] { sbyte.MinValue, -1, 0, sbyte.MaxValue });
        Exercise(Api.ReverseInt16, new short[] { short.MinValue, -1, 0, short.MaxValue });
        Exercise(Api.ReverseInt32, new int[] { int.MinValue, -1, 0, int.MaxValue });
        Exercise(Api.ReverseInt64, new long[] { long.MinValue, -1, 0, (1L << 53) + 1, long.MaxValue });
        Exercise(Api.ReverseUsize, new ulong[] { 0, 1UL << 32, (1UL << 53) + 1, ulong.MaxValue });
        Exercise(Api.ReverseIsize, new long[] { long.MinValue, -1, 0, (1L << 53) + 1, long.MaxValue });
        Exercise(Api.ReverseNat, new BigInteger[] { 0, ulong.MaxValue, huge });
        Exercise(Api.ReverseInt, new BigInteger[] { 0, long.MinValue, huge, -huge });
        Exercise(Api.ReverseFloat32, new[] { 0f, -0f, 1f / 3, float.Epsilon, -float.Epsilon, float.MaxValue, float.NaN, float.PositiveInfinity, float.NegativeInfinity });
        Exercise(Api.ReverseFloat64, new[] { 0d, -0d, 1d / 3, double.Epsilon, -double.Epsilon, double.MaxValue, double.NaN, double.PositiveInfinity, double.NegativeInfinity });
        Exercise(Api.ReverseString, new[] { "", "a\0λ🌿", "\0", "\U0010ffff", "e\u0301" });
        Exercise(Api.ReverseBytes, new[] { Array.Empty<byte>(), new byte[] { 0, 255, 128 }, Enumerable.Range(0, 256).Select(x => (byte)x).ToArray() });
        Exercise(Api.ReverseChar, new[] { new Rune(0), new Rune(0x7f), new Rune(0xd7ff), new Rune(0xe000), new Rune(0xffff), new Rune(0x10000), new Rune(0x10ffff) });

        Func<string[], string> join = Api.Join;
        Func<uint[][], uint[][]> mix = Api.Mix;
        Same(join(new[] { "a\0", "", "🌿" }), "a\0🌱🌱🌿");
        Same(join(Array.Empty<string>()), "");
        Same(mix(new[] { new uint[] { 1, 2, 3 }, Array.Empty<uint>(), new uint[] { 4 } }),
             new[] { new uint[] { 4 }, Array.Empty<uint>(), new uint[] { 3, 2, 1 } });
        var leaf = new Rune(0x1f33f); var zero = new Rune(0);
        for (uint index = 0; index < 20; ++index)
        {
            var packet = new Packet(new[] { new uint[] { 1, 2, 3 }, Array.Empty<uint>(), new[] { index } },
                new[] { Choice.None, Choice.Some(Result<(BigInteger, Unit), string>.Ok((huge, default))), Choice.Some(Result<(BigInteger, Unit), string>.Err("oops\0")) },
                new[] { new byte[] { 0, 255 }, Array.Empty<byte>() },
                new[] { new[] { (true, leaf), (false, zero) }, Array.Empty<(bool, Rune)>() });
            var copied = Api.Transform(packet);
            Same(copied.Sequences, new[] { new[] { index }, Array.Empty<uint>(), new uint[] { 3, 2, 1 } });
            Same(copied.Branches, new[] { Choice.Some(Result<(BigInteger, Unit), string>.Err("oops\0!")), Choice.Some(Result<(BigInteger, Unit), string>.Ok((huge + 1, default))), Choice.None });
            Same(copied.Buffers, new[] { Array.Empty<byte>(), new byte[] { 0, 255 } });
            Same(copied.Arrays, new[] { Array.Empty<(bool, Rune)>(), new[] { (false, zero), (true, leaf) } });
            Check(!ReferenceEquals(copied, packet));
            copied.Buffers[1][0] = 9; Check(packet.Buffers[0][0] == 0);
            packet.Sequences[0][0] = 99; packet.Arrays[0] = Array.Empty<(bool, Rune)>(); packet.Branches[1] = Choice.None;
            Same(copied.Sequences[2], new uint[] { 3, 2, 1 });
            Same(copied.Arrays[1], new[] { (false, zero), (true, leaf) }); Check(copied.Branches[1].IsSome);
        }
        Func<Nested, Nested> nest = Api.Nest;
        Func<SwapInput, SwapOutput> swap = Api.Swap;
        Same(nest(Nested.None), Nested.None);
        Same(nest(Nested.Some(Array.Empty<Result<Unit[], string>>())), Nested.Some(Array.Empty<Result<Unit[], string>>()));
        Same(nest(Nested.Some(new[] { Result<Unit[], string>.Ok(new Unit[2]), Result<Unit[], string>.Err("bad\0"), Result<Unit[], string>.Ok(Array.Empty<Unit>()) })),
            Nested.Some(new[] { Result<Unit[], string>.Ok(Array.Empty<Unit>()), Result<Unit[], string>.Err("bad\0!"), Result<Unit[], string>.Ok(new Unit[2]) }));
        Same(swap(SwapInput.Err(new[] { "first", "last" })), SwapOutput.Ok(new[] { "last", "first" }));
        Same(swap(SwapInput.Ok((new BigInteger[] { huge, 42 }, new uint[] { 1, 2, 3 }))), SwapOutput.Err((new BigInteger[] { 42, huge }, new uint[] { 3, 2, 1 })));
        DeepCases();
        byte[] input = { 0, 255 }; var copies = Api.Duplicate(input);
        Same(copies, new[] { new byte[] { 0, 255 }, new byte[] { 0, 255 } }); copies[0][0] = 7;
        Check(copies[1][0] == 0 && input[0] == 0);
        Same(Api.Duplicate(Array.Empty<byte>()), new[] { Array.Empty<byte>(), Array.Empty<byte>() });

        Reject<ArgumentOutOfRangeException>(() => Api.ReverseNat(new BigInteger[] { huge, -1 }));
        Reject<ArgumentNullException>(() => Api.ReverseString(new[] { "copied first", null! }));
        Reject<ArgumentNullException>(() => Api.ReverseBytes(new[] { new byte[] { 0 }, null! }));
        Reject<ArgumentNullException>(() => Api.Mix(new[] { new uint[] { 1 }, null! }));
        Reject<ArgumentNullException>(() => Api.Nest(Nested.Some(null!)));
        Reject<ArgumentException>(() => Api.Nest(Nested.Some(new[] { Result<Unit[], string>.Ok(new Unit[1]), default })));
        Reject<ArgumentNullException>(() => Api.Nest(Nested.Some(new[] { Result<Unit[], string>.Ok(null!) })));
        Reject<ArgumentNullException>(() => Api.Transform(null!));
        Reject<EncoderFallbackException>(() => Api.ReverseString(new[] { "copied first", "\ud800" }));
        Reject<ArgumentException>(() => Api.ReverseUnit(new Unit[(1 << 21) + 1]));
        Reject<ArgumentException>(() => Api.ReverseBytes(new[] { new byte[16 * 1024 * 1024] }));
        for (int i = 0; i < 3; ++i) {
            Reject<ArgumentException>(() => Api.Duplicate(new byte[6 * 1024 * 1024]));
            Same(Api.Duplicate(input), new[] { new byte[] { 0, 255 }, new byte[] { 0, 255 } });
        }
        Reject<ArgumentException>(() => Api.Generate(2097153));
        Same(Api.Generate(1), new uint[] { 7 });
        Same(Api.Generate(30000), Enumerable.Repeat(7u, 30000).ToArray());
        Parallel.For(0, 4, lane => { for (int i = 0; i < 64; ++i) {
            var n = huge + lane * 64 + i;
            Same(Api.ReverseNat(new BigInteger[] { n, 42 }), new BigInteger[] { 42, n });
        } });
        Console.WriteLine($"list-dotnet-ok:{checks}");
    }
}
