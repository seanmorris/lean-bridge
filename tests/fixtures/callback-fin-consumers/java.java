// Installed Java acceptance for checked Fin callbacks and Lean closures.
import java.math.BigInteger;
import org.leanbridge.reviewedcallbacks.*;

final class Consumer {
    private static int checks;
    private static int calls;
    private static BigInteger n(long value) { return BigInteger.valueOf(value); }
    private static void check(boolean value, String label) {
        if (!value) throw new AssertionError(label);
        checks++;
    }
    private static <T extends Throwable> T reject(Class<T> kind, Runnable operation) {
        try { operation.run(); }
        catch (Throwable error) {
            if (kind.isInstance(error)) return kind.cast(error);
            throw error;
        }
        throw new AssertionError("expected " + kind.getName());
    }
    private static boolean refuses(Runnable operation, String message) {
        return reject(IllegalArgumentException.class, operation)
            .getMessage().equals(message);
    }

    public static void main(String[] arguments) {
        var scaler = Api.scaler(n(3));
        check(scaler.invoke(n(4)).equals(n(12)), "bounded closure argument");
        check(refuses(() -> scaler.invoke(n(10)),
            "arg0 is not below its Fin 10 bound"), "Fin 10 is refused");
        check(scaler.invoke(n(9)).equals(n(27)), "closure remains usable");

        var counter = Api.counter(n(8));
        check(counter.invoke(n(4)).equals(n(2)), "Lean-produced Fin result");

        check(Api.visit(value -> {
            calls++;
            if (value.signum() < 0 || value.compareTo(n(5)) >= 0)
                throw new AssertionError("Lean supplied an invalid Fin");
            return value;
        }).equals(n(10)),
            "checked host callback arguments");
        check(calls == 5, "host receives every Fin 5 value");
        var sentinel = new IllegalStateException("callback Fin sentinel");
        check(reject(IllegalStateException.class, () -> Api.visit(
            _value -> { throw sentinel; })) == sentinel,
            "callback exception identity");
        check(Api.apply(value -> value.add(BigInteger.ONE), n(2)).equals(n(3)),
            "unrefined callback stays direct");

        var digits = Api.digits(Unit.INSTANCE);
        check(digits.invoke(new BigInteger[] { n(1), n(2) }).equals(n(5)),
            "nested Fin callback argument");
        check(refuses(() -> digits.invoke(new BigInteger[] { n(3) }),
            "arg0[0] is not below its Fin 3 bound"),
            "nested bound is refused");
        check(digits.invoke(new BigInteger[0]).equals(BigInteger.ZERO),
            "nested closure remains usable");

        var tiles = Api.tiles(Unit.INSTANCE);
        check(tiles.invoke(new Tile[] { new Tile(n(4), n(2)) }).equals(n(402)),
            "nominal Fin callback field");
        check(refuses(() -> tiles.invoke(new Tile[] { new Tile(n(5), n(2)) }),
            "arg0[0].digit is not below its Fin 5 bound"),
            "nominal Fin field is refused");

        var tileMaker = Api.tileMaker(n(3));
        check(tileMaker.invoke(n(4)).equals(new Tile(n(2), n(4))),
            "Lean-produced nominal Fin field");

        scaler.close(); scaler.close(); check(scaler.isClosed(), "scaler closes");
        counter.close(); counter.close(); check(counter.isClosed(), "counter closes");
        digits.close(); digits.close(); check(digits.isClosed(), "digits closes");
        tiles.close(); tiles.close(); check(tiles.isClosed(), "tiles closes");
        tileMaker.close(); tileMaker.close(); check(tileMaker.isClosed(), "tile maker closes");

        System.out.println("callback-fin-remaining-ok:" + checks);
    }
}
