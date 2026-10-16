// Independent C# caller for proof-free nested checked records.
using System;
using System.Numerics;
using LeanBridge.Nestedcheckedrecords;
using Branch = LeanBridge.Nestedcheckedrecords.Result<
    LeanBridge.Nestedcheckedrecords.Packet,
    LeanBridge.Nestedcheckedrecords.Packet>;

static class Consumer
{
    static int checks = 0, rejections = 0, hostRejections = 0;
    static int recoveries = 0, snapshots = 0;
    const int Rounds = 256;

    static BigInteger N(long value) => new(value);
    static BigInteger Huge() => BigInteger.One << 100;
    static Packet Packet(long digit, long word) => new(N(digit), N(word));
    static string Snap(Packet? value) => value is null
        ? "null" : $"{value.Digit}:{value.Word}";
    static string Snap(Packet[]? values) => values is null
        ? "null" : string.Join("|", Array.ConvertAll(values, Snap));
    static string Snap(Option<Packet> value) => value.IsSome
        ? "some:" + Snap(value.Value) : "none";
    static string Snap(Branch value) => value.IsOk
        ? "ok:" + Snap(value.Value)
        : value.IsError ? "error:" + Snap(value.Error) : "uninitialized";
    static string Snap((Packet, Packet) value) =>
        $"({Snap(value.Item1)},{Snap(value.Item2)})";
    static string Snap(Holder value) => $"{Snap(value.Packet)}:{value.Tag}";
    static string Snap(Choice value) => value switch
    {
        ChoiceEmpty => "empty",
        ChoicePacket packet => "packet:" + Snap(packet.Value),
        null => "null",
        _ => throw new InvalidOperationException("unknown choice")
    };

    static void Check(bool condition, string label)
    {
        if (!condition) throw new InvalidOperationException("failed: " + label);
        ++checks;
    }

    static void Same(string before, string after, string label)
    {
        Check(before == after, label);
        ++snapshots;
    }

    static TOutput Accepted<TInput, TOutput>(
        TInput input,
        Func<TInput, TOutput> invoke,
        Func<TInput, string> snapshot,
        Func<TOutput, bool> expected,
        string label)
    {
        string before = snapshot(input);
        TOutput output = invoke(input);
        Check(expected(output), label);
        Same(before, snapshot(input), label + " input snapshot");
        return output;
    }

#if !RESULT_ONLY
    static void Refused(Action invoke, string expected, Func<string> snapshot)
    {
        string before = snapshot();
        try
        {
            invoke();
            throw new InvalidOperationException("accepted invalid checked record");
        }
        catch (ArgumentException error)
        {
            Check(error.GetType() == typeof(ArgumentException)
                && error.Message == expected && error.ParamName is null,
                "exact checked-record rejection: " + error);
        }
        Same(before, snapshot(), "refused input snapshot");
        ++rejections;
    }

    static void Recover(bool condition)
    {
        Check(condition, "valid call recovers after rejection");
        ++recoveries;
    }

    static string Prefix() =>
#if REVIEWED
        "value";
#else
        "arg";
#endif
    static string Constructor(string path, string name) =>
        path + " was rejected by NestedCheckedRecords." + name;
    static string Fin(string path) => path + " is not below its Fin 10 bound";
#endif

    static void RefusedHost(Action invoke, Type expected, Func<string> snapshot)
    {
        string before = snapshot();
        try
        {
            invoke();
            throw new InvalidOperationException("accepted invalid managed value");
        }
        catch (ArgumentException error)
        {
            Check(error.GetType() == expected && error.ParamName == "value",
                "managed rejection type and parameter: " + error);
        }
        Same(before, snapshot(), "managed-refused input snapshot");
        ++hostRejections;
    }

