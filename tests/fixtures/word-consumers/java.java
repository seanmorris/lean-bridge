import java.util.Arrays;
import java.math.BigInteger;
import org.leanbridge.words.Api;
import org.leanbridge.words.Sample;
class Consumer {
    static int checks;
    static void check(boolean value) { if (!value) throw new AssertionError("Platform integer mismatch"); ++checks; }
    public static void main(String[] args) {
        BigInteger modulus = BigInteger.ONE.shiftLeft(64);
        BigInteger[] us = {BigInteger.ZERO, BigInteger.ONE, new BigInteger("4294967295"), new BigInteger("9007199254740993"), modulus.subtract(BigInteger.ONE)};
        long[] ss = {Long.MIN_VALUE, -9007199254740993L, -1, 0, Long.MAX_VALUE};
        check(Api.wordBits() == 64);
        for (int i = 0; i < us.length; ++i) {
            check(Api.keepUnsigned(us[i]).equals(us[i]));
            check(Api.keepSigned(ss[i]) == ss[i]);
            check(Api.unsignedText(us[i]).equals(us[i].toString()));
            check(Api.signedText(ss[i]).equals(Long.toString(ss[i])));
            check(Api.advanceUnsigned(us[i]).equals(us[i].add(BigInteger.ONE).mod(modulus)));
            check(Api.advanceSigned(ss[i]) == ss[i] + 1);
        }
        for (BigInteger bad : new BigInteger[]{BigInteger.valueOf(-1), modulus, null}) {
            for (Runnable call : new Runnable[]{() -> Api.keepUnsigned(bad), () -> Api.keepUnsignedValues(new BigInteger[]{BigInteger.ZERO, bad}),
                    () -> Api.keepUnsignedRows(new BigInteger[][]{{BigInteger.ZERO}, {bad}}),
                    () -> Api.keepSample(new Sample(bad, -1, us, ss)),
                    () -> Api.keepSample(new Sample(BigInteger.ONE, -1, new BigInteger[]{bad}, ss))}) {
                boolean rejected = false;
                try { call.run(); } catch (IllegalArgumentException | NullPointerException error) { rejected = true; }
                check(rejected); check(Api.keepSigned(-1) == -1);
            }
        }
        for (int i = 0; i < 1000; ++i) {
            Sample sample = Api.keepSample(new Sample(us[4], ss[0], us, ss));
            check(sample.natural().equals(us[4]) && sample.integer() == ss[0]);
            check(Arrays.equals(sample.unsignedValues(), us) && Arrays.equals(sample.signedValues(), ss));
            check(Arrays.equals(Api.keepUnsignedValues(us), us));
            check(Arrays.equals(Api.keepSignedValues(ss), ss));
            check(Arrays.deepEquals(Api.keepUnsignedRows(new BigInteger[][]{us, {}}), new BigInteger[][]{us, {}}));
            check(Arrays.deepEquals(Api.keepSignedRows(new long[][]{ss, {}}), new long[][]{ss, {}}));
        }
        System.out.println("word-ok:" + checks);
    }
}
