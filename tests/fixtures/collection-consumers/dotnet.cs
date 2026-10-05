// Independent caller of the installed public API. No private transport access.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using LeanBridge.Collections;
using Single = LeanBridge.Collections.Single;
using Deep = uint[][][][][][][][][][][][][][][][][][][][][][][][];

static class CollectionConsumer
{
    static int checks, calls, rejected;
    static readonly Dictionary<Type, string[]> Fields = new()
    {
        [typeof(Primitives)] = new[] { "Unit", "Flag", "U8", "U16", "U32", "U64", "I8", "I16", "I32", "I64", "Natural", "Integer", "F32", "F64", "Text", "Bytes", "Char", "Usize", "Isize" },
        [typeof(Empty)] = Array.Empty<string>(), [typeof(Single)] = new[] { "Value" },
        [typeof(Count)] = new[] { "Value" }, [typeof(Pair)] = new[] { "First", "Second" },
        [typeof(Reversed)] = new[] { "Second", "First" },
        [typeof(Packet)] = new[] { "Label", "Values", "Empty", "Single", "Count", "Pair", "Reversed" }
    };
    static void Check(bool value)
    {
        int number = Interlocked.Increment(ref checks);
        if (!value) throw new Exception($"collection check {number} failed");
    }
    static T Call<T>(Func<T> action) { Interlocked.Increment(ref calls); return action(); }
    static void Same(object actual, object expected)
    {
        Check(actual.GetType() == expected.GetType());
        if (expected is float f) Check(float.IsNaN(f) ? float.IsNaN((float)actual) : BitConverter.SingleToInt32Bits(f) == BitConverter.SingleToInt32Bits((float)actual));
        else if (expected is double d) Check(double.IsNaN(d) ? double.IsNaN((double)actual) : BitConverter.DoubleToInt64Bits(d) == BitConverter.DoubleToInt64Bits((double)actual));
        else if (expected is Array values)
        {
            var result = (Array)actual; Check(result.Length == values.Length);
            for (int i = 0; i < values.Length; ++i) Same(result.GetValue(i)!, values.GetValue(i)!);
        }
        else if (Fields.TryGetValue(expected.GetType(), out var fields))
        {
            foreach (var name in fields) Same(expected.GetType().GetProperty(name)!.GetValue(actual)!, expected.GetType().GetProperty(name)!.GetValue(expected)!);
            Check(actual.Equals(expected)); Check(actual.GetHashCode() == expected.GetHashCode());
        }
        else Check(actual.Equals(expected));
    }
    static T[][] Reverse<T>(T[][] input) => input.Reverse().Select(row => row.Reverse().ToArray()).ToArray();
    static void Reject<T>(Action action) where T : Exception
    {
        Interlocked.Increment(ref calls);
        bool failed = false;
        try { action(); }
        catch (T error) { Check(error.GetType() == typeof(T)); Interlocked.Increment(ref rejected); failed = true; }
        Check(failed);
        Same(Call(() => Api.ArrayReverseUint32(new[] { new uint[] { 1, 2, 3 } })), new[] { new uint[] { 3, 2, 1 } });
    }
    static void Arrays<T>(Func<T[][], T[][]> function, T[] values)
    {
        Same(Call(() => function(Array.Empty<T[]>())), Array.Empty<T[]>());
        Same(Call(() => function(new[] { Array.Empty<T>(), Array.Empty<T>() })), new[] { Array.Empty<T>(), Array.Empty<T>() });
        for (int index = 0; index < 128; ++index)
        {
            T first = values[index % values.Length], second = values[(index + 1) % values.Length], third = values[(index + 2) % values.Length];
            var row = new[] { first, second, third, first };
            var input = new[] { row, Array.Empty<T>(), new[] { values[0] }, row };
            var output = Call(() => function(input)); Same(output, Reverse(input));
            Check(!ReferenceEquals(output, input)); Check(!ReferenceEquals(output[0], output[3]));
            var expected = Reverse(input); input[0] = Array.Empty<T>(); Same(output, expected);
        }
        Reject<ArgumentNullException>(() => function(null!));
        Reject<ArgumentNullException>(() => function(new T[][] { new[] { values[0] }, null! }));
    }
    static Primitives Interpreted() => new(default, true, byte.MaxValue, ushort.MaxValue, uint.MaxValue, ulong.MaxValue,
        sbyte.MinValue, short.MinValue, int.MinValue, long.MinValue,
        BigInteger.One << 200, -(BigInteger.One << 200), -0.0f, 3.25, "🌱\0", new byte[] { 255, 0, 128 }, new Rune(0x1f331), ulong.MaxValue, int.MinValue);
    static bool InspectArrays(Primitives value) => Call(() => Api.ArrayCheckElements(
        new[] { value.Unit }, new[] { value.Flag }, new[] { value.U8 }, new[] { value.U16 }, new[] { value.U32 }, new[] { value.U64 },
        new[] { value.I8 }, new[] { value.I16 }, new[] { value.I32 }, new[] { value.I64 }, new[] { value.Natural }, new[] { value.Integer },
        new[] { value.F32 }, new[] { value.F64 }, new[] { value.Text }, new[] { value.Bytes }, new[] { value.Char }, new[] { value.Usize }, new[] { value.Isize }));
    static Packet Parcel() => new("parcel\0", new[] { new[] { Interpreted() }, Array.Empty<Primitives>(), new[] { Interpreted(), Interpreted() } },
        new Empty(), new Single(ulong.MaxValue), new Count(BigInteger.One << 5120), new Pair(uint.MaxValue, "a\0"), new Reversed("b\0", uint.MaxValue));
    static Packet Shuffled(Packet value) => value with
    {
        Label = value.Label + "!", Values = Reverse(value.Values), Single = new Single(unchecked(value.Single.Value + 1)),
        Count = new Count(value.Count.Value + 7), Pair = new Pair(unchecked(value.Pair.First + 1), value.Pair.Second + "p"),
        Reversed = new Reversed(value.Reversed.Second + "r", unchecked(value.Reversed.First + 2))
    };
    static void Declarations()
    {
        foreach (var entry in Fields)
        {
            var constructor = entry.Key.GetConstructors().Single();
            Check(constructor.GetParameters().Select(parameter => parameter.Name).SequenceEqual(entry.Value));
            foreach (var parameter in constructor.GetParameters())
            {
                var property = entry.Key.GetProperty(parameter.Name!)!;
                Check(property.PropertyType == parameter.ParameterType);
                Check(property.SetMethod!.ReturnParameter.GetRequiredCustomModifiers().Contains(typeof(System.Runtime.CompilerServices.IsExternalInit)));
            }
        }
        Check(typeof(Api).GetMethod(nameof(Api.Deep))!.ReturnType == typeof(Deep));
        Check(typeof(Api).GetMethod(nameof(Api.Deep))!.GetParameters().Single().ParameterType == typeof(Deep));
    }
    static void Run()
    {
        Declarations();
        var huge = (BigInteger.One << 5120) + (BigInteger.One << 255) + 17;
        Arrays(Api.ArrayReverseUnit, new[] { default(Unit) }); Arrays(Api.ArrayReverseBool, new[] { false, true });
        Arrays(Api.ArrayReverseUint8, new byte[] { 0, 1, 255 }); Arrays(Api.ArrayReverseUint16, new ushort[] { 0, 1, 65535 });
        Arrays(Api.ArrayReverseUint32, new uint[] { 0, 1, uint.MaxValue });
        Arrays(Api.ArrayReverseUint64, new[] { 0ul, 1ul, (1ul << 53) + 1, ulong.MaxValue });
        Arrays(Api.ArrayReverseInt8, new sbyte[] { sbyte.MinValue, -1, 0, sbyte.MaxValue });
        Arrays(Api.ArrayReverseInt16, new short[] { short.MinValue, -1, 0, short.MaxValue });
        Arrays(Api.ArrayReverseInt32, new[] { int.MinValue, -1, 0, int.MaxValue });
        Arrays(Api.ArrayReverseInt64, new[] { long.MinValue, -1, 0, long.MaxValue });
        Arrays(Api.ArrayReverseNat, new[] { BigInteger.Zero, huge }); Arrays(Api.ArrayReverseInt, new[] { -huge, BigInteger.Zero, huge });
        Arrays(Api.ArrayReverseFloat32, new[] { 0f, -0f, BitConverter.Int32BitsToSingle(1), BitConverter.Int32BitsToSingle(0x007fffff), BitConverter.Int32BitsToSingle(0x00800000), float.MaxValue, float.PositiveInfinity, float.NegativeInfinity, float.NaN });
        Arrays(Api.ArrayReverseFloat64, new[] { 0d, -0d, BitConverter.Int64BitsToDouble(1), BitConverter.Int64BitsToDouble(0x000fffffffffffff), BitConverter.Int64BitsToDouble(0x0010000000000000), double.MaxValue, double.PositiveInfinity, double.NegativeInfinity, double.NaN });
        Arrays(Api.ArrayReverseString, new[] { "", "A\0B🌱", "\ufeffe\u0301", "\U0010ffff" });
        Arrays(Api.ArrayReverseBytes, new[] { Array.Empty<byte>(), new byte[] { 0, 255 }, Enumerable.Range(0, 256).Select(value => (byte)value).ToArray() });
        Arrays(Api.ArrayReverseChar, new[] { new Rune(0), new Rune(0x301), new Rune(0xd7ff), new Rune(0xe000), new Rune(0x1f331), new Rune(0x10ffff) });
        Arrays(Api.ArrayReverseUsize, new[] { 0ul, (1ul << 53) + 1, ulong.MaxValue });
        Arrays(Api.ArrayReverseIsize, new[] { long.MinValue, -(1L << 53) - 1, 0, long.MaxValue });
        for (uint index = 0; index < 128; ++index)
        {
            var a = Interpreted(); var b = a with { U32 = index, Text = $"{index}\0", F32 = float.NaN };
            var c = a with { Natural = huge, Integer = -huge, F64 = double.NaN };
            Same(Call(() => Api.RecordReverse(new[] { a, b, c })), new[] { c, b, a });
        }
        Same(Call(() => Api.RecordReverse(Array.Empty<Primitives>())), Array.Empty<Primitives>());
        var record = Interpreted(); Check(InspectArrays(record)); Check(Call(() => Api.RecordInspect(record)));
        foreach (var changed in new[] {
            record with { Flag = false }, record with { U8 = 0 }, record with { U16 = 0 }, record with { U32 = 0 }, record with { U64 = 0 },
            record with { I8 = 0 }, record with { I16 = 0 }, record with { I32 = 0 }, record with { I64 = 0 },
            record with { Natural = 0 }, record with { Integer = 0 }, record with { F32 = 0 }, record with { F64 = 0 },
            record with { Text = "wrong" }, record with { Bytes = Array.Empty<byte>() }, record with { Char = new Rune(0) },
            record with { Usize = 0 }, record with { Isize = 0 } })
        {
            // C# value equality treats signed zeros as equal; the Lean oracle checks their bits.
            bool onlyZeroSignChanged = BitConverter.SingleToInt32Bits(changed.F32) == 0;
            Check((record == changed) == onlyZeroSignChanged);
            if (onlyZeroSignChanged) Check(record.GetHashCode() == changed.GetHashCode());
            Check(!InspectArrays(changed)); Check(!Call(() => Api.RecordInspect(changed)));
        }
        Same(Call(() => Api.ArrayAdd(7, new[] { new[] { -huge, huge }, Array.Empty<BigInteger>() })), new[] { new[] { -huge + 7, huge + 7 }, Array.Empty<BigInteger>() });
        Same(Call(() => Api.ArrayTotal(new[] { new[] { huge, BigInteger.One }, Array.Empty<BigInteger>(), new[] { huge } })), 2 * huge + 1);
        Same(Call(() => Api.ArrayTotal(Array.Empty<BigInteger[]>())), BigInteger.Zero);
        Same(Call(Api.ArrayWords), new[] { new[] { "\ufeffLean", "🌱\0" }, Array.Empty<string>() });
        Same(Call(() => Api.ArraySize(new Unit[2])), 2ul); Same(Call(() => Api.ArraySize(Array.Empty<Unit>())), 0ul);
        Same(Call(() => Api.RecordEmpty(new Empty())), new Empty());
        Same(Call(() => Api.RecordSingle(new Single(ulong.MaxValue))), new Single(0));
        Same(Call(() => Api.RecordCount(new Count(huge))), new Count(huge + 1));
        Same(Call(Api.RecordMake), new Pair(42, "\ufeff🌱\0"));
        for (int index = 0; index < 32; ++index)
        {
            var input = Parcel(); var original = Parcel(); var expected = Shuffled(Parcel());
            var output = Call(() => Api.RecordShuffle(input)); Same(output, expected);
            var copies = Call(() => Api.RecordDuplicate(input)); Same(copies, new[] { original, original });
            Check(!ReferenceEquals(copies[0], copies[1]) && !ReferenceEquals(copies[0].Values[0][0].Bytes, copies[1].Values[0][0].Bytes));
            input.Values[0][0].Bytes[0] = 7; Same(output, expected); Same(copies[0], original);
            copies[0].Values[0][0].Bytes[0] = 9; Same(copies[1], original);
            output.Values[0][0].Bytes[0] = 11; Same(copies[1], original);
        }
        var bytes = new[] { new byte[] { 0, 255 } }; var duplicated = Call(() => Api.ArrayDuplicate(bytes));
        Same(duplicated, new[] { new byte[] { 0, 255 }, new byte[] { 0, 255 } });
        bytes[0][0] = 7; duplicated[0][0] = 9; Same(duplicated[1], new byte[] { 0, 255 });
        object deep = 42u;
        for (int i = 0; i < 24; ++i) { var outer = Array.CreateInstance(deep.GetType(), 1); outer.SetValue(deep, 0); deep = outer; }
        Same(Call(() => Api.Deep((Deep)deep)), deep);
        for (int depth = 0; depth < 24; ++depth)
        {
            Type child = typeof(uint); for (int i = 0; i < 23 - depth; ++i) child = child.MakeArrayType();
            object empty = Array.CreateInstance(child, 0);
            for (int i = 0; i < depth; ++i) { var outer = Array.CreateInstance(empty.GetType(), 1); outer.SetValue(empty, 0); empty = outer; }
            Same(Call(() => Api.Deep((Deep)empty)), empty);
        }
        Reject<ArgumentNullException>(() => Api.RecordShuffle(null!));
        Reject<ArgumentNullException>(() => Api.RecordReverse(new[] { record, null! }));
        Reject<ArgumentNullException>(() => Api.RecordShuffle(Parcel() with { Pair = null! }));
        Reject<ArgumentOutOfRangeException>(() => Api.RecordShuffle(Parcel() with { Count = new Count(-1) }));
        Reject<ArgumentOutOfRangeException>(() => Api.ArrayReverseNat(new[] { new[] { huge, -BigInteger.One } }));
        Reject<EncoderFallbackException>(() => Api.ArrayReverseString(new[] { new[] { "allocated", "\ud800" } }));
        Reject<EncoderFallbackException>(() => Api.RecordShuffle(Parcel() with { Pair = new Pair(1, "\udfff") }));
        for (int repeat = 0; repeat < 3; ++repeat)
        {
            Reject<ArgumentException>(() => Api.ArrayReverseBytes(new[] { new[] { new byte[16 * 1024 * 1024] } }));
            Reject<ArgumentException>(() => Api.ArraySize(new Unit[2_097_153]));
            Reject<ArgumentException>(() => Api.ArrayDuplicate(new[] { new byte[6 * 1024 * 1024] }));
            Reject<ArgumentException>(() => Api.Generate(17 * 1024 * 1024));
        }
        Same(Call(() => Api.Generate(30_000)), new Unit[30_000]);
        var pair = new Pair(42, "value"); Check(pair == new Pair(42, "value")); Check(pair.GetHashCode() == new Pair(42, "value").GetHashCode());
        Parallel.For(0, 4, thread => {
            for (uint index = 0; index < 64; ++index)
            {
                Same(Call(() => Api.ArrayReverseUint32(new[] { new[] { (uint)thread, index } })), new[] { new[] { index, (uint)thread } });
                var input = Parcel(); Same(Call(() => Api.RecordShuffle(input)), Shuffled(input));
            }
        });
        Console.WriteLine($"collections-dotnet-ok:{checks}:{calls}:{rejected}");
    }
    static int Main()
    {
        try { Run(); return 0; }
        catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }
}
