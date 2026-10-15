#define RESULT_ONLY
// Independent public caller. Generated equality and serialization are not oracles.
using System;
using System.Collections;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Numerics;
using System.Runtime.CompilerServices;
using System.Text;
using LeanBridge.Nominalprimitivesubtypes;
using Branch = LeanBridge.Nominalprimitivesubtypes.Result<LeanBridge.Nominalprimitivesubtypes.Packet, LeanBridge.Nominalprimitivesubtypes.Packet>;
using Choice = LeanBridge.Nominalprimitivesubtypes.Option<LeanBridge.Nominalprimitivesubtypes.Result<LeanBridge.Nominalprimitivesubtypes.Packet, LeanBridge.Nominalprimitivesubtypes.Packet>>;

static class Consumer
{
    static int checks, rejections = 0, hostRejections, snapshotControls;
    static BigInteger N(long value) => new(value);
    static BigInteger Huge() => BigInteger.One << 100;

    static void WriteSnapshot(BinaryWriter writer, object? value)
    {
        if (value is null) { writer.Write("null"); return; }
        writer.Write(value.GetType().FullName!);
        switch (value)
        {
            case Unit: return;
            case bool item: writer.Write(item); return;
            case byte item: writer.Write(item); return;
            case ushort item: writer.Write(item); return;
            case uint item: writer.Write(item); return;
            case ulong item: writer.Write(item); return;
            case sbyte item: writer.Write(item); return;
            case short item: writer.Write(item); return;
            case int item: writer.Write(item); return;
            case long item: writer.Write(item); return;
            case float item: writer.Write(BitConverter.SingleToUInt32Bits(item)); return;
            case double item: writer.Write(BitConverter.DoubleToUInt64Bits(item)); return;
            case BigInteger item:
            {
                byte[] bytes = item.ToByteArray(); writer.Write(bytes.Length); writer.Write(bytes); return;
            }
            case string item:
            {
                byte[] bytes = Encoding.UTF8.GetBytes(item); writer.Write(bytes.Length); writer.Write(bytes); return;
            }
            case Rune item: writer.Write(item.Value); return;
            case Packet item:
                WriteFields(writer, item.UnitValue, item.BoolValue, item.Uint8Value, item.Uint16Value,
                    item.Uint32Value, item.Uint64Value, item.Int8Value, item.Int16Value, item.Int32Value,
                    item.Int64Value, item.NatValue, item.IntValue, item.Float32Value, item.Float64Value,
                    item.TextValue, item.BytesValue, item.CharValue, item.UsizeValue, item.IsizeValue, item.Digit);
                return;
            case RawPacket item:
                WriteFields(writer, item.UnitValue, item.BoolValue, item.Uint8Value, item.Uint16Value,
                    item.Uint32Value, item.Uint64Value, item.Int8Value, item.Int16Value, item.Int32Value,
                    item.Int64Value, item.NatValue, item.IntValue, item.Float32Value, item.Float64Value,
                    item.TextValue, item.BytesValue, item.CharValue, item.UsizeValue, item.IsizeValue, item.Digit);
                return;
            case Pair item: WriteSnapshot(writer, item.Left); WriteSnapshot(writer, item.Right); return;
            case EventEmpty: return;
            case EventBox item: WriteSnapshot(writer, item.Value); return;
            case EventChoices item: WriteSnapshot(writer, item.Values); return;
            case Array item:
                writer.Write(item.Rank); writer.Write(item.Length);
                foreach (object? member in item) WriteSnapshot(writer, member);
                return;
            case ITuple item:
                writer.Write(item.Length);
                for (int index = 0; index < item.Length; ++index) WriteSnapshot(writer, item[index]);
                return;
        }
        Type type = value.GetType();
        if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Option<>))
        {
            bool present = (bool)type.GetProperty("IsSome")!.GetValue(value)!; writer.Write(present);
            if (present) WriteSnapshot(writer, type.GetProperty("Value")!.GetValue(value));
            return;
        }
        if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Result<,>))
        {
            bool initialized = (bool)type.GetProperty("IsInitialized")!.GetValue(value)!; writer.Write(initialized);
            if (initialized)
            {
                bool ok = (bool)type.GetProperty("IsOk")!.GetValue(value)!; writer.Write(ok);
                WriteSnapshot(writer, type.GetProperty(ok ? "Value" : "Error")!.GetValue(value));
            }
            return;
        }
        throw new InvalidOperationException("unsupported snapshot type: " + type.FullName);
    }

    static void WriteFields(BinaryWriter writer, params object?[] fields)
    {
        writer.Write(fields.Length);
        foreach (object? field in fields) WriteSnapshot(writer, field);
    }

    static string Snapshot(object? value)
    {
        using var stream = new MemoryStream();
        using (var writer = new BinaryWriter(stream, Encoding.UTF8, true)) WriteSnapshot(writer, value);
        return Convert.ToHexString(stream.ToArray());
    }

    static void Check(bool condition, string label)
    {
        if (!condition) throw new InvalidOperationException("failed: " + label);
        ++checks;
    }

    static O Call<I, O>(I input, Func<I, O> invoke, O expected)
    {
        string before = Snapshot(input); O output = invoke(input);
        Check(Snapshot(output) == Snapshot(expected), "exact independent result");
        Check(Snapshot(input) == before, "complete accepted inputs unchanged");
        return output;
    }

