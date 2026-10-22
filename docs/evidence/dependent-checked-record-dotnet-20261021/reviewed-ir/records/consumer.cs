#define REVIEWED
// Independent C# caller for proof-erased dependent checked records.
using System;
using System.Numerics;
using System.Text.Json;
using LeanBridge.Dependentrecords;

static class Consumer
{
    static int checks = 0;
    static int calls = 0;
    static int rejections = 0;
    static int recoveries = 0;
    static int snapshots = 0;

    static void Check(bool condition, string label)
    {
        if (!condition) throw new InvalidOperationException("dependent-record assertion failed: " + label);
        ++checks;
    }

    static string Prefix() =>
#if REVIEWED
        "value0";
#else
        "arg0";
#endif

    static Dependent Record(BigInteger bound, BigInteger below) => new Dependent(bound, below);

    static string Snapshot(Dependent value) =>
        value.Bound.ToString() + "/" + value.Below.ToString();

    static void Produced(BigInteger seed, string label)
    {
        ++calls;
        var value = Api.DependentResult(seed);
        Check(Snapshot(value) == Snapshot(Record(seed + 1, seed)), label + " exact result");
        ++snapshots;
    }

#if !RESULT_ONLY
    static BigInteger Total(Dependent value, BigInteger expected, string label)
    {
        var before = Snapshot(value);
        ++calls;
        var actual = Api.DependentTotal(value);
        Check(actual == expected, label + " exact result");
        Check(Snapshot(value) == before, label + " preserves caller input");
        ++snapshots;
        return actual;
    }

    static Dependent Roundtrip(Dependent value, string label)
    {
        var before = Snapshot(value);
        ++calls;
        var actual = Api.DependentRoundtrip(value);
        Check(Snapshot(actual) == before && actual.Equals(value), label + " exact result");
        Check(Snapshot(value) == before, label + " preserves caller input");
        ++snapshots;
        return actual;
    }

    static void Refuse(Dependent value, string label)
    {
        var before = Snapshot(value);
        ++calls;
        var refused = false;
        try { Api.DependentTotal(value); }
        catch (ArgumentException error)
        {
            Check(error.GetType() == typeof(ArgumentException)
                && error.Message == Prefix() + " was rejected by DependentRecords.mkDependent"
                && error.ParamName is null, label + " exact checked-record refusal");
            Check(true, label + " refuses invalid input");
            refused = true;
        }
        if (!refused) throw new InvalidOperationException("Accepted invalid dependent record: " + label);
        Check(Snapshot(value) == before, label + " preserves rejected input");
        ++rejections;
        ++snapshots;
    }

    static void Recover()
    {
        Total(Record(2, 1), 3, "recovery");
        ++recoveries;
    }
#endif

    static int Main(string[] arguments)
    {
        try
        {
            if (arguments.Length == 1 && arguments[0] == "--runtime")
            {
                Console.WriteLine(JsonSerializer.Serialize(new {
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
            Console.WriteLine(JsonSerializer.Serialize(new {
                calls, checks, recoveries, rejections, snapshots
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
        var api = typeof(Api);
        Check((api.GetMethod("DependentTotal") is not null) !=
#if RESULT_ONLY
            true
#else
            false
#endif
            , "DependentTotal export selection");
        Check((api.GetMethod("DependentRoundtrip") is not null) !=
#if RESULT_ONLY
            true
#else
            false
#endif
            , "DependentRoundtrip export selection");
        Check(api.GetMethod("DependentResult") is not null, "DependentResult export selection");

        for (var index = 0; index < 512; ++index) Produced(index, "result " + index);
        var huge = BigInteger.One << 130;
        Produced(huge, "huge result");

#if !RESULT_ONLY
        Total(Record(3, 2), 5, "valid total");
        Refuse(Record(2, 2), "equal fields");
        Recover();
        Refuse(Record(0, 0), "zero bound");
        Recover();
        var valid = Record(3, 2);
        Roundtrip(valid, "roundtrip");
        var below = huge - 1;
        Total(Record(huge, below), huge + below, "huge total");
        var hugeRecord = Record(huge, below);
        Roundtrip(hugeRecord, "huge roundtrip");
        for (var index = 0; index < 256; ++index)
        {
            var bound = new BigInteger(index + 1);
            Total(Record(bound, index), 2 * index + 1, "loop total " + index);
            Refuse(Record(bound, bound), "loop refusal " + index);
            Recover();
        }
        var totals = new[] { calls, checks, recoveries, rejections, snapshots };
        var expected = new[] { 1289, 2326, 258, 258, 1289 };
#else
        var totals = new[] { calls, checks, recoveries, rejections, snapshots };
        var expected = new[] { 513, 516, 0, 0, 513 };
#endif
        for (var index = 0; index < totals.Length; ++index)
            if (totals[index] != expected[index])
                throw new InvalidOperationException("dependent-record exact caller totals: "
                    + string.Join(",", totals) + " != " + string.Join(",", expected));
    }
}
