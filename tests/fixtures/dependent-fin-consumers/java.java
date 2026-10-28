import java.math.BigInteger;
import org.leanbridge.dependentfin.Api;

final class Consumer {
    private Consumer() { }
    private static int checks;
    static void check(boolean value, String label) { if (!value) throw new AssertionError("failed: " + label); checks++; }
    static boolean rejected(Runnable action, String parameter, String bound) {
        try { action.run(); }
        catch (IllegalArgumentException error) { return (parameter + " is not below its dependent Fin bound " + bound).equals(error.getMessage()); }
        return false;
    }
    static boolean throwsType(Class<? extends Throwable> type, Runnable action) {
        try { action.run(); } catch (Throwable error) { return type.isInstance(error); }
        return false;
    }
    static BigInteger n(long value) { return BigInteger.valueOf(value); }
    public static void main(String[] args) {
        BigInteger huge = BigInteger.ONE.shiftLeft(70), word = BigInteger.ONE.shiftLeft(32);
        BigInteger lastHuge = huge.subtract(BigInteger.ONE), lastWord = word.subtract(BigInteger.ONE);
        // Fin 0: the live bound zero has no values.
        check(rejected(() -> Api.mirror(n(0), n(0)), "arg1", "arg0"), "Fin 0 rejects zero");
        check(rejected(() -> Api.mirror(n(0), n(1)), "arg1", "arg0"), "Fin 0 rejects one");
        // Fin 1: only zero.
        check(Api.mirror(n(1), n(0)).equals(n(0)), "Fin 1 accepts zero");
        check(rejected(() -> Api.mirror(n(1), n(1)), "arg1", "arg0"), "Fin 1 rejects its bound");
        // The exact endpoints of a small live bound.
        check(Api.mirror(n(10), n(0)).equals(n(9)) && Api.mirror(n(10), n(9)).equals(n(0)), "Fin 10 endpoints");
        for (BigInteger value : new BigInteger[]{n(10), n(11), word, huge})
            check(rejected(() -> Api.mirror(n(10), value), "arg1", "arg0"), "Fin 10 rejects " + value);
        // Live bounds wider than a machine word are compared limb by limb.
        check(Api.mirror(word, lastWord).equals(n(0)) && Api.mirror(word.add(BigInteger.ONE), word).equals(n(0)), "word bounds");
        check(rejected(() -> Api.mirror(word, word), "arg1", "arg0"), "word bound rejects itself");
        check(Api.mirror(huge, lastHuge).equals(n(0)) && Api.mirror(huge, n(0)).equals(lastHuge), "huge endpoints");
        check(Api.mirror(huge.add(BigInteger.ONE), huge).equals(n(0)), "one past a huge bound");
        for (BigInteger value : new BigInteger[]{huge, huge.add(BigInteger.ONE), BigInteger.ONE.shiftLeft(128)})
            check(rejected(() -> Api.mirror(huge, value), "arg1", "arg0"), "huge bound rejects " + value);
        // The bound is the argument of this call, never a frozen constant.
        for (int bound = 0; bound < 12; bound++) {
            final int live = bound;
            if (live > 5) check(Api.mirror(n(live), n(5)).equals(n(live - 6)), "value 5 below live bound " + live);
            else check(rejected(() -> Api.mirror(n(live), n(5)), "arg1", "arg0"), "value 5 at or above live bound " + live);
        }
        // Only the named earlier parameter bounds the value, not an unrelated earlier Nat.
        check(Api.label(n(100), n(3), n(2), "slot").equals("slot:102"), "later dependency");
        check(rejected(() -> Api.label(n(100), n(3), n(3), "slot"), "arg2", "arg1"), "bound is arg1, not the larger arg0");
        check(rejected(() -> Api.label(n(100), n(0), n(0), "slot"), "arg2", "arg1"), "Fin 0 at a later site");
        check(Api.label(n(0), huge, lastHuge, "x").equals("x:" + lastHuge), "huge later bound");
        // A negative Nat is the Nat error, not a dependent Fin rejection.
        check(throwsType(IllegalArgumentException.class, () -> Api.mirror(n(-1), n(0))) && !rejected(() -> Api.mirror(n(-1), n(0)), "arg1", "arg0"), "negative bound");
        check(throwsType(IllegalArgumentException.class, () -> Api.mirror(n(5), n(-1))) && !rejected(() -> Api.mirror(n(5), n(-1)), "arg1", "arg0"), "negative value");
        check(throwsType(NullPointerException.class, () -> Api.mirror(n(5), null)), "null value is rejected");
        // Rejection leaves caller data unchanged.
        BigInteger start = n(7), limit = n(4), digit = n(4);
        String name = "slot";
        check(rejected(() -> Api.label(start, limit, digit, name), "arg2", "arg1"), "rejected label");
        check(start.equals(n(7)) && limit.equals(n(4)) && digit.equals(n(4)) && name.equals("slot") && Api.label(start, limit, n(3), name).equals("slot:10"), "caller data unchanged");
        // Repeated invalid and valid calls recover; the bound changes every call.
        for (int i = 0; i < 1000; i++) {
            final int k = i;
            if (!rejected(() -> Api.mirror(n(10), n(10 + k % 5)), "arg1", "arg0")) throw new AssertionError("invalid call accepted at " + i);
            if (!Api.mirror(n(i % 7 + 1), n(i % 7)).equals(n(0)) || !Api.mirror(n(10), n(i % 10)).equals(n(9 - i % 10))) throw new AssertionError("valid call failed at " + i);
        }
        checks += 2000;
        System.out.println("dependent-fin-ok:" + checks);
    }
}
