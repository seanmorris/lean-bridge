// Installed .NET acceptance for directional callback checked records.
using System;
using System.Numerics;
using LeanBridge.Callbackcheckedrecords;

static class Consumer
{
    private static int checks;
    private static int calls;

    private static BigInteger N(int value) => new(value);
    private static Interval Interval(int lo, int hi) => new(N(lo), N(hi));
    private static Weighted Weighted(int weight, int limit) => new(N(weight), N(limit));
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
        Func<Interval, Interval> widen = value => {
            calls++;
            if (value != Interval(1, 3)) throw new InvalidOperationException("proof-free host argument");
            return Interval(1, 4);
        };
        Check(Api.CallHost(new(widen, Interval(1, 3))) == N(3), "valid host reply");
        var before = calls;
        Check(RefusesInput(() => Api.CallHost(new(widen, Interval(3, 1)))),
            "invalid recovery status");
        Check(calls == before, "invalid recovery stops callback");
        Check(RefusesResult(() => Api.CallHost(new(_ => Interval(5, 2), Interval(1, 3)))),
            "invalid host reply status");
        Check(calls == before, "invalid reply does not use counted callback");
        Check(Api.CallHost(new(widen, Interval(1, 3))) == N(3), "host recovery reuse");
        var sentinel = new InvalidOperationException("callback failed");
        Check(ReferenceEquals(Reject<InvalidOperationException>(() => Api.CallHost(
            new WithRecovery<Func<Interval, Interval>, Interval>(_ => throw sentinel, Interval(1, 3)))), sentinel),
            "callback exception identity");
        Check(Api.CallHostMixed(new WithRecovery<Func<BigInteger, Interval, Interval>, Interval>(
            (marker, value) => new(value.Lo, value.Hi + marker - N(5)), Interval(1, 3))) == N(4),
            "mixed host reply");

        using (var closure = Api.MakeClosure(N(9)))
        {
            Check(closure.Invoke(Interval(2, 5)) == N(3), "closure result");
            Check(RefusesInput(() => closure.Invoke(Interval(5, 2))),
                "closure argument status");
            Check(closure.Invoke(Interval(3, 3)) == BigInteger.Zero, "closure recovery");
            closure.Dispose(); closure.Dispose();
            Check(closure.IsClosed, "closure closes idempotently");
        }
        using (var mixed = Api.MakeMixedClosure(BigInteger.Zero))
        {
            Check(mixed.Invoke(N(9), Interval(2, 5)) == Interval(2, 5), "mixed closure result");
            Check(RefusesInput(() => mixed.Invoke(N(9), Interval(5, 2))),
                "mixed closure argument status");
            Check(mixed.Invoke(N(9), Interval(3, 4)) == Interval(3, 4), "mixed closure recovery");
        }

        var none = Option<Interval>.None;
        var containerRecovery = Result<Option<Interval>, string>.Ok(none);
        Check(Api.CallHostContainer(new WithRecovery<Func<Option<Interval>, Result<Option<Interval>, string>>,
            Result<Option<Interval>, string>>(_ => Result<Option<Interval>, string>.Ok(
                Option<Interval>.Some(Interval(1, 4))), containerRecovery)) == N(3), "container host reply");
        Check(RefusesResult(() => Api.CallHostContainer(new(
            _ => Result<Option<Interval>, string>.Ok(Option<Interval>.Some(Interval(4, 1))),
            containerRecovery))), "container host reply status");
        using (var container = Api.MakeContainerClosure(BigInteger.Zero))
        {
            Check(container.Invoke(new[] { none, Option<Interval>.Some(Interval(2, 5)) }).IsNone,
                "container closure result");
            Check(RefusesInput(() => container.Invoke(
                new[] { Option<Interval>.Some(Interval(5, 2)) })),
                "container closure argument status");
            Check(container.Invoke(Array.Empty<Option<Interval>>()).IsNone, "container closure recovery");
        }

        var reply = Weighted(2, 5);
        Func<Weighted, Weighted> reweigh = value => {
            calls++;
            if (value != Weighted(1, 2)) throw new InvalidOperationException("proof-free weighted argument");
            return reply;
        };
        Check(Api.CallHostNested(new(reweigh, Weighted(1, 2))) == N(3), "weighted host reply");
        reply = Weighted(0, 5);
        Check(RefusesResult(() => Api.CallHostNested(new(reweigh, Weighted(1, 2)))),
            "zero weight status");
        reply = Weighted(6, 5);
        Check(RefusesResult(() => Api.CallHostNested(new(reweigh, Weighted(1, 2)))),
            "weight above limit status");
        before = calls;
        Check(RefusesInput(() => Api.CallHostNested(new(reweigh, Weighted(0, 2)))),
            "invalid weighted recovery status");
        Check(calls == before, "invalid weighted recovery stops callback");
        reply = Weighted(2, 5);
        Check(Api.CallHostNested(new(reweigh, Weighted(1, 2))) == N(3), "weighted host recovery");
        using (var nested = Api.MakeNestedClosure(BigInteger.Zero))
        {
            Check(nested.Invoke(Weighted(2, 5)) == N(3), "weighted closure result");
            Check(RefusesInput(() => nested.Invoke(Weighted(0, 5))),
                "weighted closure zero status");
            Check(RefusesInput(() => nested.Invoke(Weighted(6, 5))),
                "weighted closure bound status");
            Check(nested.Invoke(Weighted(5, 5)) == BigInteger.Zero, "weighted closure recovery");
        }

        Console.WriteLine($"callback-checked-record-remaining-ok:{checks}");
    }
}
