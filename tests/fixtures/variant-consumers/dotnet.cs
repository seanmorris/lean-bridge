// Exercise the installed public C# API without native layouts or unsafe code.
using System;
using System.Linq;
using System.Numerics;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using LeanBridge.Variants;

sealed record UnknownSignal : Signal
{
    public UnknownSignal() : base(new SignalIdle()) { }
}

static class Program
{
    static int checks, calls, rejected;
    static void Check(bool value) { int n = Interlocked.Increment(ref checks); if (!value) throw new Exception($"variant check {n} failed"); }
    static T Call<T>(Func<T> action) { Interlocked.Increment(ref calls); return action(); }
    static void Same(object? actual, object? expected)
    {
        if (actual is null || expected is null) { Check(actual is null && expected is null); return; }
        Type type = expected.GetType(); Check(actual.GetType() == type);
        if (expected is float f) { Check(float.IsNaN(f) ? float.IsNaN((float)actual) : BitConverter.SingleToInt32Bits(f) == BitConverter.SingleToInt32Bits((float)actual)); return; }
        if (expected is double d) { Check(double.IsNaN(d) ? double.IsNaN((double)actual) : BitConverter.DoubleToInt64Bits(d) == BitConverter.DoubleToInt64Bits((double)actual)); return; }
        if (expected is Array array) {
            var result = (Array)actual; Check(result.Length == array.Length);
            for (int i = 0; i < array.Length; ++i) Same(result.GetValue(i), array.GetValue(i));
            return;
        }
        if (expected is ITuple tuple) {
            var result = (ITuple)actual; Check(result.Length == tuple.Length);
            for (int i = 0; i < tuple.Length; ++i) Same(result[i], tuple[i]);
            return;
        }
        if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Option<>)) {
            bool present = (bool)type.GetProperty("IsSome")!.GetValue(expected)!;
            Check((bool)type.GetProperty("IsSome")!.GetValue(actual)! == present);
            if (present) Same(type.GetProperty("Value")!.GetValue(actual), type.GetProperty("Value")!.GetValue(expected));
            return;
        }
        if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Result<,>)) {
            bool ok = (bool)type.GetProperty("IsOk")!.GetValue(expected)!;
            Check((bool)type.GetProperty("IsOk")!.GetValue(actual)! == ok);
            string property = ok ? "Value" : "Error";
            Same(type.GetProperty(property)!.GetValue(actual), type.GetProperty(property)!.GetValue(expected)); return;
        }
        if (type.Namespace == "LeanBridge.Variants") {
            foreach (var property in type.GetProperties(BindingFlags.Public | BindingFlags.Instance)) Same(property.GetValue(actual), property.GetValue(expected));
            return;
        }
        Check(actual.Equals(expected));
    }
    static void Reject<T>(Action action) where T : Exception
    {
        bool failed = false;
        try { action(); } catch (T) { ++rejected; failed = true; }
        Check(failed); Same(Call(() => Api.Next(new SignalIdle())), new SignalStopped());
    }
    static string Describe(Signal value) => value switch {
        SignalIdle => "idle", SignalStopped => "stopped",
        SignalData(var count, var label) => $"{count}:{label}", SignalMarker => "marker",
        _ => throw new ArgumentException("Unknown constructor")
    };
    static void Main()
    {
        var scalar = new ScalarsAll(default, true, 255, 65535, uint.MaxValue, ulong.MaxValue,
            sbyte.MinValue, short.MinValue, int.MinValue, long.MinValue,
            (BigInteger.One << 5120) + 19, -((BigInteger.One << 5120) + 31), 1.5f, -2.25,
            "A\0🌱", new byte[] { 0, 255, 1 }, new Rune(0x1f331), uint.MaxValue, int.MinValue);
        Check(Call(() => Api.Inspect(scalar)));
        foreach (var changed in new[] { scalar with { Bool = false }, scalar with { U8 = 0 }, scalar with { U16 = 0 },
            scalar with { U32 = 0 }, scalar with { U64 = 0 }, scalar with { I8 = 0 }, scalar with { I16 = 0 },
            scalar with { I32 = 0 }, scalar with { I64 = 0 }, scalar with { Natural = 0 }, scalar with { Integer = 0 },
            scalar with { F32 = 0 }, scalar with { F64 = 0 }, scalar with { Text = "" }, scalar with { Bytes = Array.Empty<byte>() },
            scalar with { Char = new Rune('A') }, scalar with { Word = 0 }, scalar with { SignedWord = 0 } })
            Check(!Call(() => Api.Inspect(changed)));
        Signal[] cases = { new SignalIdle(), new SignalStopped(), new SignalData(42, "A\0🌱"), new SignalMarker(default) };
        for (uint repeat = 0; repeat < 128; ++repeat)
        {
            foreach (var value in cases) { var result = Call(() => Api.Echo(value)); Same(result, value); Check(!ReferenceEquals(result, value)); }
            Same(Call(() => Api.Next(cases[0])), new SignalStopped());
            Same(Call(() => Api.Next(cases[1])), new SignalMarker(default));
            Same(Call(() => Api.Next(cases[2])), new SignalData(43, "A\0🌱!"));
            Same(Call(() => Api.Next(cases[3])), new SignalData(42, "ready"));
            uint[] codes = { 7, 13, 48, 29 };
            for (int i = 0; i < cases.Length; ++i) Same(Call(() => Api.Code(cases[i])), codes[i]);
            foreach (var value in new Mode[] { new ModeFirst(), new ModeSecond(), new ModeThird() }) Same(Call(() => Api.EchoMode(value)), value);
            var events = cases.ToArray();
            var packet = new Packet(cases[2], events, Option<Signal>.Some(cases[3]), new Mode[] { new ModeFirst(), new ModeThird() });
            var nested = new NestedPacket(packet); var copied = (NestedPacket)Call(() => Api.EchoNested(nested));
            Same(copied, nested); events[0] = new SignalData(99, "changed"); Same(copied.Value.Events[0], new SignalIdle());
            Check(!ReferenceEquals(copied.Value.Events, packet.Events)); Check(!ReferenceEquals(copied.Value.Modes, packet.Modes));
            foreach (var value in new Nested[] { new NestedEmpty(),
                new NestedPacket(new Packet(new SignalIdle(), Array.Empty<Signal>(), Option<Signal>.None, Array.Empty<Mode>())),
                new NestedOutcome(Result<(Signal, Mode), string>.Ok((new SignalMarker(default), new ModeSecond()))),
                new NestedOutcome(Result<(Signal, Mode), string>.Err("A\0🌱")) }) Same(Call(() => Api.EchoNested(value)), value);
            var rows = new[] { Array.Empty<Signal>(), cases, new[] { cases[2], cases[2] } };
            var resultRows = Call(() => Api.Signals(rows)); Same(resultRows, new[] { Array.Empty<Signal>(), cases.Reverse().ToArray(), rows[2] });
            resultRows[1][0] = new SignalStopped(); Same(cases[3], new SignalMarker(default));
            Same(Call(() => Api.EchoScalars(scalar)), scalar); Same(Call(() => Api.EchoScalars(new ScalarsAbsent())), new ScalarsAbsent());
            foreach (var value in new Anonymous[] { new AnonymousNumber(13), new AnonymousPair(17, "A\0🌱"), new AnonymousCollision(19, "A\0🌱") })
                Same(Call(() => Api.EchoAnonymous(value)), value);
            Same(Call(() => Api.EchoOne(new OneOnly(repeat))), new OneOnly(repeat + 1));
            foreach (var value in new Buffers[] { new BuffersEmpty(), new BuffersPair(Array.Empty<byte>(), Array.Empty<byte>()), new BuffersPair(new byte[] { 0, 255 }, new byte[] { 1 }) })
                Same(Call(() => Api.EchoBuffers(value)), value);
            var duplicate = (BuffersPair)Call(() => Api.Duplicate(new byte[] { 0, 255, 1 })); Same(duplicate, new BuffersPair(new byte[] { 0, 255, 1 }, new byte[] { 0, 255, 1 }));
            Check(!ReferenceEquals(duplicate.First, duplicate.Second)); duplicate.First[0] = 42; Same(duplicate.Second[0], (byte)0);
        }
        foreach (double value in new[] { 0d, -0d, double.PositiveInfinity, double.NegativeInfinity, double.NaN, 1d / 3, double.Epsilon }) {
            var input = scalar with { F32 = (float)value, F64 = value, Word = ulong.MaxValue, SignedWord = long.MinValue };
            Same(Call(() => Api.EchoScalars(input)), input);
        }
        foreach (int value in new[] { 0, 0xd7ff, 0xe000, 0x10ffff }) {
            var input = scalar with { Char = new Rune(value) }; Same(Call(() => Api.EchoScalars(input)), input);
        }
        Same(Call(() => Api.EchoOne(new OneOnly(uint.MaxValue))), new OneOnly(0));
        Same(Call(() => Api.Next(new SignalData(uint.MaxValue, ""))), new SignalData(0, "!"));
        Reject<ArgumentNullException>(() => Call(() => Api.Echo(null!)));
        Reject<ArgumentException>(() => Call(() => Api.Echo(new UnknownSignal())));
        Reject<ArgumentNullException>(() => Call(() => Api.Echo(new SignalData(1, null!))));
        Reject<EncoderFallbackException>(() => Call(() => Api.Echo(new SignalData(1, "\ud800"))));
        Reject<ArgumentOutOfRangeException>(() => Call(() => Api.EchoScalars(scalar with { Natural = -1 })));
        Reject<ArgumentNullException>(() => Call(() => Api.EchoScalars(scalar with { Bytes = null! })));
        Reject<ArgumentNullException>(() => Call(() => Api.EchoNested(new NestedPacket(null!))));
        Reject<ArgumentNullException>(() => Call(() => Api.Signals(new[] { cases, null! })));
        Reject<ArgumentNullException>(() => Call(() => Api.EchoNested(new NestedOutcome(Result<(Signal, Mode), string>.Ok((null!, new ModeFirst()))))));
        Reject<ArgumentException>(() => Call(() => Api.EchoNested(new NestedOutcome(default))));
        for (int i = 0; i < 3; ++i) {
            Reject<ArgumentException>(() => Call(() => Api.Echo(new SignalData(0, new string('x', 17 * 1024 * 1024)))));
            Reject<ArgumentException>(() => Call(() => Api.Duplicate(new byte[9 * 1024 * 1024])));
            Reject<ArgumentException>(() => Call(() => Api.Produce(17 * 1024 * 1024)));
            Same(Call(() => Api.Make(0)), new SignalIdle()); Same(Call(() => Api.Make(7)), new SignalData(7, "made"));
            Same(Call(() => Api.Produce(30000)), new BuffersPair(Enumerable.Repeat((byte)17, 30000).ToArray(), new byte[] { 1 }));
        }
        Check(cases.Select(Describe).SequenceEqual(new[] { "idle", "stopped", "42:A\0🌱", "marker" }));
        Parallel.For(0, 256, i => Same(Call(() => Api.Next(new SignalData((uint)i, "thread"))), new SignalData((uint)i + 1, "thread!")));
        Check(rejected == 19); Check(calls > 4000);
        Console.WriteLine($"variant-dotnet-ok:{checks}");
    }
}