#if !RESULT_ONLY
    static void Refused<I, O>(I input, Func<I, O> invoke, string expected)
    {
        string before = Snapshot(input);
        try { invoke(input); throw new InvalidOperationException("accepted: " + expected); }
        catch (ArgumentException error)
        {
            Check(error.GetType() == typeof(ArgumentException) && error.Message == expected && error.ParamName is null,
                "exact refusal: expected " + expected + "; got " + error.Message);
        }
        Check(Snapshot(input) == before, "complete refused inputs unchanged");
        ++rejections;
    }
#endif

    static void RefusedHost<I, O>(I input, Func<I, O> invoke, Type expected)
    {
        string before = Snapshot(input);
        try { invoke(input); throw new InvalidOperationException("accepted invalid managed input"); }
        catch (ArgumentException error)
        {
            Check(error.GetType() == expected && error.ParamName == "value",
                "managed rejection type and parameter: " + error);
        }
        Check(Snapshot(input) == before, "complete managed-rejected input unchanged");
        ++hostRejections;
    }

    static void Distinct(object? left, object? right)
    {
        Check(Snapshot(left) != Snapshot(right), "independent snapshot mutation control");
        ++snapshotControls;
    }

    static Packet Packet() => new(new Unit(), true,
        42, 42, 42, 42, -42, -42, -42, -42,
        N(42), N(-42), 1.5f, 1.5, "a", new byte[] { 0, 128, 255 }, new Rune('a'),
        42, -42, N(2));

    static RawPacket Raw(Packet value) => new(value.UnitValue, value.BoolValue,
        value.Uint8Value, value.Uint16Value, value.Uint32Value, value.Uint64Value,
        value.Int8Value, value.Int16Value, value.Int32Value, value.Int64Value,
        value.NatValue, value.IntValue, value.Float32Value, value.Float64Value,
        value.TextValue, value.BytesValue, value.CharValue, value.UsizeValue, value.IsizeValue, value.Digit);

    static Packet Produced() => Packet() with {
        Uint8Value = 200, Uint16Value = 200, Uint32Value = 200, Uint64Value = 200,
        Int8Value = 120, Int16Value = 120, Int32Value = 120, Int64Value = 120,
        NatValue = Huge(), IntValue = -Huge(), Float32Value = 12.5f, Float64Value = 12.5,
        TextValue = "long λ text", BytesValue = new byte[] { 0, 1, 2, 3, 4, 5, 128, 254, 255 },
        CharValue = new Rune('λ'), UsizeValue = 200, IsizeValue = 200
    };

#if !RESULT_ONLY
    static Packet Normalized() => Packet() with {
        Uint8Value = 44, Uint16Value = 44, Uint32Value = 44, Uint64Value = 44,
        Int8Value = -40, Int16Value = -40, Int32Value = -40, Int64Value = -40,
        NatValue = N(44), IntValue = N(-40), Float32Value = -1.5f, Float64Value = -1.5,
        TextValue = "a!", BytesValue = new byte[] { 0, 128, 255, 255 }, CharValue = new Rune('b'),
        UsizeValue = 44, IsizeValue = -40
    };
