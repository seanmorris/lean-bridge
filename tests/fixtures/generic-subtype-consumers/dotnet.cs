// Independent installed C# checks for generic Subtype compositions.
using System;
using System.Numerics;
using LeanBridge.Nominalsubtypes;

static class Consumer
{
    static int checks, rejections;
    static BigInteger N(int value) => new(value);
    static GenericNat Generic(int value, int marker) => new(N(value), N(marker));
    static string Snapshot(GenericNat value) => $"{value.Value}:{value.Marker}";
    static void Check(bool condition, string label)
    {
        if (!condition) throw new InvalidOperationException("failed: " + label);
        checks++;
    }
    static void Call(string name, GenericNat input, Func<GenericNat, GenericNat> call, GenericNat expected)
    {
        var before = Snapshot(input); var result = call(input);
        Check(Snapshot(result) == Snapshot(expected), name + " exact copied result");
        Check(Snapshot(input) == before, name + " input unchanged");
    }
    static void Scalar(GenericNat input, BigInteger expected)
    {
        var before = Snapshot(input);
        Check(Api.GenericUse(input) == expected, "genericUse exact result");
        Check(Snapshot(input) == before, "genericUse input unchanged");
    }
    static void Refused<T>(string name, GenericNat input, Func<GenericNat, T> call, string constructor)
    {
        var before = Snapshot(input);
        var expected = "arg0.value was rejected by NominalSubtypes." + constructor;
        try { call(input); throw new InvalidOperationException("accepted: " + expected); }
        catch (ArgumentException error)
        {
            Check(error.GetType() == typeof(ArgumentException) && error.Message == expected
                && error.ParamName is null, name + " exact refusal");
        }
        Check(Snapshot(input) == before, name + " rejected input unchanged");
        rejections++;
    }
    static void Main()
    {
        Scalar(Generic(40, 2), N(43));
        Call("echoGenericFirst", Generic(40, 2), Api.EchoGenericFirst, Generic(41, 2));
        Call("echoGenericSecond", Generic(40, 2), Api.EchoGenericSecond, Generic(42, 2));
        Scalar(Generic(99, 7), N(107));
        Call("echoGenericFirst", Generic(99, 7), Api.EchoGenericFirst, Generic(100, 7));
        Refused("genericUse", Generic(100, 2), Api.GenericUse, "plusOne");
        Refused("echoGenericFirst", Generic(100, 2), Api.EchoGenericFirst, "plusOne");
        Refused("echoGenericSecond", Generic(90, 2), Api.EchoGenericSecond, "plusTwo");
        Call("echoGenericSecond", Generic(40, 2), Api.EchoGenericSecond, Generic(42, 2));
        Console.WriteLine($"{{\"checks\":{checks},\"rejections\":{rejections}}}");
    }
}
