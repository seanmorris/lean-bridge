import java.lang.reflect.Method;
import java.math.BigInteger;
import java.util.Arrays;
import org.leanbridge.specialized.Api;
class Consumer {
    static int checks;
    static void check(boolean value) { if (!value) throw new AssertionError("Specialization mismatch"); ++checks; }
    public static void main(String[] args) {
        String greeting = "héllo 🙂";
        // One generic declaration, three concrete exports.
        check(Api.echoWord(0) == 0 && Api.echoWord(4294967295L) == 4294967295L);
        check(Api.echoText(greeting).equals(greeting) && Api.echoText("").isEmpty());
        BigInteger large = BigInteger.ONE.shiftLeft(200);
        check(Api.echoNat(large).equals(large));
        long[] words = {0, 42, 4294967295L};
        check(Arrays.equals(Api.echoWords(words), words));
        // No open generic method is exposed.
        for (Method method : Api.class.getDeclaredMethods()) {
            check(method.getTypeParameters().length == 0);
            for (String name : new String[]{"echo", "choose", "first", "duplicate"}) check(!method.getName().equals(name));
        }
        // Lean resolved each instance dictionary at build time.
        check(Api.chooseWord(true, 5) == 5 && Api.chooseWord(false, 5) == 37);
        check(Api.chooseText(true, greeting).equals(greeting) && Api.chooseText(false, greeting).isEmpty());
        check(Arrays.equals(Api.chooseWords(true, words), words) && Api.chooseWords(false, words).length == 0);
        check(Api.doubleWord(2147483649L) == 2);
        check(Api.doubleNat(BigInteger.ONE.shiftLeft(100)).equals(BigInteger.ONE.shiftLeft(101)));
        check(Api.firstTextWord(greeting, 9).equals(greeting));
        check(Api.plain(1) == 4);
        // Each export keeps its own concrete argument checks.
        for (Runnable call : new Runnable[]{() -> Api.echoWord(4294967296L), () -> Api.echoWord(-1), () -> Api.echoNat(BigInteger.valueOf(-1)), () -> Api.echoText(null)}) {
            boolean rejected = false;
            try { call.run(); } catch (IllegalArgumentException | NullPointerException error) { rejected = true; }
            check(rejected);
        }
        for (long i = 0; i < 1000; ++i) {
            check(Api.chooseWord(i % 2 == 0, i) == (i % 2 == 0 ? i : 37));
            check(Api.doubleWord(i) == 2 * i);
        }
        System.out.println("specialization-ok:" + checks);
    }
}