#endif

    static (string Field, string Constructor, Packet Value)[] BadValues()
    {
        Packet value = Packet();
        return new[] {
            ("boolValue", "boolA", value with { BoolValue = false }),
            ("uint8Value", "uint8A", value with { Uint8Value = 43 }),
            ("uint16Value", "uint16A", value with { Uint16Value = 43 }),
            ("uint32Value", "uint32A", value with { Uint32Value = 43 }),
            ("uint64Value", "uint64A", value with { Uint64Value = 43 }),
            ("int8Value", "int8A", value with { Int8Value = -43 }),
            ("int16Value", "int16A", value with { Int16Value = -43 }),
            ("int32Value", "int32A", value with { Int32Value = -43 }),
            ("int64Value", "int64A", value with { Int64Value = -43 }),
            ("natValue", "natA", value with { NatValue = N(43) }),
            ("intValue", "intA", value with { IntValue = N(-43) }),
            ("float32Value", "float32A", value with { Float32Value = float.PositiveInfinity }),
            ("float64Value", "float64A", value with { Float64Value = double.PositiveInfinity }),
            ("textValue", "textA", value with { TextValue = "" }),
            ("bytesValue", "bytesA", value with { BytesValue = Array.Empty<byte>() }),
            ("charValue", "charA", value with { CharValue = new Rune('\0') }),
            ("usizeValue", "usizeA", value with { UsizeValue = 43 }),
            ("isizeValue", "isizeA", value with { IsizeValue = -43 }),
            ("digit", "", value with { Digit = N(3) })
        };
    }

#if !RESULT_ONLY
    static string Prefix() =>
#if REVIEWED
        "value";
#else
        "arg";
#endif
    static string Subtype(string path, string constructor) => path + " was rejected by NominalPrimitiveSubtypes." + constructor;
    static string Fin(string path) => path + " is not below its Fin 3 bound";
