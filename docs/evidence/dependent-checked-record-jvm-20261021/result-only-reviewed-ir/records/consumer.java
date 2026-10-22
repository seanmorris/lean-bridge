// Independent Java caller for proof-erased dependent checked records.
import java.math.BigInteger;
import java.util.Arrays;
import java.util.HashSet;
import java.lang.reflect.Modifier;
import org.leanbridge.dependentrecords.*;

final class Consumer {
    private static int checks = 0;
    private static int calls = 0;
    private static int rejections = 0;
    private static int recoveries = 0;
    private static int snapshots = 0;
    private static final String PREFIX = "value0";

    private static BigInteger n(long value) { return BigInteger.valueOf(value); }

    private static void check(boolean condition, String label) {
        if (!condition)
            throw new IllegalStateException("dependent-record assertion failed: " + label);
        checks++;
    }

    private static Dependent record(BigInteger bound, BigInteger below) {
        return new Dependent(bound, below);
    }

    private static String snapshot(Dependent value) {
        return value.bound().toString() + "/" + value.below().toString();
    }

    private static void produced(BigInteger seed, String label) {
        calls++;
        var value = Api.dependentResult(seed);
        check(snapshot(value).equals(snapshot(record(seed.add(BigInteger.ONE), seed)))
            , label + " exact result");
        snapshots++;
    }


    public static void main(String[] arguments) {
        if (arguments.length != 0)
            throw new IllegalStateException("Unexpected caller arguments");
        run();
        System.out.println("{\"calls\":" + calls + ",\"checks\":" + checks
            + ",\"recoveries\":" + recoveries + ",\"rejections\":" + rejections
            + ",\"snapshots\":" + snapshots + "}");
    }

    private static void run() {
        var exported = new HashSet<String>();
        for (var method : Api.class.getDeclaredMethods())
            if (Modifier.isPublic(method.getModifiers())) exported.add(method.getName());
        var full = false;
        check(exported.contains("dependentTotal") == full, "dependentTotal export selection");
        check(exported.contains("dependentRoundtrip") == full
            , "dependentRoundtrip export selection");
        check(exported.contains("dependentResult"), "dependentResult export selection");

        for (var index = 0; index < 512; index++) produced(n(index), "result " + index);
        var huge = BigInteger.ONE.shiftLeft(130);
        produced(huge, "huge result");
        var totals = new int[] { calls, checks, recoveries, rejections, snapshots };
        var expected = new int[] { 513, 516, 0, 0, 513 };


        if (!Arrays.equals(totals, expected))
            throw new IllegalStateException("dependent-record exact caller totals: "
                + Arrays.toString(totals) + " != " + Arrays.toString(expected));
    }
}
