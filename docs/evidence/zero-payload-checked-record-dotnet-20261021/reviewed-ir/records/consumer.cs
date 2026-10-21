#define REVIEWED
// Independent C# caller for proof-erased zero-payload checked records.
using System;
using System.Text.Json;
using LeanBridge.Zeropayloadcheckedrecords;

static class Consumer
{
    static int checks = 0;
    static int calls = 0;
    static int rejections = 0;
    static int recoveries = 0;

    static void Check(bool condition, string label)
    {
        if (!condition) throw new InvalidOperationException("failed: " + label);
        ++checks;
    }

#if !RESULT_ONLY
    static string Prefix() =>
#if REVIEWED
        "value0";
#else
        "arg0";
#endif

    static bool Refused(Action call, string expected)
    {
        ++calls;
        try { call(); }
        catch (ArgumentException error)
        {
            return error.GetType() == typeof(ArgumentException)
                && error.Message == expected && error.ParamName is null;
        }
        return false;
    }

    static bool NullRefused(Action call)
    {
        ++calls;
        try { call(); }
        catch (ArgumentNullException error)
        {
            return error.GetType() == typeof(ArgumentNullException)
                && error.ParamName == "value";
        }
        return false;
    }

    static bool Recover()
    {
        var value = new Witness();
        ++calls;
        if (Api.WitnessCount(value) != 1 || !value.Equals(new Witness()))
            return false;
        ++recoveries;
        return true;
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
                calls, checks, recoveries, rejections
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
        ++calls;
        var witness = Api.ProduceWitness();
        Check(witness.Equals(new Witness())
            && witness.GetHashCode() == new Witness().GetHashCode()
            , "proof-only Witness is a real empty value");
        ++calls;
        var token = Api.ProduceToken();
        Check(token.Equals(new Token(default)) && token.Tag.Equals(default(Unit))
            , "Token retains its Unit payload");
        ++calls;
        var values = Api.Witnesses(3);
        Check(values.Length == 3 && !ReferenceEquals(values[0], values[1])
            && values[0].Equals(values[1]) && values[1].Equals(values[2])
            , "Witness array retains length and independent values");
        ++calls;
        var none = Api.MaybeWitness(false);
        Check(none.IsNone, "absent Witness remains Option.None");
        ++calls;
        var some = Api.MaybeWitness(true);
        Check(some.IsSome && some.Value.Equals(new Witness())
            , "present empty Witness remains Option.Some");
        ++calls;
        var marker = Api.ProduceMarker();
        Check(marker.Equals(new Marker()) && marker.GetType() != witness.GetType()
            , "plain Marker stays nominally distinct from checked Witness");
        ++calls;
        var blank = Api.ProduceMark(false);
        Check(blank.Equals(new MarkBlank()), "inactive variant branch remains blank");
        ++calls;
        var marked = Api.ProduceMark(true);
        Check(marked.Equals(new MarkMarked(new Witness()))
            , "active variant branch retains its empty Witness carrier");

#if !RESULT_ONLY
        ++calls;
        Check(Api.WitnessCount(witness) == 1 && witness.Equals(new Witness())
            , "accepted nullary checked record");
        Check(Refused(() => Api.AbsentCount(witness), Prefix()
            + " was rejected by ZeroPayloadCheckedRecords.mkAbsent")
            && witness.Equals(new Witness()), "refusal preserves Witness");
        ++rejections;
        Check(Recover(), "recover after constructor refusal");
        ++calls;
        Api.TokenTag(token);
        Check(token.Equals(new Token(default)), "Unit-bearing Token is preserved");
        ++calls;
        Check(Api.MarkerCount(marker) == 0 && marker.Equals(new Marker())
            , "plain empty Marker input");
        ++calls;
        Check(Api.MarkCount(blank) == 0 && blank.Equals(new MarkBlank())
            , "inactive variant input");
        ++calls;
        Check(Api.MarkCount(marked) == 1
            && marked.Equals(new MarkMarked(new Witness()))
            , "active variant input checks its nested Witness");
        Check(NullRefused(() => Api.WitnessCount(null!))
            , "null Witness is not an empty carrier");
        ++rejections;
        Check(Recover(), "recover after null Witness refusal");
        Check(NullRefused(() => Api.MarkerCount(null!))
            , "null Marker is not a plain empty record");
        ++rejections;
        Check(Recover(), "recover after null Marker refusal");
        Check(NullRefused(() => Api.MarkCount(new MarkMarked(null!)))
            , "null nested Witness is not an empty carrier");
        ++rejections;
        Check(Recover(), "recover after null nested Witness refusal");
        Check(calls == 21 && rejections == 4 && recoveries == 4
            , "full totals");
#else
        Check(calls == 8 && rejections == 0 && recoveries == 0
            , "result-only totals");
#endif
    }
}