#endif

    static int Main(string[] arguments)
    {
        try
        {
            if (arguments.Length == 1 && arguments[0] == "--runtime")
            {
                Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new {
                    version = Environment.Version.ToString(),
                    description = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription,
                    directory = System.Runtime.InteropServices.RuntimeEnvironment.GetRuntimeDirectory(),
                    command = Environment.ProcessPath,
                    architecture = System.Runtime.InteropServices.RuntimeInformation.ProcessArchitecture.ToString(),
                    os = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
                    littleEndian = BitConverter.IsLittleEndian
                }));
                return 0;
            }
            if (arguments.Length != 0) throw new InvalidOperationException("Unexpected caller arguments");
            Run(); return 0;
        }
        catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }

    static void Run()
    {
        Check(IntPtr.Size == 8, "native machine-word width");
        Call(new Unit(), _ => Api.WordBits(), 64u);
        foreach (var (_, _, changed) in BadValues()) Distinct(Packet(), changed);
        Distinct(new Unit(), null);
        Distinct(Option<Unit>.None, Option<Unit>.Some(new Unit()));
        Distinct((byte)0, (ushort)0);
        Distinct(BigInteger.Zero, 0);
        Distinct(0.0f, -0.0f);
        Distinct(0.0, -0.0);
        Distinct("a\0λ😀", "aλ😀");
        Distinct(Packet(), Raw(Packet()));
        Distinct(new[] { Option<Packet>.None, Option<Packet>.Some(Packet()) },
            new[] { Option<Packet>.Some(Packet()), Option<Packet>.None });
        Distinct(Branch.Ok(Packet()), Branch.Err(Packet()));
        Distinct(new EventBox(Packet()), new EventChoices(new[] { Choice.Some(Branch.Ok(Packet())) }));

        Packet output = Produced();
        Call(Raw(Produced()), Api.Produce, Option<Packet>.Some(output));
        Call(Raw(Produced()), Api.ProduceGroup, new[] { Option<Packet>.None, Option<Packet>.Some(output) });
        Call(Raw(Produced()), Api.ProducePair, new Pair(
            new[] { Option<Packet>.None, Option<Packet>.Some(output) },
            new[] { Option<Packet>.None, Option<Packet>.Some(output) }));
        Call<RawPacket, Event>(Raw(Produced()), Api.ProduceEvent, new EventBox(output));
        Call<RawPacket, Event>(Raw(Produced()), Api.ProduceChoices, new EventChoices(new[] {
            Choice.None, Choice.Some(Branch.Ok(output)), Choice.Some(Branch.Err(output))
        }));

        RefusedHost(Raw(Packet() with { NatValue = N(-1) }), Api.Produce, typeof(ArgumentOutOfRangeException));
        foreach (var (field, constructor, changed) in BadValues())
        {
            Call(Raw(changed), Api.Produce, Option<Packet>.None);
#if !RESULT_ONLY
            Refused(changed, Api.EchoA, field == "digit" ? Fin(Prefix() + "0.digit")
                : Subtype(Prefix() + "0." + field, constructor));
#endif
        }
        RawPacket absent = Raw(Packet() with { NatValue = N(43) });
        Call(absent, Api.ProduceGroup, new[] { Option<Packet>.None });
        Call(absent, Api.ProducePair, new Pair(new[] { Option<Packet>.None }, new[] { Option<Packet>.None }));
        Call<RawPacket, Event>(absent, Api.ProduceEvent, new EventEmpty());
        Call<RawPacket, Event>(absent, Api.ProduceChoices, new EventChoices(new[] { Choice.None }));

#if RESULT_ONLY
        for (int round = 0; round < 256; ++round)
        {
            Packet item = Produced() with { NatValue = Huge() + round * 2 };
            Call(Raw(item), Api.Produce, Option<Packet>.Some(item));
        }
#else
        Full();
#endif
        Console.WriteLine($"{{\"checks\":{checks},\"rejections\":{rejections},\"hostRejections\":{hostRejections},\"snapshotControls\":{snapshotControls},\"rounds\":256,\"wordBits\":64}}");
    }

