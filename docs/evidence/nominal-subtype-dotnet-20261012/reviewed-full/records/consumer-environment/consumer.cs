// Independent public caller. Generated equality and serialization are not oracles.
using System;
using System.Globalization;
using System.Linq;
using System.Numerics;
using System.Runtime.CompilerServices;
using LeanBridge.Nominalsubtypes;
using Choice = LeanBridge.Nominalsubtypes.Option<LeanBridge.Nominalsubtypes.Result<System.Numerics.BigInteger, System.Numerics.BigInteger>>;
using Branch = LeanBridge.Nominalsubtypes.Result<System.Numerics.BigInteger, System.Numerics.BigInteger>;
using Item = LeanBridge.Nominalsubtypes.Option<LeanBridge.Nominalsubtypes.Envelope>;

static class Consumer
{
    static int checks = 0, rejections = 0, hostRejections = 0, snapshotControls = 0;
    static BigInteger N(int value) => new(value);
    static Envelope Wrap(int value) => new(N(value), N(2));
    static Item[] Values(BigInteger value) => new[] { Item.None, Item.Some(new Envelope(value + 1, N(2))) };
    static string Node(string tag, params object?[] fields)
    {
        var parts = fields.Select(Snapshot).ToArray();
        return tag + "[" + parts.Length.ToString(CultureInfo.InvariantCulture) + ":"
            + string.Concat(parts.Select(part => part.Length.ToString(CultureInfo.InvariantCulture) + ":" + part)) + "]";
    }
    static string Snapshot(object? value) => value switch
    {
        null => "null",
        BigInteger number => "integer:" + Convert.ToHexString(number.ToByteArray()),
        Envelope item => Node("Envelope", item.Payload, item.Digit),
        AliasPair pair => Node("AliasPair", pair.Left, pair.Right),
#if !RESULT_ONLY
        Pair pair => Node("Pair", pair.Left, pair.Right),
#endif
        EventEmpty => Node("Event.empty"),
        EventBox item => Node("Event.box", item.Value),
        EventChoices items => Node("Event.choices", (object)items.Values),
        Item item => item.IsSome ? Node("some", item.Value) : Node("none"),
        Choice item => item.IsSome ? Node("some", item.Value) : Node("none"),
        Option<BigInteger> item => item.IsSome ? Node("some", item.Value) : Node("none"),
        Branch branch => branch.IsOk ? Node("ok", branch.Value)
            : branch.IsError ? Node("error", branch.Error) : Node("uninitialized"),
        Array array => Node("sequence", array.Cast<object?>().ToArray()),
        ITuple tuple => Node("product", Enumerable.Range(0, tuple.Length).Select(index => tuple[index]).ToArray()),
        _ => throw new InvalidOperationException("Unknown snapshot type: " + value.GetType().FullName)
    };
    static void Check(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException("failed: " + message);
        checks++;
    }
    static O Call<I, O>(I input, Func<I, O> call, O expected)
    {
        var before = Snapshot(input);
        var result = call(input);
        Check(Snapshot(result) == Snapshot(expected), "exact copied result");
        Check(Snapshot(input) == before, "complete accepted input unchanged");
        return result;
    }
    static void RefusedHost<I, O>(I input, Func<I, O> call, Type expected)
    {
        var before = Snapshot(input);
        try { call(input); throw new InvalidOperationException("accepted: invalid managed input"); }
        catch (ArgumentException error)
        {
            Check(error.GetType() == expected && error.ParamName == "value", "managed input rejection type and parameter");
        }
        Check(Snapshot(input) == before, "complete managed-rejected input unchanged");
        hostRejections++;
    }
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
        var huge = BigInteger.One << 100;
        var original = new EventChoices(new[] { Choice.None, Choice.Some(Branch.Ok(huge)) });
        Event[] mutations = {
            new EventChoices(new[] { Choice.None, Choice.Some(Branch.Ok(huge + 1)) }),
            new EventChoices(new[] { Choice.None, Choice.Some(Branch.Err(huge)) }),
            new EventChoices(new[] { Choice.Some(Branch.Ok(huge)), Choice.None }),
            new EventChoices(new[] { Choice.None, Choice.None }),
            new EventChoices(new[] { Choice.None, Choice.Some(Branch.Ok(huge)), Choice.None }),
            new EventBox(new Envelope(huge, N(2))),
            new EventEmpty(),
            new EventChoices(new[] { Choice.None, Choice.Some(Branch.Ok(BigInteger.One << 99)) })
        };
        foreach (var changed in mutations)
        {
            Check(Snapshot(changed) != Snapshot(original), "independent snapshot mutation control");
            snapshotControls++;
        }
        RefusedHost(N(-1), Api.Scalar, typeof(ArgumentOutOfRangeException));
        foreach (var value in new[] { N(0), N(40), huge })
        {
            var one = value + 1;
            var two = value + 2;
            Call(value, Api.Scalar, one);
            Call(value, Api.ProduceEnvelope, new Envelope(one, N(2)));
            Call(value, Api.ArrayValues, new[] { one, two });
            Call(value, Api.ListValues, new[] { one, two });
            Call(value, Api.Optional, value.IsZero ? Option<BigInteger>.None : Option<BigInteger>.Some(one));
            Call(value, Api.Product, (one, two));
            Call(value, Api.Branch, value.IsZero ? Branch.Err(one) : Branch.Ok(one));
            Call(value, Api.GroupValues, Values(value));
            Call(value, Api.PairValues, new AliasPair(Values(value), Values(one)));
            Call<BigInteger, Event>(value, Api.EventValue, new EventBox(new Envelope(one, N(2))));
            Call<BigInteger, Event>(value, Api.EventEmpty, new EventEmpty());
            Call<BigInteger, Event>(value, Api.EventChoices,
                new EventChoices(new[] { Choice.None, Choice.Some(Branch.Ok(one)), Choice.Some(Branch.Err(two)) }));
            Call(value, Api.NoItems, Array.Empty<BigInteger>());
        }
#if RESULT_ONLY
        for (int round = 0; round < 1000; round++)
        {
            var value = huge + round;
            Call(value, Api.PairValues, new AliasPair(Values(value), Values(value + 1)));
        }
#else
        Full();
#endif
        Console.WriteLine($"{{\"checks\":{checks},\"rejections\":{rejections},\"hostRejections\":{hostRejections},\"snapshotControls\":{snapshotControls}}}");
    }
