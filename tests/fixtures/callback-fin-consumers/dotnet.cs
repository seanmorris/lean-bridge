// Installed .NET acceptance for checked Fin callbacks and Lean closures.
using System;
using System.Numerics;
using LeanBridge.Reviewedcallbacks;

static class Consumer
{
    private static int checks;
    private static int calls;
    private static BigInteger N(int value) => new(value);
    private static void Check(bool value, string label)
    {
        if (!value) throw new InvalidOperationException(label);
        checks++;
    }
    private static T Reject<T>(Action operation) where T : Exception
    {
        try { operation(); }
        catch (T error) { return error; }
        throw new InvalidOperationException("expected " + typeof(T).Name);
    }
    private static bool Refuses(Action operation) =>
        Reject<ArgumentException>(operation).Message == "Invalid native copied input";

    public static void Main()
    {
        var scaler = Api.Scaler(N(3));
        Check(scaler.Invoke(N(4)) == N(12), "bounded closure argument");
        Check(Refuses(() => scaler.Invoke(N(10))), "Fin 10 is refused");
        Check(scaler.Invoke(N(9)) == N(27), "closure remains usable");

        var counter = Api.Counter(N(8));
        Check(counter.Invoke(N(4)) == N(2), "Lean-produced Fin result");

        Func<BigInteger, BigInteger> host = value => {
            calls++;
            if (value < BigInteger.Zero || value >= N(5))
                throw new InvalidOperationException("Lean supplied an invalid Fin");
            return value;
        };
        Check(Api.Visit(new(host, BigInteger.Zero)) == N(10),
            "checked host callback arguments");
        Check(calls == 5, "host receives every Fin 5 value");
        var sentinel = new InvalidOperationException("callback Fin sentinel");
        Check(ReferenceEquals(Reject<InvalidOperationException>(() => Api.Visit(
            new WithRecovery<Func<BigInteger, BigInteger>, BigInteger>(
                _ => throw sentinel, BigInteger.Zero))), sentinel), "callback exception identity");
        Check(Api.Apply(value => value + BigInteger.One, N(2)) == N(3),
            "unrefined callback stays direct");

        var digits = Api.Digits(new Unit());
        Check(digits.Invoke(new[] { N(1), N(2) }) == N(5),
            "nested Fin callback argument");
        Check(Refuses(() => digits.Invoke(new[] { N(3) })), "nested bound is refused");
        Check(digits.Invoke(Array.Empty<BigInteger>()) == BigInteger.Zero,
            "nested closure remains usable");

        var tiles = Api.Tiles(new Unit());
        Check(tiles.Invoke(new[] { new Tile(N(4), N(2)) }) == N(402),
            "nominal Fin callback field");
        Check(Refuses(() => tiles.Invoke(new[] { new Tile(N(5), N(2)) })),
            "nominal Fin field is refused");

        var tileMaker = Api.TileMaker(N(3));
        Check(tileMaker.Invoke(N(4)) == new Tile(N(2), N(4)),
            "Lean-produced nominal Fin field");

        scaler.Dispose(); scaler.Dispose(); Check(scaler.IsClosed, "scaler closes");
        counter.Dispose(); counter.Dispose(); Check(counter.IsClosed, "counter closes");
        digits.Dispose(); digits.Dispose(); Check(digits.IsClosed, "digits closes");
        tiles.Dispose(); tiles.Dispose(); Check(tiles.IsClosed, "tiles closes");
        tileMaker.Dispose(); tileMaker.Dispose(); Check(tileMaker.IsClosed, "tile maker closes");

        Console.WriteLine($"callback-fin-remaining-ok:{checks}");
    }
}
