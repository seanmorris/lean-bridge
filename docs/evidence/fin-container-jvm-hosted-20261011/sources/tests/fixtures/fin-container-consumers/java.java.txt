import java.math.BigInteger;
import java.util.Arrays;
import org.leanbridge.fincontainers.Api;
import org.leanbridge.fincontainers.Option;

final class Consumer {
    private Consumer() { }
    private static int checks;
    static void check(boolean value, String label) { if (!value) throw new AssertionError("failed: " + label); checks++; }
    static boolean rejected(Runnable action, String parameter, String bound) {
        try { action.run(); }
        catch (IllegalArgumentException error) { return (parameter + " is not below its Fin " + bound + " bound").equals(error.getMessage()); }
        return false;
    }
    static boolean throwsType(Class<? extends Throwable> type, Runnable action) {
        try { action.run(); } catch (Throwable error) { return type.isInstance(error); }
        return false;
    }
    static BigInteger n(long value) { return BigInteger.valueOf(value); }
    public static void main(String[] args) {
        BigInteger huge = BigInteger.ONE.shiftLeft(70), word = BigInteger.ONE.shiftLeft(32);
        BigInteger[] digits = new BigInteger[10], reversed = new BigInteger[10];
        for (int i = 0; i < 10; i++) { digits[i] = n(i); reversed[i] = n(9 - i); }
        // Array (Fin 10): every element is checked; results stay below the bound.
        check(Arrays.equals(Api.mirrorAll(digits), reversed), "mirror endpoints");
        check(Api.mirrorAll(new BigInteger[0]).length == 0, "empty array");
        for (int position = 0; position < 3; position++) {
            BigInteger[] bad = {n(1), n(2), n(3)};
            bad[position] = n(10);
            check(rejected(() -> Api.mirrorAll(bad), "arg0[" + position + "]", "10"), "invalid element at " + position);
            check(bad[position].equals(n(10)), "input unchanged");
        }
        check(rejected(() -> Api.mirrorAll(new BigInteger[]{word, n(1), n(2)}), "arg0[0]", "10"), "word element");
        check(throwsType(IllegalArgumentException.class, () -> Api.mirrorAll(new BigInteger[]{n(-1), n(1)})) && !rejected(() -> Api.mirrorAll(new BigInteger[]{n(-1), n(1)}), "arg0[0]", "10"), "negative is the Nat error");
        check(throwsType(NullPointerException.class, () -> Api.mirrorAll(new BigInteger[]{null})), "null element is rejected");
        // Array (Fin 0): only the empty array has values.
        check(Api.countNone(new BigInteger[0]).equals(n(0)), "Fin 0 empty");
        check(rejected(() -> Api.countNone(new BigInteger[]{n(0)}), "arg0[0]", "0"), "Fin 0 present");
        // List Huge: a 2^70 bound compared limb by limb.
        BigInteger last = huge.subtract(BigInteger.ONE);
        check(Api.sumHuge(new BigInteger[]{word, last}).equals(word.add(last)) && Api.sumHuge(new BigInteger[0]).equals(n(0)), "huge sums");
        check(rejected(() -> Api.sumHuge(new BigInteger[]{word, huge}), "arg0[1]", huge.toString()), "huge bound");
        // Option (Fin 1): none is valid; a present value is checked.
        check(Api.orDefault(Option.none()).equals(n(7)) && Api.orDefault(Option.some(n(0))).equals(n(0)), "option values");
        check(rejected(() -> Api.orDefault(Option.some(n(1))), "arg0?", "1"), "present Fin 1");
        // Array (Option Digit): only present elements are checked.
        @SuppressWarnings("unchecked")
        Option<BigInteger>[] mixed = new Option[]{Option.some(n(1)), Option.none(), Option.some(n(9))};
        check(Arrays.equals(Api.present(mixed), new BigInteger[]{n(1), n(9)}), "present digits");
        mixed[2] = Option.some(n(10));
        check(rejected(() -> Api.present(mixed), "arg0[2]?", "10"), "present invalid");
        mixed[2] = Option.none();
        check(Api.present(mixed).length == 1, "absent is never read");
        // List (Array Digit) -> Option (List Digit): nested rows.
        BigInteger[][] rows = {{n(1), n(2)}, {n(3)}};
        Option<BigInteger[]> flat = Api.flatten(rows);
        check(flat.isSome() && Arrays.equals(flat.value(), new BigInteger[]{n(1), n(2), n(3)}), "flatten rows");
        check(!Api.flatten(new BigInteger[0][]).isSome(), "no rows");
        rows[1][0] = n(10);
        check(rejected(() -> Api.flatten(rows), "arg0[1][0]", "10"), "nested invalid last");
        // A late refined argument after an unrefined one.
        String[] names = {"a", "b"};
        check(Api.label(names, new BigInteger[]{n(1), n(3)}).equals("a:1,b:3"), "label");
        check(rejected(() -> Api.label(names, new BigInteger[]{n(1), n(4)}), "arg1[1]", "4") && names[1].equals("b"), "late argument, caller data unchanged");
        // A result-only container refinement projects each element after Lean returns.
        check(Arrays.equals(Api.wrapAll(new BigInteger[]{n(100), huge}), new BigInteger[]{n(2), n(2)}) && Api.wrapAll(new BigInteger[0]).length == 0, "wrapped results");
        for (int i = 0; i < 1000; i++) {
            final int k = i;
            if (!rejected(() -> Api.mirrorAll(new BigInteger[]{n(10 + k % 5)}), "arg0[0]", "10")) throw new AssertionError("invalid call accepted at " + i);
            if (!Api.mirrorAll(new BigInteger[]{n(i % 10)})[0].equals(n(9 - i % 10))) throw new AssertionError("valid call failed at " + i);
        }
        checks += 2000;
        System.out.println("fin-container-ok:" + checks);
    }
}
