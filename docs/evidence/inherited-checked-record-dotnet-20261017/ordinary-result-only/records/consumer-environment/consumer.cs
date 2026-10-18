#define RESULT_ONLY
// Independent C# caller for proof-free inherited checked records.
// Generated record equality is deliberately not used as an oracle.
using System;
using System.Numerics;
using LeanBridge.Inheritedcheckedrecords;

static class Consumer
{
    static int checks = 0, rejections = 0, recoveries = 0;
    static int snapshots = 0, snapshotControls = 0;
    const int Rounds = 256;

    static BigInteger N(long value) => new(value);
    static BigInteger Huge() => BigInteger.One << 100;
    static Span MakeSpan(long lo, long hi) => new(N(lo), N(hi));
    static Ticket MakeTicket(long lo, long hi, long word) =>
        new(MakeSpan(lo, hi), N(word));
    static Ticket BigTicket(BigInteger value, long offset) =>
        new(new Span(value, value), value + N(offset));
    static Stamped MakeStamped(long lo, long hi, long word, long mark) =>
        new(MakeTicket(lo, hi, word), N(mark));
    static Stamped BigStamped(BigInteger value) =>
        new(BigTicket(value, 1), BigInteger.Zero);

    static string SnapNat(BigInteger value) =>
        "Nat(" + value.ToString(System.Globalization.CultureInfo.InvariantCulture) + ")";
    static string SnapSpan(Span value) =>
        "Span(" + SnapNat(value.Lo) + "," + SnapNat(value.Hi) + ")";
    static string SnapTicket(Ticket value) =>
        "Ticket(" + SnapSpan(value.ToSpan) + "," + SnapNat(value.Word) + ")";
    static string SnapStamped(Stamped value) =>
        "Stamped(" + SnapTicket(value.ToTicket) + "," + SnapNat(value.Mark) + ")";
    static string SnapPair((Ticket, Ticket) value) =>
        "Tuple(" + SnapTicket(value.Item1) + "," + SnapTicket(value.Item2) + ")";

    static void Check(bool condition, string label)
    {
        if (!condition) throw new InvalidOperationException("failed: " + label);
        ++checks;
    }

    static void Unchanged(string before, string after)
    {
        ++snapshots;
        Check(before == after, "complete caller inputs unchanged");
    }

    static TOutput Call<TInput, TOutput>(
        TInput input,
        Func<TInput, TOutput> invoke,
        Func<TInput, string> inputSnapshot,
        Func<TOutput, string> outputSnapshot,
        string expected)
    {
        string before = inputSnapshot(input);
        TOutput output = invoke(input);
        Check(outputSnapshot(output) == expected, "exact independent result");
        Unchanged(before, inputSnapshot(input));
        return output;
    }

#if !RESULT_ONLY
    static void Refuse<TInput>(
        TInput input,
        Action invoke,
        Func<TInput, string> snapshot,
        string expected)
    {
        string before = snapshot(input);
        try
        {
            invoke();
            throw new InvalidOperationException("accepted invalid checked record: " + expected);
        }
        catch (ArgumentException error)
        {
            Check(error.GetType() == typeof(ArgumentException)
                && error.Message == expected && error.ParamName is null,
                "exact checked-record rejection: " + error);
        }
        Unchanged(before, snapshot(input));
        ++rejections;
    }

    static string Prefix() =>
#if REVIEWED
        "value";
#else
        "arg";
#endif
    static string Rejected(string path, string constructor) =>
        Prefix() + path + " was rejected by InheritedCheckedRecords." + constructor;
    static string Fin(string path) =>
        Prefix() + path + ".mark is not below its Fin 8 bound";
#endif