#if !RESULT_ONLY
    static void Full()
    {
        Packet a = Packet(), b = Packet() with { BoolValue = false }, normalized = Normalized();
        RefusedHost<Packet, Packet>(null!, Api.EchoA, typeof(ArgumentNullException));
        RefusedHost<Option<Packet>[], Option<Packet>[]>(null!, value => Api.Aliases(value, Array.Empty<Option<Packet>>()), typeof(ArgumentNullException));
        RefusedHost<Event, Event>(null!, Api.EchoEventA, typeof(ArgumentNullException));
        RefusedHost(a with { NatValue = N(-1) }, Api.EchoA, typeof(ArgumentOutOfRangeException));
        RefusedHost(a with { TextValue = null! }, Api.EchoA, typeof(ArgumentNullException));
        RefusedHost<Event, Event>(new EventChoices(new[] { Choice.Some(default(Branch)) }), Api.EchoEventA, typeof(ArgumentException));

        Packet returned = Call(a, Api.EchoA, a); returned.BytesValue[0] = 17;
        Check(Snapshot(a) == Snapshot(Packet()), "returned mutable buffers own independent storage");
        Call(b, Api.EchoB, normalized);
        var strict = new (Packet Value, string Field, string Constructor)[] {
            (a with { Uint8Value = 100 }, "uint8Value", "uint8A"),
            (a with { Uint16Value = 100 }, "uint16Value", "uint16A"),
            (a with { Uint32Value = 100 }, "uint32Value", "uint32A"),
            (a with { Uint64Value = 100 }, "uint64Value", "uint64A"),
            (a with { Int8Value = 100 }, "int8Value", "int8A"),
            (a with { Int16Value = 100 }, "int16Value", "int16A"),
            (a with { Int32Value = 100 }, "int32Value", "int32A"),
            (a with { Int64Value = 100 }, "int64Value", "int64A"),
            (a with { NatValue = N(100) }, "natValue", "natA"),
            (a with { IntValue = N(100) }, "intValue", "intA"),
            (a with { Float32Value = 12.5f }, "float32Value", "float32A"),
            (a with { Float64Value = 12.5 }, "float64Value", "float64A"),
            (a with { TextValue = "long λ text" }, "textValue", "textA"),
            (a with { BytesValue = Enumerable.Range(0, 8).Select(value => (byte)value).ToArray() }, "bytesValue", "bytesA"),
            (a with { CharValue = new Rune('λ') }, "charValue", "charA"),
            (a with { UsizeValue = 100 }, "usizeValue", "usizeA"),
            (a with { IsizeValue = 100 }, "isizeValue", "isizeA")
        };
        foreach (var (input, field, constructor) in strict)
        {
            Call(Raw(input), Api.Produce, Option<Packet>.Some(input));
            Refused(input, Api.EchoA, Subtype(Prefix() + "0." + field, constructor));
        }
        Refused(a, Api.RefuseUnit, Subtype(Prefix() + "0.unitValue", "unitReject"));
        Call((a, b), value => Api.Combine(value.Item1, value.Item2), (a, normalized));
        Call(new Pair(new[] { Option<Packet>.None, Option<Packet>.Some(a) }, new[] { Option<Packet>.Some(b) }),
            Api.EchoPair, new Pair(new[] { Option<Packet>.None, Option<Packet>.Some(a) }, new[] { Option<Packet>.Some(normalized) }));
        Call((new[] { Option<Packet>.None, Option<Packet>.Some(a) }, new[] { Option<Packet>.Some(b), Option<Packet>.None }),
            value => Api.Aliases(value.Item1, value.Item2),
            new[] { Option<Packet>.None, Option<Packet>.Some(a), Option<Packet>.Some(normalized), Option<Packet>.None });
        Call<Event, Event>(new EventEmpty(), Api.EchoEventA, new EventEmpty());
        Call<Event, Event>(new EventEmpty(), Api.EchoEventB, new EventEmpty());
        Call<Event, Event>(new EventBox(a), Api.EchoEventA, new EventBox(a));
        Call<Event, Event>(new EventBox(b), Api.EchoEventB, new EventBox(normalized));
        Call<Event, Event>(new EventChoices(new[] { Choice.None, Choice.Some(Branch.Ok(a)), Choice.Some(Branch.Err(b)) }),
            Api.EchoEventA, new EventChoices(new[] { Choice.None, Choice.Some(Branch.Ok(a)), Choice.Some(Branch.Err(normalized)) }));
        Call<Event, Event>(new EventChoices(new[] { Choice.None, Choice.Some(Branch.Ok(b)), Choice.Some(Branch.Err(a)) }),
            Api.EchoEventB, new EventChoices(new[] { Choice.None, Choice.Some(Branch.Ok(normalized)), Choice.Some(Branch.Err(a)) }));

        for (int second = 0; second < 2; ++second)
        {
            Func<Event, Event> echo = second == 1 ? Api.EchoEventB : Api.EchoEventA;
            Packet firstInput = second == 1 ? b : a, lastInput = second == 1 ? a : b;
            Packet firstOutput = second == 1 ? normalized : a, lastOutput = second == 1 ? a : normalized;
            Refused<Event, Event>(new EventBox(firstInput with { NatValue = N(43) }), echo,
                Subtype(Prefix() + "0.box.value.natValue", second == 1 ? "natB" : "natA"));
            Call<Event, Event>(new EventBox(firstInput), echo, new EventBox(firstOutput));
            for (int branch = 0; branch < 2; ++branch)
            {
                Choice[] values = { Choice.None, Choice.Some(Branch.Ok(firstInput)), Choice.Some(Branch.Err(lastInput)) };
                Packet selected = branch == 1 ? lastInput : firstInput;
                Packet bad = selected with { NatValue = N(43) }; int position = branch == 1 ? 2 : 1;
                values[position] = Choice.Some(branch == 1 ? Branch.Err(bad) : Branch.Ok(bad));
                Refused<Event, Event>(new EventChoices(values), echo,
                    Subtype($"{Prefix()}0.choices.values[{position}]?.{(branch == 1 ? "error" : "ok")}.natValue",
                        (second == 1) != (branch == 1) ? "natB" : "natA"));
                Call<Event, Event>(new EventChoices(new[] { Choice.None, Choice.Some(Branch.Ok(firstInput)), Choice.Some(Branch.Err(lastInput)) }),
                    echo, new EventChoices(new[] { Choice.None, Choice.Some(Branch.Ok(firstOutput)), Choice.Some(Branch.Err(lastOutput)) }));
            }
        }

        var edges = new (Packet Input, Packet Output)[] {
            (b with { Uint8Value = byte.MaxValue - 1 }, normalized with { Uint8Value = 0 }),
            (b with { Uint16Value = ushort.MaxValue - 1 }, normalized with { Uint16Value = 0 }),
            (b with { Uint32Value = uint.MaxValue - 1 }, normalized with { Uint32Value = 0 }),
            (b with { Uint64Value = ulong.MaxValue - 1 }, normalized with { Uint64Value = 0 }),
            (b with { Int8Value = sbyte.MaxValue - 1 }, normalized with { Int8Value = sbyte.MinValue }),
            (b with { Int16Value = short.MaxValue - 1 }, normalized with { Int16Value = short.MinValue }),
            (b with { Int32Value = int.MaxValue - 1 }, normalized with { Int32Value = int.MinValue }),
            (b with { Int64Value = long.MaxValue - 1 }, normalized with { Int64Value = long.MinValue }),
            (b with { UsizeValue = ulong.MaxValue - 1 }, normalized with { UsizeValue = 0 }),
            (b with { IsizeValue = long.MaxValue - 1 }, normalized with { IsizeValue = long.MinValue }),
            (b with { NatValue = Huge() }, normalized with { NatValue = Huge() + 2 }),
            (b with { IntValue = -Huge() }, normalized with { IntValue = -Huge() + 2 }),
            (b with { Float32Value = 0.0f }, normalized with { Float32Value = -0.0f }),
            (b with { Float64Value = 0.0 }, normalized with { Float64Value = -0.0 }),
            (b with { Float32Value = -0.0f }, normalized with { Float32Value = 0.0f }),
            (b with { Float64Value = -0.0 }, normalized with { Float64Value = 0.0 }),
            (b with { TextValue = "a\0λ😀" }, normalized with { TextValue = "a\0λ😀!" }),
            (b with { BytesValue = Array.Empty<byte>() }, normalized with { BytesValue = new byte[] { 255 } }),
            (b with { CharValue = new Rune(0x1F600) }, normalized with { CharValue = new Rune(0x1F600) })
        };
        foreach (var edge in edges) Call(edge.Input, Api.EchoB, edge.Output);
        foreach (float value in new[] { float.NaN, float.PositiveInfinity, float.NegativeInfinity })
        {
            Refused(b with { Float32Value = value }, Api.EchoB, Subtype(Prefix() + "0.float32Value", "float32B"));
            Call(Raw(Packet() with { Float32Value = value }), Api.Produce, Option<Packet>.None);
        }
        foreach (double value in new[] { double.NaN, double.PositiveInfinity, double.NegativeInfinity })
        {
            Refused(b with { Float64Value = value }, Api.EchoB, Subtype(Prefix() + "0.float64Value", "float64B"));
            Call(Raw(Packet() with { Float64Value = value }), Api.Produce, Option<Packet>.None);
        }
        Refused((a with { NatValue = N(43) }, b with { Digit = N(3) }),
            value => Api.Combine(value.Item1, value.Item2), Fin(Prefix() + "1.digit"));
        for (int round = 0; round < 256; ++round)
        {
            int position = round % 3;
            Option<Packet>[] right = { Option<Packet>.Some(b), Option<Packet>.None, Option<Packet>.Some(b) };
            right[position] = Option<Packet>.Some(b with { NatValue = N(43) });
            Refused(new Pair(new[] { Option<Packet>.Some(a) }, right), Api.EchoPair,
                Subtype($"{Prefix()}0.right[{position}]?.natValue", "natB"));
            Call(b, Api.EchoB, normalized);
        }
    }
#endif
}
