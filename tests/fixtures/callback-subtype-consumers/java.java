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
    public static void main(String[] arguments) {
        FnNatToNatHost increment = value -> { calls++; return value.add(ONE); };
        check(Api.callHost(new WithRecovery<>(increment, ONE)).equals(n(2)), "valid host result");
        int before = calls;
        var recovery = reject(LeanBridgeException.class,
            () -> Api.callHost(new WithRecovery<>(increment, ZERO)));
        check(recovery.status() == 1, "invalid recovery status");
        check(calls == before, "invalid recovery stops callback");
        var result = reject(LeanBridgeException.class,
            () -> Api.callHost(new WithRecovery<>((FnNatToNatHost)(_value -> ZERO), ONE)));
        check(result.status() == 1, "invalid host result status");
        var sentinel = new IllegalStateException("callback failed");
        check(reject(IllegalStateException.class, () -> Api.callHost(
            new WithRecovery<>((FnNatToNatHost)(_value -> { throw sentinel; }), ONE))) == sentinel,
            "callback exception identity");
        check(Api.callHost(new WithRecovery<>((FnNatToNatHost)(value -> value), ONE)).equals(ONE), "host recovery reuse");
        check(Api.callHostMixed(new WithRecovery<>((FnNatNatToNatHost)(marker, value) -> marker.subtract(n(5)).add(value), ONE)).equals(n(3)), "mixed host result");

        try (var closure = Api.makeClosure(n(9))) {
            check(closure.invoke(n(2)).equals(n(2)), "closure result");
            check(reject(LeanBridgeException.class, () -> closure.invoke(ZERO)).status() == 1, "closure argument status");
            check(closure.invoke(n(3)).equals(n(3)), "closure recovery");
            closure.close(); closure.close();
            check(closure.isClosed(), "closure closes idempotently");
        }
        try (var mixed = Api.makeMixedClosure(ZERO)) {
            check(mixed.invoke(n(9), n(2)).equals(n(2)), "mixed closure result");
            check(reject(LeanBridgeException.class, () -> mixed.invoke(n(9), ZERO)).status() == 1, "mixed closure argument status");
            check(mixed.invoke(n(9), n(3)).equals(n(3)), "mixed closure recovery");
        }
        System.out.println("callback-subtype-remaining-ok:" + checks);
    }
}
