import java.math.BigInteger;
import java.util.Arrays;
import org.leanbridge.checkedrecords.*;
final class Consumer {
    private Consumer() { }
    private static int checks;
    static void check(boolean value) { if (!value) throw new AssertionError("checked-record assertion failed"); checks++; }
    static BigInteger n(long value) { return BigInteger.valueOf(value); }
    // BEGIN CHECKED INPUT HELPERS
    static boolean rejected(Runnable call, String message) {
        try { call.run(); }
        catch (IllegalArgumentException error) { return message.equals(error.getMessage()); }
        return false;
    }
    // END CHECKED INPUT HELPERS
    public static void main(String[] args) {
        var big = BigInteger.ONE.shiftLeft(100);
        // BEGIN CHECKED INPUT CASES
        var good = new Interval(n(3), n(10));
        var bad = new Interval(n(9), n(3));
        var values = new BigInteger[] { n(9), n(2), n(4) };
        var triple = new Triple(values);
        check(Api.width(good).equals(n(7)));
        check(Api.width(new Interval(n(1), n(1))).equals(n(0)));
        check(Api.width(new Interval(big, big.add(n(9)))).equals(n(9)));
        check(Api.span(good, new Interval(n(5), n(20))).equals(n(17)));
        check(rejected(() -> Api.width(bad), "arg0 was rejected by CheckedRecords.mkInterval"));
        check(rejected(() -> Api.span(bad, good), "arg0 was rejected by CheckedRecords.mkInterval"));
        check(rejected(() -> Api.span(good, bad), "arg1 was rejected by CheckedRecords.mkInterval"));
        check(Api.total(triple).equals(n(15)));
        check(Api.firstOf(triple).equals(n(9)));
        check(Api.smallest(triple).equals(n(2)));
        check(Arrays.equals(triple.data(), new BigInteger[] { n(9), n(2), n(4) }) && Arrays.equals(values, new BigInteger[] { n(9), n(2), n(4) }));
        check(Arrays.equals(Api.scale(n(3), triple).data(), new BigInteger[] { n(27), n(6), n(12) }));
        check(Arrays.equals(triple.data(), new BigInteger[] { n(9), n(2), n(4) }) && Arrays.equals(values, new BigInteger[] { n(9), n(2), n(4) }));
        check(rejected(() -> Api.total(new Triple(new BigInteger[] {  })), "arg0 was rejected by CheckedRecords.mkTriple"));
        check(rejected(() -> Api.firstOf(new Triple(new BigInteger[] { n(1), n(2) })), "arg0 was rejected by CheckedRecords.mkTriple"));
        check(rejected(() -> Api.smallest(new Triple(new BigInteger[] { n(4), n(3), n(2), n(1) })), "arg0 was rejected by CheckedRecords.sortedTriple"));
        check(rejected(() -> Api.scale(n(3), new Triple(new BigInteger[] { n(1), n(2) })), "arg1 was rejected by CheckedRecords.mkTriple"));
        check(Api.complement(new Percent(n(0))).equals(n(100)));
        check(Api.complement(new Percent(n(100))).equals(n(0)));
        check(rejected(() -> Api.complement(new Percent(n(101))), "arg0 was rejected by CheckedRecords.mkPercent"));
        check(rejected(() -> Api.complement(new Percent(big)), "arg0 was rejected by CheckedRecords.mkPercent"));
        for (int index = 0; index < 1000; ++index) {
            final int i = index;
            check(rejected(() -> Api.width(new Interval(n(i + 1), n(i))), "arg0 was rejected by CheckedRecords.mkInterval"));
            check(Api.width(new Interval(n(i), n(i + 7))).equals(n(7)));
            check(rejected(() -> Api.total(new Triple(new BigInteger[] { n(1), n(2) })), "arg0 was rejected by CheckedRecords.mkTriple"));
            check(Api.total(triple).equals(n(15)));
            check(rejected(() -> Api.smallest(new Triple(new BigInteger[] { n(4), n(3), n(2), n(1) })), "arg0 was rejected by CheckedRecords.sortedTriple"));
            check(Api.smallest(triple).equals(n(2)));
            check(rejected(() -> Api.complement(new Percent(n(101))), "arg0 was rejected by CheckedRecords.mkPercent"));
            check(Api.complement(new Percent(n(100))).equals(n(0)));
        }
        check(Arrays.equals(triple.data(), new BigInteger[] { n(9), n(2), n(4) }) && Arrays.equals(values, new BigInteger[] { n(9), n(2), n(4) }) && good.lo().equals(n(3)) && good.hi().equals(n(10)) && bad.lo().equals(n(9)) && bad.hi().equals(n(3)));
        // END CHECKED INPUT CASES
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
