// Host-side conversion tests. No Lean library or algorithm is loaded.
using System;
using System.Collections.Generic;
using System.Numerics;
using System.Reflection;
using System.Runtime.ExceptionServices;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using LeanBridge.Collections;
using LeanBridge.Collections.Interop;
using Single = LeanBridge.Collections.Single;

static unsafe class Program
{
    static int checks, rejected;
    static Dictionary<string, int> indices = new();
    static readonly Type RuntimeType = typeof(Api).Assembly.GetType("LeanBridge.Collections.Interop.Runtime")!;
    static readonly Dictionary<Type, string[]> Fields = new()
    {
        [typeof(Primitives)] = new[] { "Unit", "Flag", "U8", "U16", "U32", "U64", "I8", "I16", "I32", "I64", "Natural", "Integer", "F32", "F64", "Text", "Bytes", "Char", "Usize", "Isize" },
        [typeof(Empty)] = Array.Empty<string>(), [typeof(Single)] = new[] { "Value" },
        [typeof(Count)] = new[] { "Value" }, [typeof(Pair)] = new[] { "First", "Second" },
        [typeof(Reversed)] = new[] { "Second", "First" },
        [typeof(Packet)] = new[] { "Label", "Values", "Empty", "Single", "Count", "Pair", "Reversed" }
    };
    static void Check(bool value) { ++checks; if (!value) throw new Exception("collection conversion check failed"); }
    static MethodInfo Method(string prefix, string name) => RuntimeType.GetMethod(prefix + indices[name], BindingFlags.Static | BindingFlags.NonPublic)!;
    static object Invoke(MethodInfo method, params object[] values)
    {
        try { return method.Invoke(null, values)!; }
        catch (TargetInvocationException error) when (error.InnerException is not null)
        { ExceptionDispatchInfo.Capture(error.InnerException).Throw(); throw; }
    }
    static void Same(object? actual, object? expected)
    {
        Check(actual is not null && expected is not null);
        Check(actual!.GetType() == expected!.GetType());
        if (expected is float f) Check(float.IsNaN(f) ? float.IsNaN((float)actual) : BitConverter.SingleToInt32Bits(f) == BitConverter.SingleToInt32Bits((float)actual));
        else if (expected is double d) Check(double.IsNaN(d) ? double.IsNaN((double)actual) : BitConverter.DoubleToInt64Bits(d) == BitConverter.DoubleToInt64Bits((double)actual));
        else if (expected is Array values)
        {
            var result = (Array)actual; Check(result.Length == values.Length);
            for (int i = 0; i < values.Length; ++i) Same(result.GetValue(i), values.GetValue(i));
        }
        else if (Fields.TryGetValue(expected.GetType(), out var fields))
        {
            foreach (var name in fields) Same(expected.GetType().GetProperty(name)!.GetValue(actual), expected.GetType().GetProperty(name)!.GetValue(expected));
        }
        else Check(actual.Equals(expected));
    }
    static object Encode(string name, object value, Scope scope)
    {
        var method = Method("To", name);
        return method.GetParameters().Length == 1 ? Invoke(method, value) : Invoke(method, value, scope);
    }
    static T Roundtrip<T>(string name, T value) where T : notnull
    {
        using var scope = new Scope();
        return (T)Invoke(Method("From", name), Encode(name, value, scope));
    }
    static void Samples<T>(string name, T[] values)
    {
        Same(Roundtrip(name, Array.Empty<T[]>()), Array.Empty<T[]>());
        Same(Roundtrip(name, new[] { Array.Empty<T>() }), new[] { Array.Empty<T>() });
        for (int index = 0; index < 32; ++index)
        {
            T first = values[index % values.Length], second = values[(index + 1) % values.Length];
            var input = new[] { new[] { first, second, first }, Array.Empty<T>(), new[] { first } };
            var result = Roundtrip(name, input); Same(result, input);
            Check(!ReferenceEquals(result, input) && !ReferenceEquals(result[0], input[0]));
        }
    }
    static Primitives Value() => new(default, true, byte.MaxValue, ushort.MaxValue, uint.MaxValue, ulong.MaxValue,
        sbyte.MinValue, short.MinValue, int.MinValue, long.MinValue,
        BigInteger.One << 5120, -(BigInteger.One << 5120), -0.0f, 3.25, "\ufeff🌱\0", new byte[] { 0, 255, 128 }, new Rune(0x1f331), ulong.MaxValue, long.MinValue);
    static Packet Parcel() => new("parcel\0", new[] { new[] { Value() }, Array.Empty<Primitives>(), new[] { Value(), Value() } },
        new Empty(), new Single(ulong.MaxValue), new Count(BigInteger.One << 5120), new Pair(17, "a\0"), new Reversed("b\0", 23));
    static void Reject<T>(Action action) where T : Exception
    {
        try { action(); }
        catch (T error) { Check(error.GetType() == typeof(T)); ++rejected; return; }
        throw new Exception("expected " + typeof(T).Name);
    }
    static object Native(string name, nint data, nuint length)
    {
        object value = Activator.CreateInstance(Method("From", name).GetParameters()[0].ParameterType)!;
        Set(value, "Data", data); Set(value, "Length", length); return value;
    }
    static void Set(object value, string field, object content) => value.GetType().GetField(field, BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(value, content);
    static void Buffers()
    {
        // These scalar cases fail safely on an adapter that omits validation.
        foreach (byte value in new byte[] { 2, 128, 255 }) Reject<InvalidOperationException>(() => Invoke(Method("From", "bool"), value));
        foreach (byte value in new byte[] { 1, 128, 255 }) Reject<InvalidOperationException>(() => Invoke(Method("From", "unit"), value));
        using var scope = new Scope();
        nint digits = scope.Allocate(2, sizeof(uint));
        foreach (string name in new[] { "string", "bytes", "nat", "int", "words" })
        {
            Reject<InvalidOperationException>(() => Invoke(Method("From", name), Native(name, 0, 1)));
            Reject<ArgumentException>(() => Invoke(Method("From", name), Native(name, 1, nuint.MaxValue)));
            object empty = Invoke(Method("From", name), Native(name, 1, 0));
            Same(empty, name == "string" ? "" : name == "bytes" ? Array.Empty<byte>() : name == "words" ? Array.Empty<uint>() : BigInteger.Zero);
        }
        foreach (string name in new[] { "nat", "int", "words" })
            Reject<InvalidOperationException>(() => Invoke(Method("From", name), Native(name, digits + 1, 1)));
        foreach (string name in new[] { "nat", "int" })
        {
            Reject<InvalidOperationException>(() => Invoke(Method("From", name), Native(name, digits, 1)));
            ((uint*)digits)[0] = 7;
            Reject<InvalidOperationException>(() => Invoke(Method("From", name), Native(name, digits, 2)));
            ((uint*)digits)[0] = 0;
        }
        var sign = Native("int", 0, 0); Set(sign, "Negative", (byte)1);
        Reject<InvalidOperationException>(() => Invoke(Method("From", "int"), sign));
        sign = Native("int", digits, 1); Set(sign, "Negative", (byte)2);
        Reject<InvalidOperationException>(() => Invoke(Method("From", "int"), sign));
        ((byte*)digits)[0] = 255;
        Reject<DecoderFallbackException>(() => Invoke(Method("From", "string"), Native("string", digits, 1)));
        foreach (uint value in new uint[] { 0xd800, 0xdfff, 0x110000 })
            Reject<ArgumentOutOfRangeException>(() => Invoke(Method("From", "char"), value));
        var record = Encode("record", Value(), scope); Set(record, "F1", (byte)2);
        Reject<InvalidOperationException>(() => Invoke(Method("From", "record"), record));
        record = Encode("record", Value(), scope); Set(record, "F0", (byte)1);
        Reject<InvalidOperationException>(() => Invoke(Method("From", "record"), record));
    }
    static void Inputs()
    {
        for (int i = 0; i < 16; ++i)
        {
            Reject<ArgumentNullException>(() => Roundtrip("array_reverse_string", new[] { new[] { "allocated", null! } }));
            Reject<ArgumentNullException>(() => Roundtrip("array_reverse_uint32", new uint[][] { new uint[] { 1, 2 }, null! }));
            Reject<ArgumentOutOfRangeException>(() => Roundtrip("array_reverse_nat", new[] { new[] { BigInteger.One << 5120, -BigInteger.One } }));
            Reject<EncoderFallbackException>(() => Roundtrip("packet", Parcel() with { Pair = new Pair(1, "\ud800") }));
            Same(Roundtrip("packet", Parcel()), Parcel());
        }
        Reject<ArgumentException>(() => Roundtrip("array_reverse_bytes", new[] { new[] { new byte[16 * 1024 * 1024] } }));
        Reject<ArgumentException>(() => Roundtrip("array_reverse_unit", new[] { new Unit[2_097_153] }));
    }
    static void Run(string[] args)
    {
        indices = JsonSerializer.Deserialize<Dictionary<string, int>>(args[0])!;
        var huge = (BigInteger.One << 5120) + 17;
        Samples("array_reverse_unit", new[] { default(Unit) });
        Samples("array_reverse_bool", new[] { false, true });
        Samples("array_reverse_uint8", new byte[] { 0, 1, 255 });
        Samples("array_reverse_uint16", new ushort[] { 0, 1, 65535 });
        Samples("array_reverse_uint32", new uint[] { 0, 1, uint.MaxValue });
        Samples("array_reverse_uint64", new ulong[] { 0, 1, (1ul << 53) + 1, ulong.MaxValue });
        Samples("array_reverse_int8", new sbyte[] { sbyte.MinValue, -1, 0, sbyte.MaxValue });
        Samples("array_reverse_int16", new short[] { short.MinValue, -1, 0, short.MaxValue });
        Samples("array_reverse_int32", new[] { int.MinValue, -1, 0, int.MaxValue });
        Samples("array_reverse_int64", new[] { long.MinValue, -1, 0, long.MaxValue });
        Samples("array_reverse_nat", new[] { BigInteger.Zero, huge });
        Samples("array_reverse_int", new[] { -huge, BigInteger.Zero, huge });
        Samples("array_reverse_float32", new[] { 0.0f, -0.0f, BitConverter.Int32BitsToSingle(1), BitConverter.Int32BitsToSingle(0x007fffff), float.MaxValue, float.PositiveInfinity, float.NegativeInfinity, float.NaN });
        Samples("array_reverse_float64", new[] { 0.0, -0.0, BitConverter.Int64BitsToDouble(1), BitConverter.Int64BitsToDouble(0x000fffffffffffff), double.MaxValue, double.PositiveInfinity, double.NegativeInfinity, double.NaN });
        Samples("array_reverse_string", new[] { "", "A\0B🌱", "\ufeffe\u0301", "\U0010ffff" });
        Samples("array_reverse_bytes", new[] { Array.Empty<byte>(), new byte[] { 0, 255 }, new byte[] { 128, 0, 1 } });
        Samples("array_reverse_char", new[] { new Rune(0), new Rune(0x1f331), new Rune(0xd7ff), new Rune(0xe000), new Rune(0x10ffff) });
        Samples("array_reverse_usize", new[] { 0ul, (1ul << 53) + 1, ulong.MaxValue });
        Samples("array_reverse_isize", new[] { long.MinValue, -(1L << 53) - 1, 0, long.MaxValue });
        var input = Parcel(); var original = Parcel(); var output = Roundtrip("packet", input);
        Same(output, original);
        input.Values[0][0].Bytes[0] = 7; Same(output, original);
        output.Values[2][0].Bytes[0] = 9;
        Same(output.Values[2][1], original.Values[2][1]); Same(input.Values[2][0], original.Values[2][0]);
        object deep = 42u;
        for (int i = 0; i < 24; ++i) { var outer = Array.CreateInstance(deep.GetType(), 1); outer.SetValue(deep, 0); deep = outer; }
        Same(Roundtrip("deep", deep), deep);
        for (int depth = 0; depth < 24; ++depth)
        {
            Type child = typeof(uint); for (int i = 0; i < 23 - depth; ++i) child = child.MakeArrayType();
            object empty = Array.CreateInstance(child, 0);
            for (int i = 0; i < depth; ++i) { var outer = Array.CreateInstance(empty.GetType(), 1); outer.SetValue(empty, 0); empty = outer; }
            Same(Roundtrip("deep", empty), empty);
        }
        Buffers(); Inputs();
        Console.WriteLine(JsonSerializer.Serialize(new { checks, rejected, primitiveShapes = 19, records = 7, fixedArrayDepth = 24 }));
    }
    static int Main(string[] args)
    {
        try { Run(args); return 0; }
        catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }
}
