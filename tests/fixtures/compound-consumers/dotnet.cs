// Independent checks against the installed public assembly.
using System;
using System.Linq;
using System.Numerics;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using LeanBridge.Compounds;
using Choice = LeanBridge.Compounds.Option<LeanBridge.Compounds.Result<(System.Numerics.BigInteger, LeanBridge.Compounds.Unit), string>>;
using Row = LeanBridge.Compounds.Option<LeanBridge.Compounds.Result<(string, ulong), (byte[], System.Numerics.BigInteger)>>;
using Nested = LeanBridge.Compounds.Result<LeanBridge.Compounds.Option<LeanBridge.Compounds.Result<(uint, LeanBridge.Compounds.Unit), string>>, LeanBridge.Compounds.Option<System.Numerics.BigInteger>>;

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
    static void Exercise<T>(Func<Option<T>, Option<T>> option, Func<Result<T, T>, Result<T, T>> result, Func<(T, T), (T, T)> tuple, T[] values)
    {
        Same(option(Option<T>.None), Option<T>.None);
        for (int i = 0; i < 32; ++i)
        {
            T a = values[i % values.Length], b = values[(i + 1) % values.Length];
            Same(option(Option<T>.Some(a)), Option<T>.Some(a));
            Same(result(Result<T, T>.Ok(a)), Result<T, T>.Err(a));
            Same(result(Result<T, T>.Err(a)), Result<T, T>.Ok(a));
            Same(tuple((a, b)), (b, a));
        }
    }
    static void DeepCases()
    {
        var types = new Type[25]; types[0] = typeof(Result<(uint, Unit), string>);
        for (int i = 1; i <= 24; ++i) types[i] = typeof(Option<>).MakeGenericType(types[i - 1]);
        var call = typeof(Api).GetMethod(nameof(Api.Deep))!;
        Check(call.GetParameters().Single().ParameterType == types[24]); Check(call.ReturnType == types[24]);
        for (int depth = 0; depth <= 24; ++depth)
        {
            object value = depth == 24 ? Result<(uint, Unit), string>.Ok((42, default)) : Activator.CreateInstance(types[24 - depth])!;
            for (int level = 25 - depth; level <= 24; ++level) value = types[level].GetMethod("Some")!.Invoke(null, new[] { value })!;
            Same(call.Invoke(null, new[] { value })!, value);
        }
        object error = Result<(uint, Unit), string>.Err("deep\0λ");
        for (int level = 1; level <= 24; ++level) error = types[level].GetMethod("Some")!.Invoke(null, new[] { error })!;
        Same(call.Invoke(null, new[] { error })!, error);
    }
    static void Main()
    {
        var huge = (BigInteger.One << 5120) + (BigInteger.One << 255) + 17;
        Exercise(Api.OptionUnit, Api.ResultUnit, Api.TupleUnit, new Unit[] { default });
        Exercise(Api.OptionBool, Api.ResultBool, Api.TupleBool, new[] { false, true });
        Exercise(Api.OptionUint8, Api.ResultUint8, Api.TupleUint8, new byte[] { 0, 1, byte.MaxValue });
        Exercise(Api.OptionUint16, Api.ResultUint16, Api.TupleUint16, new ushort[] { 0, 1, ushort.MaxValue });
        Exercise(Api.OptionUint32, Api.ResultUint32, Api.TupleUint32, new uint[] { 0, 1, uint.MaxValue });
        Exercise(Api.OptionUint64, Api.ResultUint64, Api.TupleUint64, new ulong[] { 0, 1, 1UL << 32, (1UL << 53) + 1, ulong.MaxValue });
        Exercise(Api.OptionInt8, Api.ResultInt8, Api.TupleInt8, new sbyte[] { sbyte.MinValue, -1, 0, sbyte.MaxValue });
        Exercise(Api.OptionInt16, Api.ResultInt16, Api.TupleInt16, new short[] { short.MinValue, -1, 0, short.MaxValue });
        Exercise(Api.OptionInt32, Api.ResultInt32, Api.TupleInt32, new int[] { int.MinValue, -1, 0, int.MaxValue });
        Exercise(Api.OptionInt64, Api.ResultInt64, Api.TupleInt64, new long[] { long.MinValue, -1, 0, (1L << 53) + 1, long.MaxValue });
        Exercise(Api.OptionUsize, Api.ResultUsize, Api.TupleUsize, new ulong[] { 0, 1UL << 32, (1UL << 53) + 1, ulong.MaxValue });
        Exercise(Api.OptionIsize, Api.ResultIsize, Api.TupleIsize, new long[] { long.MinValue, -1, 0, (1L << 53) + 1, long.MaxValue });
        Exercise(Api.OptionNat, Api.ResultNat, Api.TupleNat, new BigInteger[] { 0, ulong.MaxValue, huge });
        Exercise(Api.OptionInt, Api.ResultInt, Api.TupleInt, new BigInteger[] { 0, long.MinValue, huge, -huge });
        Exercise(Api.OptionFloat32, Api.ResultFloat32, Api.TupleFloat32, new[] { 0f, -0f, 1f / 3, float.Epsilon, -float.Epsilon, float.MaxValue, float.NaN, float.PositiveInfinity, float.NegativeInfinity });
        Exercise(Api.OptionFloat64, Api.ResultFloat64, Api.TupleFloat64, new[] { 0d, -0d, 1d / 3, double.Epsilon, -double.Epsilon, double.MaxValue, double.NaN, double.PositiveInfinity, double.NegativeInfinity });
        Exercise(Api.OptionString, Api.ResultString, Api.TupleString, new[] { "", "a\0λ🌿", "\0", "\U0010ffff", "e\u0301" });
        Exercise(Api.OptionBytes, Api.ResultBytes, Api.TupleBytes, new[] { Array.Empty<byte>(), new byte[] { 0, 255, 128 }, Enumerable.Range(0, 256).Select(x => (byte)x).ToArray() });
        Exercise(Api.OptionChar, Api.ResultChar, Api.TupleChar, new[] { new Rune(0), new Rune(0x7f), new Rune(0xd7ff), new Rune(0xe000), new Rune(0xffff), new Rune(0x10000), new Rune(0x10ffff) });

        var states = new[] { Option<Option<Unit>>.None, Option<Option<Unit>>.Some(Option<Unit>.None), Option<Option<Unit>>.Some(Option<Unit>.Some(default)) };
        var state = states[0];
        for (int step = 0; step < 30; ++step) { Same(state, states[step % 3]); Check(Api.Classify(state) == step % 3); state = Api.Next(state); }
        Same(Api.Make(), Option<Result<(ulong, Unit), string>>.Some(Result<(ulong, Unit), string>.Ok((ulong.MaxValue, default))));
        Same(Api.Flip(Result<(uint, Option<Unit>), Option<string>>.Ok((42, Option<Unit>.Some(default)))), Result<Option<string>, (uint, Option<Unit>)>.Err((42, Option<Unit>.Some(default))));
        Same(Api.Flip(Result<(uint, Option<Unit>), Option<string>>.Err(Option<string>.Some("a\0λ"))), Result<Option<string>, (uint, Option<Unit>)>.Ok(Option<string>.Some("a\0λ")));
        Same(Api.Flip(Result<(uint, Option<Unit>), Option<string>>.Err(Option<string>.None)), Result<Option<string>, (uint, Option<Unit>)>.Ok(Option<string>.None));
        foreach (var choice in new[] { Choice.None, Choice.Some(Result<(BigInteger, Unit), string>.Ok((huge, default))), Choice.Some(Result<(BigInteger, Unit), string>.Err("oops\0")) })
        foreach (var nested in new[] { Nested.Ok(Option<Result<(uint, Unit), string>>.None), Nested.Ok(Option<Result<(uint, Unit), string>>.Some(Result<(uint, Unit), string>.Ok((42, default)))), Nested.Ok(Option<Result<(uint, Unit), string>>.Some(Result<(uint, Unit), string>.Err("bad"))), Nested.Err(Option<BigInteger>.None), Nested.Err(Option<BigInteger>.Some(huge)) })
        {
            var packet = new Packet(choice, ((4, "a\0"), (true, new Rune(0x1f331))), new[] { Row.None, Row.Some(Result<(string, ulong), (byte[], BigInteger)>.Ok(("x\0🌱", ulong.MaxValue))), Row.Some(Result<(string, ulong), (byte[], BigInteger)>.Err((new byte[] { 0, 255 }, -huge))) }, nested);
            var copied = Api.Transform(packet);
            var expected = choice.IsNone ? Choice.None : choice.Value.IsOk ? Choice.Some(Result<(BigInteger, Unit), string>.Ok((huge + 1, default))) : Choice.Some(Result<(BigInteger, Unit), string>.Err("oops\0!"));
            Same(copied.Choice, expected); Same(copied.Products, ((5u, "a\0!"), (false, new Rune(0x1f331))));
            Same(copied.Rows, packet.Rows.Reverse().ToArray()); Same(copied.Nested, nested); Check(!ReferenceEquals(copied, packet));
            copied.Rows[0].Value.Error.Item1[0] = 7; Check(packet.Rows[2].Value.Error.Item1[0] == 0);
        }
        DeepCases();
        Same(Api.Duplicate(Option<byte[]>.None), Result<Option<byte[][]>, string>.Err("empty"));
        var input = Option<byte[]>.Some(new byte[] { 0, 255 }); var copies = Api.Duplicate(input).Value.Value;
        Same(copies, new[] { new byte[] { 0, 255 }, new byte[] { 0, 255 } }); copies[0][0] = 7;
        Check(copies[1][0] == 0 && input.Value[0] == 0);

        Check(Option<Unit>.None.ToString() == "None"); Check(Option<Unit>.Some(default).ToString().StartsWith("Some("));
        Check(Result<Unit, Unit>.Ok(default).ToString().StartsWith("Ok(")); Check(Result<Unit, Unit>.Err(default).ToString().StartsWith("Err("));
        Check(default(Result<Unit, Unit>).ToString() == "Uninitialized Result");
        Check(Option<Unit>.None == default); Check(Option<Unit>.Some(default) != default);
        Check(Result<Unit, Unit>.Ok(default) != Result<Unit, Unit>.Err(default));
        Reject<InvalidOperationException>(() => _ = Option<Unit>.None.Value);
        Reject<InvalidOperationException>(() => _ = Result<Unit, Unit>.Ok(default).Error);
        Reject<InvalidOperationException>(() => _ = Result<Unit, Unit>.Err(default).Value);
        Reject<ArgumentException>(() => Api.ResultUnit(default));
        Reject<ArgumentOutOfRangeException>(() => Api.OptionNat(Option<BigInteger>.Some(-1)));
        Reject<ArgumentNullException>(() => Api.OptionString(Option<string>.Some(null!)));
        Reject<ArgumentNullException>(() => Api.ResultString(Result<string, string>.Ok(null!)));
        Reject<ArgumentNullException>(() => Api.ResultString(Result<string, string>.Err(null!)));
        Reject<ArgumentNullException>(() => Api.TupleString(("allocated first", null!)));
        Reject<ArgumentNullException>(() => Api.OptionBytes(Option<byte[]>.Some(null!)));
        Reject<ArgumentNullException>(() => Api.Transform(null!));
        Reject<EncoderFallbackException>(() => Api.OptionString(Option<string>.Some("\ud800")));
        Reject<ArgumentException>(() => Api.OptionBytes(Option<byte[]>.Some(new byte[16 * 1024 * 1024])));
        Reject<ArgumentException>(() => Api.Duplicate(Option<byte[]>.Some(new byte[6 * 1024 * 1024])));
        Same(Api.Duplicate(input), Result<Option<byte[][]>, string>.Ok(Option<byte[][]>.Some(new[] { new byte[] { 0, 255 }, new byte[] { 0, 255 } })));
        Parallel.For(0, 4, lane => { for (int i = 0; i < 64; ++i) { var value = Option<BigInteger>.Some(huge + lane * 64 + i); Same(Api.OptionNat(value), value); } });
        Console.WriteLine($"compound-dotnet-ok:{checks}");
    }
}
