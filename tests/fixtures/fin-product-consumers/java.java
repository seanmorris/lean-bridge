import java.math.BigInteger;
import org.leanbridge.finproducts.Api;
import org.leanbridge.finproducts.Option;
import org.leanbridge.finproducts.Pair;
import org.leanbridge.finproducts.Result;

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
    static Pair<BigInteger, BigInteger> pair(BigInteger a, BigInteger b) { return new Pair<>(a, b); }
    @SuppressWarnings("unchecked")
    static Option<Pair<BigInteger, Result<BigInteger, BigInteger>>>[] rows(long a, long b) {
        return (Option<Pair<BigInteger, Result<BigInteger, BigInteger>>>[]) new Option<?>[] { Option.none()
            , Option.some(new Pair<>(n(a), Result.ok(n(50)))), Option.some(new Pair<>(n(1), Result.err(n(b)))) };
    }
    public static void main(String[] args) {
        BigInteger wide = n(10).shiftLeft(64).add(n(10));
        // Fin 10 × Nat: only the first component is bounded.
        for (int d = 0; d < 10; d++) check(Api.first(pair(n(d), n(1000))).equals(pair(n(9 - d), n(1001))), "first valid");
        check(rejected(() -> Api.first(pair(n(10), n(0))), "arg0.0", "10"), "first at bound");
        check(rejected(() -> Api.first(pair(BigInteger.ONE.shiftLeft(70), n(0))), "arg0.0", "10"), "first beyond 64 bits");
        check(Api.first(pair(n(3), BigInteger.ONE.shiftLeft(200))).second().equals(BigInteger.ONE.shiftLeft(200).add(n(1))), "unbounded component");
        // Nat × Fin 1, and a bound wider than 64 bits beside Fin 10.
        check(Api.second(pair(n(41), n(0))).equals(n(41)), "second valid");
        check(rejected(() -> Api.second(pair(n(41), n(1))), "arg0.1", "1"), "second at bound");
        check(Api.wide(pair(wide.subtract(n(1)), n(9))).equals(wide.add(n(8))), "wide valid");
        check(rejected(() -> Api.wide(pair(wide, n(9))), "arg0.0", wide.toString()), "wide at bound");
        check(rejected(() -> Api.wide(pair(wide.subtract(n(1)), n(10))), "arg0.1", "10"), "wide second at bound");
        // Option (Fin 0 × Nat): only none is valid.
        check(Api.absentOnly(Option.none()).equals(n(7)), "absent only none");
        check(rejected(() -> Api.absentOnly(Option.some(pair(n(0), n(0)))), "arg0?.0", "0"), "absent only some");
        // Except String (Fin 10): the ok branch is bounded; an inactive branch is never read.
        check(Api.okOnly(Result.ok(n(9))).equals(n(9)), "ok valid");
        check(rejected(() -> Api.okOnly(Result.ok(n(10))), "arg0.ok", "10"), "ok at bound");
        check(Api.okOnly(Result.err("four")).equals(n(104)), "inactive ok");
        // Except (Fin 5) Nat: the error branch is bounded; any ok Nat is valid.
        check(Api.errorOnly(Result.ok(BigInteger.ONE.shiftLeft(100))).equals(BigInteger.ONE.shiftLeft(100)), "unbounded ok");
        check(Api.errorOnly(Result.err(n(4))).equals(n(104)), "error valid");
        check(rejected(() -> Api.errorOnly(Result.err(n(5))), "arg0.error", "5"), "error at bound");
        // Except (Fin 3) (Fin 7): only the active branch is checked.
        check(Api.both(Result.ok(n(6))).equals(n(6)), "both ok valid");
        check(rejected(() -> Api.both(Result.ok(n(7))), "arg0.ok", "7"), "both ok at bound");
        check(Api.both(Result.err(n(2))).equals(n(102)), "both error valid");
        check(rejected(() -> Api.both(Result.err(n(3))), "arg0.error", "3"), "both error at bound");
        // List (Option (Fin 3 × Except (Fin 2) Nat)): every present element, both levels.
        check(Api.nested(rows(2, 1)).equals(n(54)), "nested valid");
        check(rejected(() -> Api.nested(rows(2, 2)), "arg0[2]?.1.error", "2"), "nested branch");
        check(rejected(() -> Api.nested(rows(3, 1)), "arg0[1]?.0", "3"), "nested component");
        check(Api.nested(rows(2, 1)).equals(n(54)), "nested recovery");
        // DigitPair := Digit × Digit through the alias.
        check(Api.aliased(pair(n(1), n(9))).equals(pair(n(9), n(1))), "aliased valid");
        check(rejected(() -> Api.aliased(pair(n(1), n(10))), "arg0.1", "10"), "aliased at bound");
        // Results carrying bounds are produced by Lean and arrive below them.
        Result<String, BigInteger> produced = Api.produce(n(4));
        check(!produced.isOk() && produced.error().equals(n(4)), "produce error");
        check(Api.produce(n(23)).isOk(), "produce ok");
        check(Api.pairUp(n(23)).equals(pair(n(3), n(23))), "pair up");
        for (int i = 0; i < 1000; i++) {
            final int round = i;
            if (!Api.first(pair(n(i % 10), n(i))).first().equals(n(9 - i % 10))) throw new AssertionError("round " + i + " failed");
            if (!rejected(() -> Api.first(pair(n(10 + round), n(round))), "arg0.0", "10")) throw new AssertionError("rejection round " + i + " failed");
        }
        checks += 2000;
        System.out.println("fin-product-ok:" + checks);
    }
}