#if !RESULT_ONLY
    static string Subtype(string path, int amount) => path + " was rejected by NominalSubtypes." + (amount == 1 ? "plusOne" : "plusTwo");
    static string Fin(string path) => path + " is not below its Fin 3 bound";
    static void Refused<I, O>(I input, Func<I, O> call, string expected)
    {
        var before = Snapshot(input);
        try { call(input); throw new InvalidOperationException("accepted: " + expected); }
        catch (ArgumentException error)
        {
            Check(error.GetType() == typeof(ArgumentException) && error.Message == expected
                && error.ParamName is null, "refusal: " + expected + "; got " + error.Message);
        }
        Check(Snapshot(input) == before, "complete rejected input unchanged");
        rejections++;
    }
    static void Full()
    {
        RefusedHost<Envelope, BigInteger>(null!, Api.First, typeof(ArgumentNullException));
        RefusedHost<Item[], Item[]>(null!, Api.EchoGroups, typeof(ArgumentNullException));
        RefusedHost<Event, BigInteger>(null!, Api.EventFirst, typeof(ArgumentNullException));
        RefusedHost(new Envelope(N(-1), N(2)), Api.First, typeof(ArgumentOutOfRangeException));
        RefusedHost(new Envelope(N(40), N(-1)), Api.First, typeof(ArgumentOutOfRangeException));
        RefusedHost<Event, Event>(new EventChoices(new[] { Choice.Some(default(Branch)) }), Api.EchoEvent, typeof(ArgumentException));
        var item = Wrap(40);
        Call(item, Api.First, N(41));
        Call(item, Api.Second, N(42));
        Call((item, item), v => Api.Combine(v.Item1, v.Item2), N(4142));
        Call(new Pair(Wrap(40), Wrap(40)), Api.Nested, N(4142));
        Call(Wrap(99), Api.First, N(100));
        Call(Wrap(89), Api.Second, N(91));
        Call(Wrap(90), Api.First, N(91));
        Refused(Wrap(100), Api.First, Subtype("value0.payload", 1));
        Refused(Wrap(90), Api.Second, Subtype("value0.payload", 2));
        Refused((Wrap(100), Wrap(40)), v => Api.Combine(v.Item1, v.Item2), Subtype("value0.payload", 1));
        Refused((Wrap(40), Wrap(90)), v => Api.Combine(v.Item1, v.Item2), Subtype("value1.payload", 2));
        Refused(new Pair(Wrap(100), Wrap(40)), Api.Nested, Subtype("value0.left.payload", 1));
        Refused(new Pair(Wrap(40), Wrap(90)), Api.Nested, Subtype("value0.right.payload", 2));
        Call(item, Api.Echo, Wrap(41));
        foreach (var (call, one, two) in new[] { ((Func<Event, BigInteger>)Api.EventFirst, 1, 2), ((Func<Event, BigInteger>)Api.EventSecond, 2, 1) })
        {
            Call<Event, BigInteger>(new EventEmpty(), call, N(0));
            Call<Event, BigInteger>(new EventBox(Wrap(40)), call, N(40 + one));
            Call<Event, BigInteger>(new EventChoices(Array.Empty<Choice>()), call, N(0));
            Call<Event, BigInteger>(new EventChoices(new[] { Choice.None }), call, N(0));
            Call<Event, BigInteger>(new EventChoices(new[] { Choice.None, Choice.Some(Branch.Ok(N(40))) }), call, N(40 + one));
            Call<Event, BigInteger>(new EventChoices(new[] { Choice.Some(Branch.Err(N(40))), Choice.None }), call, N(40 + two));
            foreach (var (label, good, amount) in new[] { ("ok", true, one), ("error", false, two) })
            for (int position = 0; position < 3; position++)
            {
                var items = new[] { Choice.Some(Branch.Ok(N(40))), Choice.None, Choice.Some(Branch.Err(N(40))) };
                items[position] = Choice.Some(good ? Branch.Ok(N(100)) : Branch.Err(N(100)));
                Refused<Event, BigInteger>(new EventChoices(items), call, Subtype($"value0.choices.values[{position}]?.{label}", amount));
            }
        }
        var left = new[] { Item.None, Item.Some(Wrap(40)), Item.Some(new Envelope(N(1), N(0))) };
        var right = new[] { Item.Some(new Envelope(N(2), N(1))), Item.None };
        var normalizedLeft = new[] { Item.None, Item.Some(Wrap(41)), Item.Some(new Envelope(N(2), N(0))) };
        var normalizedRight = new[] { Item.Some(new Envelope(N(4), N(1))), Item.None };
        Call((left, right), v => Api.Aliases(v.Item1, v.Item2), N(47));
        Call(new AliasPair(left, right), Api.InspectAliasPair, N(47));
        Call(left, Api.EchoGroups, normalizedLeft);
        var projected = Call(new AliasPair(left, right), Api.EchoPair, new AliasPair(normalizedLeft, normalizedRight));
        Call(projected, Api.EchoPair, new AliasPair(
            new[] { Item.None, Item.Some(Wrap(42)), Item.Some(new Envelope(N(3), N(0))) },
            new[] { Item.Some(new Envelope(N(6), N(1))), Item.None }));
        Call<Event, Event>(new EventChoices(new[] { Choice.None, Choice.Some(Branch.Ok(N(40))), Choice.Some(Branch.Err(N(40))) }),
            Api.EchoEvent, new EventChoices(new[] { Choice.None, Choice.Some(Branch.Ok(N(41))), Choice.Some(Branch.Err(N(42))) }));
        Call<Event, Event>(new EventEmpty(), Api.EchoEvent, new EventEmpty());
        Call<Event, Event>(new EventBox(Wrap(40)), Api.EchoEvent, new EventBox(Wrap(41)));
        Call(Array.Empty<Item>(), Api.EchoGroups, Array.Empty<Item>());
        Call(new AliasPair(Array.Empty<Item>(), new[] { Item.None }), Api.EchoPair, new AliasPair(Array.Empty<Item>(), new[] { Item.None }));
        for (int position = 0; position < 3; position++)
        {
            var bad = new[] { Item.Some(Wrap(40)), Item.None, Item.Some(Wrap(40)) };
            bad[position] = Item.Some(Wrap(100));
            Refused(bad, Api.EchoGroups, Subtype($"value0[{position}]?.payload", 1));
            Refused(new AliasPair(bad, right), Api.InspectAliasPair, Subtype($"value0.left[{position}]?.payload", 1));
            Refused(new AliasPair(left, bad), Api.InspectAliasPair, Subtype($"value0.right[{position}]?.payload", 2));
        }
        // All Fin bounds precede even an earlier rejected Subtype constructor.
        Refused((Wrap(100), new Envelope(N(40), N(3))), v => Api.Combine(v.Item1, v.Item2), Fin("value1.digit"));
        Refused(new Pair(Wrap(100), new Envelope(N(40), N(3))), Api.Nested, Fin("value0.right.digit"));
        Refused((new[] { Item.Some(Wrap(100)) }, new[] { Item.None, Item.Some(new Envelope(N(40), N(3))) }),
            v => Api.Aliases(v.Item1, v.Item2), Fin("value1[1]?.digit"));
        Refused<Event, Event>(new EventBox(new Envelope(N(100), N(3))), Api.EchoEvent, Fin("value0.box.value.digit"));
        Call(N(2), Api.PlainFin, N(2));
        Refused(N(3), Api.PlainFin, Fin("value0"));
        for (int round = 0; round < 1000; round++)
        {
            int position = round % 3;
            var bad = new[] { Item.None, Item.Some(Wrap(1)), Item.None };
            bad[position] = Item.Some(Wrap(90));
            Refused(new AliasPair(left, bad), Api.EchoPair, Subtype($"value0.right[{position}]?.payload", 2));
            Call(new AliasPair(left, right), Api.EchoPair, new AliasPair(normalizedLeft, normalizedRight));
        }
    }
#endif
}
