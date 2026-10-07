import java.math.BigInteger;
import org.leanbridge.subtypes.Api;

final class Consumer {
    private Consumer() { }
    private static int checks;
    static void check(boolean value, String label) { if (!value) throw new AssertionError("failed: " + label); checks++; }
    static boolean rejected(Runnable action, String message) {
        try { action.run(); }
        catch (IllegalArgumentException error) { return message.equals(error.getMessage()); }
        return false;
    }
    static boolean throwsType(Class<? extends Throwable> type, Runnable action) {
        try { action.run(); } catch (Throwable error) { return type.isInstance(error); }
        return false;
    }
    static BigInteger n(long value) { return BigInteger.valueOf(value); }
    public static void main(String[] args) {
        String hello = "héllo 🙂";
        // Nonempty String: Unicode and embedded NUL are ordinary payloads; the empty string is rejected.
        check(Api.shout(hello).equals(hello + "!") && Api.shout("a\0b").equals("a\0b!"), "shout");
        check(rejected(() -> Api.shout(""), "arg0 was rejected by Subtypes.checkedWord"), "empty word");
        check(throwsType(NullPointerException.class, () -> Api.shout(null)), "null is rejected");
        // Even Nat beyond 64 bits.
        check(Api.half(n(42)).equals(n(21)) && Api.half(BigInteger.ONE.shiftLeft(100)).equals(BigInteger.ONE.shiftLeft(99)), "half");
        check(rejected(() -> Api.half(n(7)), "arg0 was rejected by Subtypes.checkedEven"), "odd");
        check(throwsType(IllegalArgumentException.class, () -> Api.half(n(-2))) && !rejected(() -> Api.half(n(-2)), "arg0 was rejected by Subtypes.checkedEven"), "negative is the Nat error");
        // Small Int after an unchecked argument.
        check(Api.scale(n(-3), n(-128)).equals(n(384)) && Api.scale(n(-3), n(127)).equals(n(-381)), "scale");
        check(rejected(() -> Api.scale(n(-3), n(128)), "arg1 was rejected by Subtypes.checkedSmall") && rejected(() -> Api.scale(n(-3), n(-129)), "arg1 was rejected by Subtypes.checkedSmall"), "late rejection");
        // Nonempty ByteArray.
        check(Api.head(new byte[]{0, (byte) 255}) == 0, "head");
        check(rejected(() -> Api.head(new byte[0]), "arg0 was rejected by Subtypes.checkedPayload"), "empty payload");
        // A result-only subtype and two checked arguments.
        check(Api.pad(n(21)).equals(n(42)) && Api.join("ab", "cd").equals("abcd"), "pad and join");
        check(rejected(() -> Api.join("ab", ""), "arg1 was rejected by Subtypes.checkedWord") && rejected(() -> Api.join("", "cd"), "arg0 was rejected by Subtypes.checkedWord"), "join rejections");
        // A normalizing constructor: the export sees the constructed value.
        check(Api.clamp(n(250)).equals(n(100)) && Api.clamp(n(7)).equals(n(7)), "clamp");
        // A checked constructor beside a Fin bound: the Fin precheck runs first.
        check(Api.mix(n(4), n(3)).equals(n(7)), "mix");
        check(rejected(() -> Api.mix(n(4), n(10)), "arg1 is not below its Fin 10 bound") && rejected(() -> Api.mix(n(5), n(10)), "arg1 is not below its Fin 10 bound"), "Fin before the constructor");
        check(rejected(() -> Api.mix(n(5), n(3)), "arg0 was rejected by Subtypes.checkedEven"), "odd beside a valid digit");
        for (int i = 0; i < 1000; i++) {
            final int k = i;
            if (!rejected(() -> Api.half(n(2L * k + 1)), "arg0 was rejected by Subtypes.checkedEven")) throw new AssertionError("invalid call accepted at " + i);
            if (!Api.half(n(2L * i)).equals(n(i))) throw new AssertionError("valid call failed at " + i);
        }
        checks += 2000;
        System.out.println("subtype-ok:" + checks);
    }
}
