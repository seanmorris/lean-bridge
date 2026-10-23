// Installed .NET acceptance for directional callback Subtypes.
using System;
using System.Numerics;
using LeanBridge.Callbacksubtypes;

static class Consumer
{
    private static int checks;
    private static int calls;

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
    private static bool RefusesInput(Action operation) =>
        Reject<ArgumentException>(operation).Message == "Invalid native copied input";
    private static bool RefusesResult(Action operation)
    {
        var error = Reject<LeanBridgeException>(operation);
        return error.Status == 1 && error.Message == "Host callback result failed its Lean constructor";
    }

    public static void Main()
    {
        BigInteger N(int value) => new(value);
        var increment = new Func<BigInteger, BigInteger>(value => { calls++; return value + 1; });
        Check(Api.CallHost(new WithRecovery<Func<BigInteger, BigInteger>, BigInteger>(increment, N(1))) == N(2), "valid host result");
        var before = calls;
        Check(RefusesInput(() => Api.CallHost(
            new WithRecovery<Func<BigInteger, BigInteger>, BigInteger>(increment, BigInteger.Zero))), "invalid recovery status");
        Check(calls == before, "invalid recovery stops callback");
        Check(RefusesResult(() => Api.CallHost(
            new WithRecovery<Func<BigInteger, BigInteger>, BigInteger>(_ => BigInteger.Zero, BigInteger.One))), "invalid host result status");
        var sentinel = new InvalidOperationException("callback failed");
        Check(ReferenceEquals(Reject<InvalidOperationException>(() => Api.CallHost(
            new WithRecovery<Func<BigInteger, BigInteger>, BigInteger>(_ => throw sentinel, BigInteger.One))), sentinel), "callback exception identity");
        Check(Api.CallHost(new WithRecovery<Func<BigInteger, BigInteger>, BigInteger>(value => value, BigInteger.One)) == BigInteger.One, "host recovery reuse");
        Check(Api.CallHostMixed(new WithRecovery<Func<BigInteger, BigInteger, BigInteger>, BigInteger>(
            (marker, value) => marker - 5 + value, BigInteger.One)) == N(3), "mixed host result");

        using (var closure = Api.MakeClosure(N(9)))
        {
            Check(closure.Invoke(N(2)) == N(2), "closure result");
            Check(RefusesInput(() => closure.Invoke(BigInteger.Zero)), "closure argument status");
            Check(closure.Invoke(N(3)) == N(3), "closure recovery");
            closure.Dispose(); closure.Dispose();
            Check(closure.IsClosed, "closure closes idempotently");
        }
        using (var mixed = Api.MakeMixedClosure(BigInteger.Zero))
        {
            Check(mixed.Invoke(N(9), N(2)) == N(2), "mixed closure result");
            Check(RefusesInput(() => mixed.Invoke(N(9), BigInteger.Zero)), "mixed closure argument status");
            Check(mixed.Invoke(N(9), N(3)) == N(3), "mixed closure recovery");
        }
        Console.WriteLine($"callback-subtype-remaining-ok:{checks}");
    }
}
