// Independent C# caller for proof-erased checked records with value indices.
using System;
using System.Numerics;
using System.Text.Json;
using LeanBridge.Checkedrecordvalueindices;

static class Consumer
{
    static int checks;
    static int calls;
    static int rejections;
    static int recoveries;

    static BigInteger N(long value) => new(value);
    static BigInteger Huge() => (BigInteger.One << 128) + BigInteger.One;

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

    static string Rejected(string constructor) => Prefix()
        + " was rejected by CheckedRecordValueIndices." + constructor;

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

    static bool ShapeRefused(Action call)
    {
        ++calls;
        try { call(); }
        catch (ArgumentOutOfRangeException error)
        {
            return error.ParamName == "value"
                && error.Message.StartsWith("Lean Nat cannot be negative"
                    , StringComparison.Ordinal);
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
        var value = new ZeroToken(N(99));
        ++calls;
        if (Api.ZeroNatIndex(value) != N(99) || value.Count != N(99)) return false;
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
        BigInteger huge = Huge();
#if !RESULT_ONLY
        var on = new On(N(0));
        var off = new Off(N(1));
        var ab = new Ab(N(2));
        var empty = new EmptyToken(N(9));
        var unicode = new UnicodeToken(N(10));
        var sized = new EmptySized(Array.Empty<BigInteger>());
        var zero = new ZeroToken(N(11));
        var wide = new WideToken(huge);
        ++calls; Check(Api.TrueBoolIndex(on) == N(0) && on.Count == N(0), "true Bool index");
        ++calls; Check(Api.FalseBoolIndex(off) == N(1) && off.Count == N(1), "false Bool index");
        ++calls; Check(Api.AbStringIndex(ab) == N(2) && ab.Size == N(2), "String index");
        ++calls; Check(Api.EmptyStringIndex(empty) == N(9) && empty.Count == N(9), "empty String index");
        ++calls; Check(Api.UnicodeStringIndex(unicode) == N(10) && unicode.Count == N(10), "Unicode String index");
        ++calls; Check(Api.EmptySizedIndex(sized) == N(0) && sized.Data.Length == 0, "zero Nat index");
        ++calls; Check(Api.ZeroNatIndex(zero) == N(11) && zero.Count == N(11), "zero Token index");
        ++calls; Check(Api.WideNatIndex(wide) == huge && wide.Count == huge
            && zero.GetType() != wide.GetType(), "129-bit Nat index keeps nominal identity");

        ab = new Ab(N(1));
        Check(Refused(() => Api.AbStringIndex(ab), Rejected("mkAb"))
            && ab.Size == N(1), "String-index refusal preserves input");
        ++rejections; Check(Recover(), "recover after String-index refusal");
        sized = new EmptySized(new[] { N(1) });
        Check(Refused(() => Api.EmptySizedIndex(sized), Rejected("mkEmptySized"))
            && sized.Data.Length == 1 && sized.Data[0] == N(1)
            , "Nat-index refusal preserves array input");
        ++rejections; Check(Recover(), "recover after Nat-index refusal");
        on = new On(N(1));
        Check(Refused(() => Api.TrueBoolIndex(on), Rejected("mkOn"))
            && on.Count == N(1), "true-index refusal preserves input");
        ++rejections; Check(Recover(), "recover after true-index refusal");
        off = new Off(N(0));
        Check(Refused(() => Api.FalseBoolIndex(off), Rejected("mkOff"))
            && off.Count == N(0), "false-index refusal preserves input");
        ++rejections; Check(Recover(), "recover after false-index refusal");
        on = new On(N(-1));
        Check(ShapeRefused(() => Api.TrueBoolIndex(on)) && on.Count == N(-1)
            , "negative Nat field preserves input");
        ++rejections; Check(Recover(), "recover after first shape refusal");
        zero = new ZeroToken(N(-1));
        Check(ShapeRefused(() => Api.ZeroNatIndex(zero)) && zero.Count == N(-1)
            , "negative Token field preserves input");
        ++rejections; Check(Recover(), "recover after second shape refusal");
        Check(NullRefused(() => Api.TrueBoolIndex(null!))
            , "null checked-record input is refused by the host boundary");
        ++rejections; Check(Recover(), "recover after null host refusal");
#endif

        ++calls; Check(Api.ProduceTrueBool().Count == N(0), "produce true Bool");
        ++calls; Check(Api.ProduceFalseBool().Count == N(1), "produce false Bool");
        ++calls; Check(Api.ProduceAb().Size == N(2), "produce String index");
        BigInteger value = N(23);
        ++calls; Check(Api.ProduceEmptyString(value).Count == value, "produce empty String index");
        value = N(24);
        ++calls; Check(Api.ProduceUnicodeString(value).Count == value, "produce Unicode String index");
        ++calls; Check(Api.ProduceEmptySized().Data.Length == 0, "produce zero-sized record");
        value = N(25);
        ++calls; Check(Api.ProduceZeroNat(value).Count == value, "produce zero Nat index");
        ++calls; Check(Api.ProduceWideNat(huge).Count == huge, "produce 129-bit Nat index");
#if RESULT_ONLY
        Check(calls == 8 && rejections == 0 && recoveries == 0, "result-only totals");
#else
        Check(calls == 30 && rejections == 7 && recoveries == 7, "full totals");
#endif
    }
}
