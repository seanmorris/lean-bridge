// Independent checks against an installed assembly. Lean aliases use CLR target values.
using System;
using System.Linq;
using System.Numerics;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using LeanBridge.Aliases;

static class Program
{
    static int checks;
    static void Check(bool value) { int n = Interlocked.Increment(ref checks); if (!value) throw new Exception($"Check {n} failed"); }
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
        else if (a is Packet || a is Scalars)
        {
            foreach (var property in a.GetType().GetProperties(BindingFlags.Instance | BindingFlags.Public))
                Same(property.GetValue(a)!, property.GetValue(b)!);
        }
        else Check(Equals(a, b));
    }
    static void Exercise<T>(Func<T, T> echo, T[] values)
    {
        foreach (T value in values) Same(echo(value)!, value!);
    }
    static void Main()
    {
        Action<Unit> unit = Api.EchoUnit; unit(default);
        Check(typeof(Api).GetMethod(nameof(Api.EchoUnit))!.ReturnType == typeof(void));
        Exercise(Api.EchoBool, new[] { false, true });
        Exercise(Api.EchoUint8, new byte[] { 0, 1, byte.MaxValue });
        Exercise(Api.EchoUint16, new ushort[] { 0, 1, ushort.MaxValue });
        Exercise(Api.EchoUint32, new uint[] { 0, 1, uint.MaxValue });
        Exercise(Api.EchoUint64, new ulong[] { 0, 1, 1UL << 32, (1UL << 53) + 1, ulong.MaxValue });
        Exercise(Api.EchoInt8, new sbyte[] { sbyte.MinValue, -1, 0, sbyte.MaxValue });
        Exercise(Api.EchoInt16, new short[] { short.MinValue, -1, 0, short.MaxValue });
        Exercise(Api.EchoInt32, new int[] { int.MinValue, -1, 0, int.MaxValue });
        Exercise(Api.EchoInt64, new long[] { long.MinValue, -1, 0, (1L << 53) + 1, long.MaxValue });
        Exercise(Api.EchoUsize, new ulong[] { 0, 1UL << 32, (1UL << 53) + 1, ulong.MaxValue });
        Exercise(Api.EchoIsize, new long[] { long.MinValue, -1, 0, (1L << 53) + 1, long.MaxValue });
        Exercise(Api.EchoFloat32, new[] { 0f, -0f, 1f / 3, float.Epsilon, -float.Epsilon, float.MaxValue, float.NaN, float.PositiveInfinity, float.NegativeInfinity });
        Exercise(Api.EchoFloat64, new[] { 0d, -0d, 1d / 3, double.Epsilon, -double.Epsilon, double.MaxValue, double.NaN, double.PositiveInfinity, double.NegativeInfinity });
        Exercise(Api.EchoString, new[] { "", "A\0🌱", "\0", "\U0010ffff", "e\u0301" });
        Exercise(Api.EchoBytes, new[] { Array.Empty<byte>(), new byte[] { 0, 255, 1 }, Enumerable.Range(0, 256).Select(x => (byte)x).ToArray() });
        Exercise(Api.EchoChar, new[] { new Rune(0), new Rune(0x7f), new Rune(0xd7ff), new Rune(0xe000), new Rune(0xffff), new Rune(0x10000), new Rune(0x10ffff) });
        foreach (int bit in new[] { 0, 7, 31, 32, 53, 64, 255, 1024, 5120 })
        {
            BigInteger value = (BigInteger.One << bit) + 19;
            Same(Api.EchoNat(value), value); Same(Api.EchoInt(value), value); Same(Api.EchoInt(-value), -value);
        }
        Same(Api.EchoNat(0), BigInteger.Zero); Same(Api.EchoInt(0), BigInteger.Zero);
        Func<uint, uint> increment = Api.Increment;
        Check(Api.Make() == 41); Check(Api.Label() == "alias🌱"); Check(increment(uint.MaxValue) == 0);
        for (uint i = 0; i < 512; ++i) Check(increment(i) == i + 1);

        var fields = new Scalars(default, true, byte.MaxValue, ushort.MaxValue,
            uint.MaxValue, ulong.MaxValue, sbyte.MinValue, short.MinValue, int.MinValue, long.MinValue,
            (BigInteger.One << 5120) + 19, -((BigInteger.One << 5120) + 31), 1.5f, -2.25,
            "A\0🌱", new byte[] { 0, 255, 1 }, new Rune(0x1f331), uint.MaxValue, int.MinValue);
        Check(Api.Inspect(fields));
        Scalars copied = Api.EchoScalars(fields); Same(copied, fields);
        Check(!ReferenceEquals(copied, fields)); Check(!ReferenceEquals(copied.VBytes, fields.VBytes));
        Check(!Api.Inspect(fields with { VBool = false }));
        Check(!Api.Inspect(fields with { VUint8 = 0 })); Check(!Api.Inspect(fields with { VUint16 = 0 }));
        Check(!Api.Inspect(fields with { VUint32 = 0 })); Check(!Api.Inspect(fields with { VUint64 = 0 }));
        Check(!Api.Inspect(fields with { VInt8 = 0 })); Check(!Api.Inspect(fields with { VInt16 = 0 }));
        Check(!Api.Inspect(fields with { VInt32 = 0 })); Check(!Api.Inspect(fields with { VInt64 = 0 }));
        Check(!Api.Inspect(fields with { VNat = 0 })); Check(!Api.Inspect(fields with { VInt = 0 }));
        Check(!Api.Inspect(fields with { VFloat32 = 0 })); Check(!Api.Inspect(fields with { VFloat64 = 0 }));
        Check(!Api.Inspect(fields with { VString = "" })); Check(!Api.Inspect(fields with { VBytes = Array.Empty<byte>() }));
        Check(!Api.Inspect(fields with { VChar = new Rune(0) })); Check(!Api.Inspect(fields with { VUsize = 0 }));
        Check(!Api.Inspect(fields with { VIsize = 0 }));
        copied.VBytes[0] = 17; Check(Api.Inspect(fields));
        Same(Api.ReverseRows(Array.Empty<uint[]>()), Array.Empty<uint[]>());
        Same(Api.ReversePackets(Array.Empty<Packet>()), Array.Empty<Packet>());
        foreach (var maybe in new[] { Option<Option<Unit>>.None, Option<Option<Unit>>.Some(Option<Unit>.None), Option<Option<Unit>>.Some(Option<Unit>.Some(default)) })
        {
            Same(Api.EchoMaybe(maybe), maybe);
            foreach (var outcome in new[] { Result<(uint, byte[]), string>.Ok((7, new byte[] { 0, 255, 1 })),
                Result<(uint, byte[]), string>.Ok((0, Array.Empty<byte>())), Result<(uint, byte[]), string>.Err(""), Result<(uint, byte[]), string>.Err("no\0🌱") })
            {
                Same(Api.EchoOutcome(outcome), outcome);
                var packet = new Packet(41, "packet\0🌱", new[] { new uint[] { 1, 2, 3 }, Array.Empty<uint>(), new uint[] { 1, 1 } }, maybe, outcome);
                Packet changed = Api.ChangePacket(packet); Same(changed, packet with { Count = 42 });
                Check(!ReferenceEquals(changed, packet)); Check(!ReferenceEquals(changed.Rows, packet.Rows));
                changed.Rows[0][0] = 99; Check(packet.Rows[0][0] == 1);
                Packet[] input = { packet, changed }; Packet[] result = Api.ReversePackets(input);
                Same(result, new[] { changed, packet });
                result[1].Rows[0][0] = 17; Check(input[0].Rows[0][0] == 1);
                uint[][] reversed = Api.ReverseRows(packet.Rows);
                Same(reversed, new[] { new uint[] { 3, 2, 1 }, Array.Empty<uint>(), new uint[] { 1, 1 } });
                reversed[0][0] = 77; Check(packet.Rows[0][0] == 1);
            }
        }
        Reject<ArgumentOutOfRangeException>(() => Api.EchoNat(-1)); Same(Api.EchoInt(-1), -BigInteger.One);
        Reject<ArgumentOutOfRangeException>(() => Api.EchoScalars(fields with { VNat = -1 }));
        Reject<ArgumentNullException>(() => Api.EchoScalars(null!));
        Reject<ArgumentNullException>(() => Api.EchoScalars(fields with { VString = null! }));
        Reject<ArgumentNullException>(() => Api.EchoScalars(fields with { VBytes = null! }));
        Reject<ArgumentNullException>(() => Api.EchoString(null!));
        Reject<ArgumentNullException>(() => Api.EchoBytes(null!));
        Reject<ArgumentNullException>(() => Api.ChangePacket(null!));
        Reject<ArgumentNullException>(() => Api.ReverseRows(new[] { new uint[] { 1 }, null! }));
        Reject<ArgumentNullException>(() => Api.ReversePackets(new Packet[] { null! }));
        Reject<ArgumentException>(() => Api.EchoOutcome(default));
        Reject<ArgumentNullException>(() => Api.EchoOutcome(Result<(uint, byte[]), string>.Ok((1, null!))));
        Reject<ArgumentNullException>(() => Api.EchoOutcome(Result<(uint, byte[]), string>.Err(null!)));
        Reject<EncoderFallbackException>(() => Api.EchoString("\ud800"));
        for (int i = 0; i < 3; ++i)
        {
            Reject<ArgumentException>(() => Api.EchoBytes(new byte[16 * 1024 * 1024 + 1]));
            Reject<ArgumentException>(() => Api.Duplicate(new byte[9 * 1024 * 1024]));
            Reject<ArgumentException>(() => Api.Produce(16 * 1024 * 1024 + 1));
            Same(Api.Duplicate(new byte[] { 0, 255 }), Result<(uint, byte[]), string>.Ok((7, new byte[] { 0, 255, 0, 255 })));
            Same(Api.Produce(3), new byte[] { 7, 7, 7 }); Check(Api.Make() == 41);
        }
        Parallel.For(0, 4, lane => { for (int i = 0; i < 64; ++i) {
            var n = fields.VNat + lane * 64 + i; Same(Api.EchoNat(n), n); Check(Api.Inspect(fields));
        } });
        Console.WriteLine($"alias-dotnet-ok:{checks}");
    }
}
