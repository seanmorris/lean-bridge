// Installed Java acceptance for directional callback Subtypes.
import java.math.BigInteger;
import org.leanbridge.callbacksubtypes.Api;
import org.leanbridge.callbacksubtypes.FnNatNatToNatHost;
import org.leanbridge.callbacksubtypes.FnNatToNatHost;
import org.leanbridge.callbacksubtypes.LeanBridgeException;
import org.leanbridge.callbacksubtypes.WithRecovery;

final class Consumer {
    private static int checks;
    private static int calls;
    private static final BigInteger ZERO = BigInteger.ZERO;
    private static final BigInteger ONE = BigInteger.ONE;
    private static BigInteger n(long value) { return BigInteger.valueOf(value); }
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
    public static void main(String[] arguments) {
        FnNatToNatHost increment = value -> { calls++; return value.add(ONE); };
        check(Api.callHost(new WithRecovery<>(increment, ONE)).equals(n(2)), "valid host result");
        int before = calls;
        check(refusesInput(() -> Api.callHost(new WithRecovery<>(increment, ZERO))), "invalid recovery status");
        check(calls == before, "invalid recovery stops callback");
        check(refusesResult(() -> Api.callHost(new WithRecovery<>((FnNatToNatHost)(_value -> ZERO), ONE))),
            "invalid host result status");
        var sentinel = new IllegalStateException("callback failed");
        check(reject(IllegalStateException.class, () -> Api.callHost(
            new WithRecovery<>((FnNatToNatHost)(_value -> { throw sentinel; }), ONE))) == sentinel,
            "callback exception identity");
        check(Api.callHost(new WithRecovery<>((FnNatToNatHost)(value -> value), ONE)).equals(ONE), "host recovery reuse");
        check(Api.callHostMixed(new WithRecovery<>((FnNatNatToNatHost)(marker, value) -> marker.subtract(n(5)).add(value), ONE)).equals(n(3)), "mixed host result");

        var closure = Api.makeClosure(n(9));
        try {
            check(closure.invoke(n(2)).equals(n(2)), "closure result");
            check(refusesInput(() -> closure.invoke(ZERO)), "closure argument status");
            check(closure.invoke(n(3)).equals(n(3)), "closure recovery");
            closure.close(); closure.close();
            check(closure.isClosed(), "closure closes idempotently");
        }
        finally { closure.close(); }
        try (var mixed = Api.makeMixedClosure(ZERO)) {
            check(mixed.invoke(n(9), n(2)).equals(n(2)), "mixed closure result");
            check(refusesInput(() -> mixed.invoke(n(9), ZERO)), "mixed closure argument status");
            check(mixed.invoke(n(9), n(3)).equals(n(3)), "mixed closure recovery");
        }
        System.out.println("callback-subtype-remaining-ok:" + checks);
    }
}
