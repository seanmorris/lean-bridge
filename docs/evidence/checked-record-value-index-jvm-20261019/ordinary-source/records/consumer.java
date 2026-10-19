// Independent Java caller for proof-erased checked records with value indices.
import java.math.BigInteger;
import org.leanbridge.checkedrecordvalueindices.*;

final class Consumer {
    private static int checks = 0;
    private static int calls = 0;
    private static int rejections = 0;
    private static int recoveries = 0;
    private static final String PREFIX = "arg0";

    private static BigInteger n(long value) { return BigInteger.valueOf(value); }
    private static BigInteger huge() { return BigInteger.ONE.shiftLeft(128).add(BigInteger.ONE); }

    private static void check(boolean condition, String label) {
        if (!condition) throw new IllegalStateException("failed: " + label);
        checks++;
    }

    private static String rejected(String constructor) {
        return PREFIX + " was rejected by CheckedRecordValueIndices." + constructor;
    }

    private static boolean refused(Runnable call, String expected) {
        calls++;
        try { call.run(); }
        catch (IllegalArgumentException error) {
            return error.getClass() == IllegalArgumentException.class
                && expected.equals(error.getMessage());
        }
        return false;
    }

    private static boolean shapeRefused(Runnable call) {
        calls++;
        try { call.run(); }
        catch (IllegalArgumentException error) {
            return error.getClass() == IllegalArgumentException.class
                && "Nat cannot be negative".equals(error.getMessage());
        }
        return false;
    }

    private static boolean nullRefused(Runnable call) {
        calls++;
        try { call.run(); }
        catch (NullPointerException error) {
            return error.getClass() == NullPointerException.class
                && error.getMessage() == null;
        }
        return false;
    }

    private static boolean recover() {
        var value = new ZeroToken(n(99));
        calls++;
        if (!Api.zeroNatIndex(value).equals(n(99))
            || !value.count().equals(n(99))) return false;
        recoveries++;
        return true;
    }

    public static void main(String[] arguments) {
        if (arguments.length != 0) throw new IllegalStateException("Unexpected caller arguments");
        run();
        System.out.println("{\"calls\":" + calls + ",\"checks\":" + checks
            + ",\"recoveries\":" + recoveries + ",\"rejections\":" + rejections + "}");
    }

    private static void run() {
        BigInteger huge = huge();
        var on = new On(n(0));
        var off = new Off(n(1));
        var ab = new Ab(n(2));
        var empty = new EmptyToken(n(9));
        var unicode = new UnicodeToken(n(10));
        var sized = new EmptySized(new BigInteger[0]);
        var zero = new ZeroToken(n(11));
        var wide = new WideToken(huge);
        calls++; check(Api.trueBoolIndex(on).equals(n(0)) && on.count().equals(n(0)), "true Bool index");
        calls++; check(Api.falseBoolIndex(off).equals(n(1)) && off.count().equals(n(1)), "false Bool index");
        calls++; check(Api.abStringIndex(ab).equals(n(2)) && ab.size().equals(n(2)), "String index");
        calls++; check(Api.emptyStringIndex(empty).equals(n(9)) && empty.count().equals(n(9)), "empty String index");
        calls++; check(Api.unicodeStringIndex(unicode).equals(n(10)) && unicode.count().equals(n(10)), "Unicode String index");
        calls++; check(Api.emptySizedIndex(sized).equals(n(0)) && sized.data().length == 0, "zero Nat index");
        calls++; check(Api.zeroNatIndex(zero).equals(n(11)) && zero.count().equals(n(11)), "zero Token index");
        calls++; check(Api.wideNatIndex(wide).equals(huge) && wide.count().equals(huge)
            && !zero.getClass().equals(wide.getClass()), "129-bit Nat index keeps nominal identity");

        var invalidAb = new Ab(n(1));
        check(refused(() -> Api.abStringIndex(invalidAb), rejected("mkAb"))
            && invalidAb.size().equals(n(1)), "String-index refusal preserves input");
        rejections++; check(recover(), "recover after String-index refusal");
        var invalidSized = new EmptySized(new BigInteger[] { n(1) });
        check(refused(() -> Api.emptySizedIndex(invalidSized), rejected("mkEmptySized"))
            && invalidSized.data().length == 1 && invalidSized.data()[0].equals(n(1)),
            "Nat-index refusal preserves array input");
        rejections++; check(recover(), "recover after Nat-index refusal");
        var invalidTrue = new On(n(1));
        check(refused(() -> Api.trueBoolIndex(invalidTrue), rejected("mkOn"))
            && invalidTrue.count().equals(n(1)), "true-index refusal preserves input");
        rejections++; check(recover(), "recover after true-index refusal");
        var invalidOff = new Off(n(0));
        check(refused(() -> Api.falseBoolIndex(invalidOff), rejected("mkOff"))
            && invalidOff.count().equals(n(0)), "false-index refusal preserves input");
        rejections++; check(recover(), "recover after false-index refusal");
        var negativeOn = new On(n(-1));
        check(shapeRefused(() -> Api.trueBoolIndex(negativeOn))
            && negativeOn.count().equals(n(-1)), "negative Nat field preserves input");
        rejections++; check(recover(), "recover after first shape refusal");
        var invalidZero = new ZeroToken(n(-1));
        check(shapeRefused(() -> Api.zeroNatIndex(invalidZero))
            && invalidZero.count().equals(n(-1)), "negative Token field preserves input");
        rejections++; check(recover(), "recover after second shape refusal");
        check(nullRefused(() -> Api.trueBoolIndex(null)),
            "null checked-record input is refused by the host boundary");
        rejections++; check(recover(), "recover after null host refusal");

        calls++; check(Api.produceTrueBool().count().equals(n(0)), "produce true Bool");
        calls++; check(Api.produceFalseBool().count().equals(n(1)), "produce false Bool");
        calls++; check(Api.produceAb().size().equals(n(2)), "produce String index");
        BigInteger value = n(23);
        calls++; check(Api.produceEmptyString(value).count().equals(value), "produce empty String index");
        value = n(24);
        calls++; check(Api.produceUnicodeString(value).count().equals(value), "produce Unicode String index");
        calls++; check(Api.produceEmptySized().data().length == 0, "produce zero-sized record");
        value = n(25);
        calls++; check(Api.produceZeroNat(value).count().equals(value), "produce zero Nat index");
        calls++; check(Api.produceWideNat(huge).count().equals(huge), "produce 129-bit Nat index");
        check(calls == (rejections == 0 ? 8 : 30)
            && recoveries == rejections && (rejections == 0 || rejections == 7), "exact totals");
    }
}
