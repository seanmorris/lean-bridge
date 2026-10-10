import java.math.BigInteger;
import java.util.Arrays;
import org.leanbridge.finproductarrays.Api;
import org.leanbridge.finproductarrays.Pair;
import org.leanbridge.finproductarrays.Result;

final class Consumer {
    private Consumer() { }
    private static int checks;
    static void check(boolean value, String label) { if (!value) throw new AssertionError("failed: " + label); checks++; }
    static boolean rejected(Runnable action, String parameter, String bound) {
        try { action.run(); }
        catch (IllegalArgumentException error) { return (parameter + " is not below its Fin " + bound + " bound").equals(error.getMessage()); }
        return false;
    }
    static BigInteger n(long value) { return BigInteger.valueOf(value); }
    static final BigInteger HUGE = BigInteger.ONE.shiftLeft(100);
    /** (0, ok 2^100), (2, error 5), (3, ok 6): both endpoints, and ok values no bound applies to. */
    @SuppressWarnings("unchecked")
    static Pair<BigInteger, Result<BigInteger, BigInteger>>[] valid() {
        return (Pair<BigInteger, Result<BigInteger, BigInteger>>[]) new Pair<?, ?>[] { new Pair<>(n(0), Result.ok(HUGE))
            , new Pair<>(n(2), Result.err(n(5))), new Pair<>(n(3), Result.ok(n(6))) };
    }
    public static void main(String[] args) {
        BigInteger expected = HUGE.add(n(1016));
        // An empty array is valid, in and out.
        check(Api.rows(Arrays.copyOf(valid(), 0)).equals(n(0)), "empty rows");
        check(Api.reversed(Arrays.copyOf(valid(), 0)).length == 0, "empty reversed");
        var rows = valid();
        check(Api.rows(rows).equals(expected), "valid rows");
        // A component at its bound is rejected in the first, middle and last element.
        for (int k = 0; k < 3; k++) {
            rows[k] = new Pair<>(n(4), rows[k].second());
            var before = rows.clone();
            check(rejected(() -> Api.rows(rows), "arg0[" + k + "].0", "4") && Arrays.equals(rows, before), "component at " + k);
            rows[k] = valid()[k];
        }
        // The active error branch is bounded: error 6 is rejected, while ok 6 in the last row passed above.
        rows[1] = new Pair<>(n(2), Result.err(n(6)));
        var before = rows.clone();
        check(rejected(() -> Api.rows(rows), "arg0[1].1.error", "6") && Arrays.equals(rows, before), "error branch at bound");
        rows[1] = valid()[1];
        // A valid call recovers.
        check(Arrays.equals(rows, valid()), "caller rows unchanged");
        check(Api.rows(rows).equals(expected), "recovery");
        // Lean returns the rows reversed, each below its bounds.
        var expectedReversed = valid();
        java.util.Collections.reverse(Arrays.asList(expectedReversed));
        check(Arrays.equals(Api.reversed(rows), expectedReversed), "reversed");
        for (int i = 0; i < 1000; i++) {
            if (!Api.rows(rows).equals(expected)) throw new AssertionError("round " + i + " failed");
            var bad = valid(); bad[2] = new Pair<>(n(4 + i), bad[2].second());
            if (!rejected(() -> Api.rows(bad), "arg0[2].0", "4") || !bad[2].first().equals(n(4 + i))) throw new AssertionError("rejection round " + i + " failed");
        }
        checks += 2000;
        System.out.println("fin-product-array-ok:" + checks);
    }
}
