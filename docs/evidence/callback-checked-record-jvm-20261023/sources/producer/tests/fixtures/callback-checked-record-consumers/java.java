// Installed Java acceptance for directional callback checked records.
import java.math.BigInteger;
import org.leanbridge.callbackcheckedrecords.*;

final class Consumer {
    private static int checks;
    private static int calls;
    private static BigInteger n(long value) { return BigInteger.valueOf(value); }
    private static Interval interval(long lo, long hi) { return new Interval(n(lo), n(hi)); }
    private static Weighted weighted(long weight, long limit) { return new Weighted(n(weight), n(limit)); }
    private static void check(boolean value, String label) {
        if (!value) throw new AssertionError(label);
        checks++;
    }
    private static <T extends Throwable> T reject(Class<T> kind, Runnable operation) {
        try { operation.run(); }
        catch (Throwable error) { if (kind.isInstance(error)) return kind.cast(error); throw error; }
        throw new AssertionError("expected " + kind.getName());
    }
    private static boolean refusesInput(Runnable operation) {
        return reject(IllegalArgumentException.class, operation).getMessage().equals("Invalid native copied input");
    }
    private static boolean refusesResult(Runnable operation) {
        var error = reject(LeanBridgeException.class, operation);
        return error.status() == 1 && error.getMessage().equals("Host callback result failed its Lean constructor");
    }
    @SafeVarargs
    @SuppressWarnings("varargs")
    private static Option<Interval>[] options(Option<Interval>... values) { return values; }

    public static void main(String[] arguments) {
        FnCallback96775311ba874014bff2 widen = value -> {
            calls++;
            if (!value.equals(interval(1, 3))) throw new AssertionError("proof-free host argument");
            return interval(1, 4);
        };
        check(Api.callHost(new WithRecovery<>(widen, interval(1, 3))).equals(n(3)), "valid host reply");
        int before = calls;
        check(refusesInput(() -> Api.callHost(new WithRecovery<>(widen, interval(3, 1)))),
            "invalid recovery status");
        check(calls == before, "invalid recovery stops callback");
        check(refusesResult(() -> Api.callHost(new WithRecovery<>(
            (FnCallback96775311ba874014bff2)(_value -> interval(5, 2)), interval(1, 3)))),
            "invalid host reply status");
        check(calls == before, "invalid reply does not use counted callback");
        check(Api.callHost(new WithRecovery<>(widen, interval(1, 3))).equals(n(3)), "host recovery reuse");
        var sentinel = new IllegalStateException("callback failed");
        check(reject(IllegalStateException.class, () -> Api.callHost(new WithRecovery<>(
            (FnCallback96775311ba874014bff2)(_value -> { throw sentinel; }), interval(1, 3)))) == sentinel,
            "callback exception identity");
        check(Api.callHostMixed(new WithRecovery<>((FnCallback44d43ec6a49b0f13f8ab)((marker, value) ->
            new Interval(value.lo(), value.hi().add(marker).subtract(n(5)))), interval(1, 3))).equals(n(4)),
            "mixed host reply");

        var closure = Api.makeClosure(n(9));
        try {
            check(closure.invoke(interval(2, 5)).equals(n(3)), "closure result");
            check(refusesInput(() -> closure.invoke(interval(5, 2))),
                "closure argument status");
            check(closure.invoke(interval(3, 3)).equals(BigInteger.ZERO), "closure recovery");
            closure.close(); closure.close();
            check(closure.isClosed(), "closure closes idempotently");
        }
        finally { closure.close(); }
        try (var mixed = Api.makeMixedClosure(BigInteger.ZERO)) {
            check(mixed.invoke(n(9), interval(2, 5)).equals(interval(2, 5)), "mixed closure result");
            check(refusesInput(() -> mixed.invoke(n(9), interval(5, 2))),
                "mixed closure argument status");
            check(mixed.invoke(n(9), interval(3, 4)).equals(interval(3, 4)), "mixed closure recovery");
        }

        Option<Interval> none = Option.none();
        Result<Option<Interval>, String> containerRecovery = Result.ok(none);
        check(Api.callHostContainer(new WithRecovery<>((FnCallback115f6922f8f3e5b91c8e)(_value ->
            Result.ok(Option.some(interval(1, 4)))), containerRecovery)).equals(n(3)), "container host reply");
        check(refusesResult(() -> Api.callHostContainer(new WithRecovery<>(
            (FnCallback115f6922f8f3e5b91c8e)(_value -> Result.ok(Option.some(interval(4, 1)))),
            containerRecovery))), "container host reply status");
        try (var container = Api.makeContainerClosure(BigInteger.ZERO)) {
            check(!container.invoke(options(none, Option.some(interval(2, 5)))).isSome(),
                "container closure result");
            check(refusesInput(() -> container.invoke(options(Option.some(interval(5, 2))))),
                "container closure argument status");
            check(!container.invoke(options()).isSome(), "container closure recovery");
        }

        Weighted[] reply = { weighted(2, 5) };
        FnCallbackb782f62c1be9d8b0085a reweigh = value -> {
            calls++;
            if (!value.equals(weighted(1, 2))) throw new AssertionError("proof-free weighted argument");
            return reply[0];
        };
        check(Api.callHostNested(new WithRecovery<>(reweigh, weighted(1, 2))).equals(n(3)), "weighted host reply");
        reply[0] = weighted(0, 5);
        check(refusesResult(() -> Api.callHostNested(new WithRecovery<>(reweigh, weighted(1, 2)))),
            "zero weight status");
        reply[0] = weighted(6, 5);
        check(refusesResult(() -> Api.callHostNested(new WithRecovery<>(reweigh, weighted(1, 2)))),
            "weight above limit status");
        before = calls;
        check(refusesInput(() -> Api.callHostNested(new WithRecovery<>(reweigh, weighted(0, 2)))),
            "invalid weighted recovery status");
        check(calls == before, "invalid weighted recovery stops callback");
        reply[0] = weighted(2, 5);
        check(Api.callHostNested(new WithRecovery<>(reweigh, weighted(1, 2))).equals(n(3)),
            "weighted host recovery");
        try (var nested = Api.makeNestedClosure(BigInteger.ZERO)) {
            check(nested.invoke(weighted(2, 5)).equals(n(3)), "weighted closure result");
            check(refusesInput(() -> nested.invoke(weighted(0, 5))),
                "weighted closure zero status");
            check(refusesInput(() -> nested.invoke(weighted(6, 5))),
                "weighted closure bound status");
            check(nested.invoke(weighted(5, 5)).equals(BigInteger.ZERO), "weighted closure recovery");
        }
        System.out.println("callback-checked-record-remaining-ok:" + checks);
    }
}