    static void Inactive(Action read, string expected)
    {
        try
        {
            read();
            throw new InvalidOperationException("read inactive union payload");
        }
        catch (InvalidOperationException error)
        {
            Check(error.Message == expected, "exact inactive payload diagnostic");
        }
        ++hostRejections;
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
            if (arguments.Length != 0)
                throw new InvalidOperationException("Unexpected caller arguments");
            Run();
            Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new {
                checks, rejections, hostRejections, recoveries, snapshots,
                rounds = Rounds, wordBits = IntPtr.Size * 8
            }));
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error);
            return 1;
        }
    }

    static void Run()
    {
        Check(IntPtr.Size == 8, "native machine-word width");
        BigInteger huge = Huge();
        for (int round = 0; round < Rounds; ++round)
        {
            BigInteger input = huge + round;
            Option<Packet> option = Api.ProduceOption(input);
            Check(option.IsSome && option.Value == new Packet(BigInteger.Zero, input + 1),
                "projected optional packet");
            Packet[] values = Api.ProduceArray(input);
            Check(values.Length == 2, "projected packet array length");
            Check(values[0] == new Packet(BigInteger.Zero, input + 1),
                "first projected packet");
            Check(values[1] == new Packet(BigInteger.Zero, input + 2),
                "second projected packet");
            Check(!ReferenceEquals(values[0], values[1]), "independent projected records");
        }

        Option<Packet> none = Option<Packet>.None;
        Check(none.IsNone && !none.IsSome, "absent option branch");
        Inactive(() => _ = none.Value, "None has no value");
        Branch ok = Branch.Ok(Packet(1, 2));
        Branch error = Branch.Err(Packet(2, 3));
        Check(ok.IsInitialized && ok.IsOk && !ok.IsError, "success result branch");
        Check(error.IsInitialized && error.IsError && !error.IsOk, "error result branch");
        Inactive(() => _ = ok.Error, "Result has no error value");
        Inactive(() => _ = error.Value, "Result has no success value");
        BigInteger negative = BigInteger.MinusOne;
        RefusedHost(() => Api.ProduceOption(negative),
            typeof(ArgumentOutOfRangeException), () => negative.ToString());
        Check(Api.ProduceOption(BigInteger.Zero).Value == Packet(0, 1),
            "result projection recovers after host rejection");
        ++recoveries;

#if !RESULT_ONLY
        Packet first = Packet(2, 3), second = Packet(7, 0);
        Accepted(first, Api.First, Snap, value => value == N(3), "direct packet");
        Accepted(second, Api.Second, Snap, value => value == N(8),
            "normalized direct packet");
        Accepted((first, second), value => Api.Pair(value.Item1, value.Item2), Snap,
            value => value == N(11), "repeated packet parameters");
        Packet[] rows = { Packet(1, 2), Packet(3, 5) };
        Accepted(rows, Api.InArray, Snap, value => value == N(7), "array packets");
        rows = new[] { Packet(1, 0), Packet(3, 100) };
        Accepted(rows, Api.InList, Snap, value => value == N(6), "List packets");
        Accepted(Option<Packet>.None, Api.InOption, Snap,
            value => value.IsZero, "absent packet option");
        Accepted(Option<Packet>.Some(Packet(1, 2)), Api.InOption, Snap,
            value => value == N(3), "present packet option");
        Accepted((Packet(1, 2), Packet(3, 0)), Api.InProduct, Snap,
            value => value == N(6), "packet product");
        Accepted(Branch.Ok(Packet(2, 9)), Api.InExcept, Snap,
            value => value == N(3), "success packet branch");
        Accepted(Branch.Err(Packet(1, 2)), Api.InExcept, Snap,
            value => value == N(3), "error packet branch");
        Accepted(new Holder(Packet(3, 1), N(9)), Api.InHolder, Snap,
            value => value == N(13), "enclosing record field");
        Accepted<Choice, BigInteger>(new ChoiceEmpty(), Api.InChoice, Snap,
            value => value.IsZero, "empty variant case");
        Accepted<Choice, BigInteger>(new ChoicePacket(Packet(2, 4)), Api.InChoice, Snap,
            value => value == N(5), "active variant field");
        rows = new[] { Packet(2, 3), new Packet(N(1), huge) };
        Packet[] echoed = Accepted(rows, Api.EchoArray, Snap,
            value => value.Length == 2 && value[0] == rows[0] && value[1] == rows[1],
            "proof-free packet result");
        Check(!ReferenceEquals(echoed, rows) && !ReferenceEquals(echoed[0], rows[0]),
            "result owns independent managed storage");

        string prefix = Prefix();
        Packet invalid = Packet(0, 0);
        Refused(() => Api.First(invalid), Constructor(prefix + "0.word", "mkWord"),
            () => Snap(invalid));
        Recover(Api.First(first) == N(3));
        invalid = Packet(4, 2);
        Refused(() => Api.First(invalid), Constructor(prefix + "0", "mkPacket"),
            () => Snap(invalid));
        Recover(Api.First(first) == N(3));
        invalid = Packet(10, 12);
        Refused(() => Api.First(invalid), Fin(prefix + "0.digit"), () => Snap(invalid));
        Recover(Api.First(first) == N(3));

        rows = new[] { Packet(2, 3), Packet(1, 0) };
        Refused(() => Api.InArray(rows), Constructor(prefix + "0[1].word", "mkWord"),
            () => Snap(rows));
        rows[1] = Packet(2, 3);
        Recover(Api.InArray(rows) == N(6));
        rows[1] = Packet(5, 2);
        Refused(() => Api.InArray(rows), Constructor(prefix + "0[1]", "mkPacket"),
            () => Snap(rows));
        rows[1] = Packet(2, 3);
        Recover(Api.InArray(rows) == N(6));
        rows[1] = Packet(10, 12);
        Refused(() => Api.InArray(rows), Fin(prefix + "0[1].digit"), () => Snap(rows));
        rows[1] = Packet(2, 3);
        Recover(Api.InArray(rows) == N(6));

        Option<Packet> maybe = Option<Packet>.Some(Packet(5, 2));
        Refused(() => Api.InOption(maybe), Constructor(prefix + "0?", "mkPacket"),
            () => Snap(maybe));
        Recover(Api.InOption(Option<Packet>.Some(Packet(1, 2))) == N(3));
        (Packet, Packet) pair = (Packet(1, 2), Packet(10, 0));
        Refused(() => Api.InProduct(pair), Fin(prefix + "0.1.digit"), () => Snap(pair));
        Recover(Api.InProduct((Packet(1, 2), Packet(3, 0))) == N(6));
        Branch branch = Branch.Ok(Packet(10, 0));
        Refused(() => Api.InExcept(branch), Fin(prefix + "0.ok.digit"),
            () => Snap(branch));
        Recover(Api.InExcept(Branch.Ok(Packet(2, 9))) == N(3));
        branch = Branch.Err(Packet(3, 1));
        Refused(() => Api.InExcept(branch), Constructor(prefix + "0.error", "mkPacket"),
            () => Snap(branch));
        Recover(Api.InExcept(Branch.Err(Packet(1, 2))) == N(3));
        Holder holder = new(Packet(10, 0), N(9));
        Refused(() => Api.InHolder(holder), Fin(prefix + "0.packet.digit"),
            () => Snap(holder));
        Recover(Api.InHolder(new Holder(Packet(3, 1), N(9))) == N(13));
        Choice choice = new ChoicePacket(Packet(3, 1));
        Refused(() => Api.InChoice(choice),
            Constructor(prefix + "0.packet.value", "mkPacket"), () => Snap(choice));
        Recover(Api.InChoice(new ChoicePacket(Packet(2, 4))) == N(5));

        Packet? missing = null;
        RefusedHost(() => Api.First(missing!), typeof(ArgumentNullException),
            () => Snap(missing));
        Recover(Api.First(first) == N(3));
        Option<Packet> activeNull = Option<Packet>.Some(null!);
        RefusedHost(() => Api.InOption(activeNull), typeof(ArgumentNullException),
            () => activeNull.IsSome ? Snap(activeNull.Value) : "none");
        Recover(Api.InOption(Option<Packet>.Some(Packet(1, 2))) == N(3));
        Packet negativePacket = new(BigInteger.MinusOne, BigInteger.One);
        RefusedHost(() => Api.First(negativePacket), typeof(ArgumentOutOfRangeException),
            () => Snap(negativePacket));
        Recover(Api.First(first) == N(3));

        for (int round = 0; round < Rounds; ++round)
        {
            BigInteger input = round + 10;
            Packet valid = new(round % 10, input);
            Accepted(valid, Api.First, Snap, value => value == input,
                "round direct packet");
            invalid = Packet(2, 1);
            Refused(() => Api.First(invalid), Constructor(prefix + "0", "mkPacket"),
                () => Snap(invalid));
            Recover(Api.First(valid) == input);
            Packet normalized = Packet(round % 10, 0);
            Accepted(normalized, Api.Second, Snap,
                value => value == round % 10 + 1, "round normalized packet");
            rows = new[] { valid, Packet(1, 0) };
            Refused(() => Api.InArray(rows),
                Constructor(prefix + "0[1].word", "mkWord"), () => Snap(rows));
            rows[1] = Packet(2, 3);
            Recover(Api.InArray(rows) == round + 13);
        }
#endif
    }
}
