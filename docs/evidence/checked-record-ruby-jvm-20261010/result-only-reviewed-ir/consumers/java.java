import java.math.BigInteger;
import java.util.Arrays;
import org.leanbridge.checkedrecords.*;
final class Consumer {
    private Consumer() { }
    private static int checks;
    static void check(boolean value) { if (!value) throw new AssertionError("checked-record assertion failed"); checks++; }
    static BigInteger n(long value) { return BigInteger.valueOf(value); }
    public static void main(String[] args) {
        var big = BigInteger.ONE.shiftLeft(100);
        check(Arrays.equals(Api.repeated(big).data(), new BigInteger[] { big, big, big }));
        var first = Api.repeated(n(7));
        var second = Api.repeated(n(7));
        first.data()[0] = n(99);
        check(Arrays.equals(second.data(), new BigInteger[] { n(7), n(7), n(7) }));
        for (int index = 0; index < 1000; ++index) {
            final int i = index;
            check(Arrays.equals(Api.repeated(n(i)).data(), new BigInteger[] { n(i), n(i), n(i) }));
        }
        System.out.println("checked-record-ok:" + checks);
    }
}