    static void Distinct(string left, string right)
    {
        Check(left != right, "independent snapshot mutation control");
        ++snapshotControls;
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
                checks, rejections, recoveries, snapshots, snapshotControls,
                rounds = Rounds
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
        Distinct(SnapTicket(MakeTicket(0, 0, 1)), SnapTicket(MakeTicket(0, 0, 2)));
        Distinct(SnapTicket(MakeTicket(0, 0, 1)), SnapTicket(MakeTicket(0, 1, 1)));
        Distinct(SnapStamped(MakeStamped(0, 0, 1, 0)),
            SnapStamped(MakeStamped(0, 0, 1, 1)));
        Distinct(SnapNat(BigInteger.Zero), SnapNat(Huge()));
        Distinct(SnapSpan(MakeSpan(0, 1)), SnapTicket(MakeTicket(0, 1, 1)));
        Distinct(SnapTicket(MakeTicket(0, 1, 1)),
            SnapStamped(MakeStamped(0, 1, 1, 0)));
#if !RESULT_ONLY
        Distinct(SnapTicket(MakeTicket(1, 2, 3)), SnapTicket(MakeTicket(2, 2, 3)));
        Distinct(SnapStamped(MakeStamped(1, 2, 3, 0)),
            SnapStamped(MakeStamped(1, 2, 3, 7)));
#endif

        BigInteger zero = BigInteger.Zero;
        Call(zero, Api.Produce, SnapNat, SnapTicket, SnapTicket(MakeTicket(0, 0, 1)));
        Call(zero, Api.ProduceStamped, SnapNat, SnapStamped,
            SnapStamped(MakeStamped(0, 0, 1, 0)));
        for (int round = 0; round < Rounds; ++round)
        {
            BigInteger value = Huge() + round;
            Ticket produced = Call(value, Api.Produce, SnapNat, SnapTicket,
                SnapTicket(BigTicket(value, 1)));
            Stamped marked = Call(value, Api.ProduceStamped, SnapNat, SnapStamped,
                SnapStamped(BigStamped(value)));
            Check(!ReferenceEquals(produced, marked.ToTicket),
                "returned tickets own independent managed storage");
            Check(!ReferenceEquals(produced.ToSpan, marked.ToTicket.ToSpan),
                "returned inherited fields own independent managed storage");
        }
#if !RESULT_ONLY
        Full();
#endif
    }

#if !RESULT_ONLY
    static void Full()
    {
        Call(MakeTicket(2, 3, 4), Api.First, SnapTicket, SnapNat, SnapNat(N(9)));
        Call(MakeTicket(4, 1, 0), Api.Normalized, SnapTicket, SnapNat, SnapNat(N(11)));
        var pair = (MakeTicket(2, 3, 4), MakeTicket(4, 1, 999));
        Call(pair, value => Api.Pair(value.Item1, value.Item2), SnapPair, SnapNat,
            SnapNat(N(10)));
        Call(MakeTicket(4, 1, 4), Api.Aliased, SnapTicket, SnapNat, SnapNat(N(5)));
        Call(MakeStamped(1, 2, 4, 3), Api.Nested, SnapStamped, SnapNat, SnapNat(N(7)));
        Call(MakeTicket(1, 2, 0), Api.Echo, SnapTicket, SnapTicket,
            SnapTicket(MakeTicket(1, 2, 3)));

        Ticket invalidTicket = MakeTicket(4, 1, 5);
        Refuse(invalidTicket, () => Api.First(invalidTicket), SnapTicket,
            Rejected("0.toSpan", "mkSpan"));
        invalidTicket = MakeTicket(1, 2, 0);
        Refuse(invalidTicket, () => Api.First(invalidTicket), SnapTicket,
            Rejected("0.word", "mkWord"));
        invalidTicket = MakeTicket(1, 5, 3);
        Refuse(invalidTicket, () => Api.First(invalidTicket), SnapTicket,
            Rejected("0", "mkTicket"));
        Stamped invalidStamped = MakeStamped(1, 2, 9, 8);
        Refuse(invalidStamped, () => Api.Nested(invalidStamped), SnapStamped, Fin("0"));
        invalidStamped = MakeStamped(1, 2, 4, 5);
        Refuse(invalidStamped, () => Api.Nested(invalidStamped), SnapStamped,
            Rejected("0", "mkStamped"));
        invalidTicket = MakeTicket(1, 5, 3);
        Refuse(invalidTicket, () => Api.Aliased(invalidTicket), SnapTicket,
            Rejected("0", "mkTicket"));

        for (int round = 0; round < Rounds; ++round)
        {
            BigInteger value = N(round + 10);
            Ticket valid = MakeTicket(round + 10, round + 11, round + 12);
            Call(valid, Api.First, SnapTicket, SnapNat, SnapNat(3 * value + 3));
            Call(MakeTicket(round + 12, round + 10, 0), Api.Normalized,
                SnapTicket, SnapNat, SnapNat(4 * value + 5));
            pair = (valid, MakeTicket(round + 12, round + 10, 0));
            Call(pair, item => Api.Pair(item.Item1, item.Item2), SnapPair, SnapNat,
                SnapNat(3 * value + 5));
            Call(MakeTicket(round + 12, round + 10, 2 * round + 21), Api.Aliased,
                SnapTicket, SnapNat, SnapNat(2 * value + 2));
            int mark = round % 8;
            Call(MakeStamped(mark, mark, mark + 1, mark), Api.Nested,
                SnapStamped, SnapNat, SnapNat(N(2 * mark + 1)));

            invalidTicket = MakeTicket(round + 11, round + 10, round + 12);
            Refuse(invalidTicket, () => Api.First(invalidTicket), SnapTicket,
                Rejected("0.toSpan", "mkSpan"));
            invalidTicket = MakeTicket(0, 1, 0);
            Refuse(invalidTicket, () => Api.First(invalidTicket), SnapTicket,
                Rejected("0.word", "mkWord"));
            invalidTicket = MakeTicket(0, round + 12, round + 11);
            Refuse(invalidTicket, () => Api.First(invalidTicket), SnapTicket,
                Rejected("0", "mkTicket"));
            invalidStamped = MakeStamped(0, 9, 9, 8);
            Refuse(invalidStamped, () => Api.Nested(invalidStamped), SnapStamped, Fin("0"));
            invalidStamped = MakeStamped(0, 6, 6, 7);
            Refuse(invalidStamped, () => Api.Nested(invalidStamped), SnapStamped,
                Rejected("0", "mkStamped"));
            Call(valid, Api.First, SnapTicket, SnapNat, SnapNat(3 * value + 3));
            ++recoveries;
        }
    }
#endif
}
