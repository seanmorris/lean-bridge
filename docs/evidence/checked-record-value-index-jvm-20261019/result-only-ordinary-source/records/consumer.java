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


    public static void main(String[] arguments) {
        if (arguments.length != 0) throw new IllegalStateException("Unexpected caller arguments");
        run();
        System.out.println("{\"calls\":" + calls + ",\"checks\":" + checks
            + ",\"recoveries\":" + recoveries + ",\"rejections\":" + rejections + "}");
    }

    private static void run() {
        BigInteger huge = huge();

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
