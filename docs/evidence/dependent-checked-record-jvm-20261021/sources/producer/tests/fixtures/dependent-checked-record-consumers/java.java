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
    private static final String PREFIX = "ROUTE_PREFIX";

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

    // BEGIN FULL_ONLY
    private static BigInteger total(Dependent value, BigInteger expected, String label) {
        var before = snapshot(value);
        calls++;
        var actual = Api.dependentTotal(value);
        check(actual.equals(expected), label + " exact result");
        check(snapshot(value).equals(before), label + " preserves caller input");
        snapshots++;
        return actual;
    }

    private static Dependent roundtrip(Dependent value, String label) {
        var before = snapshot(value);
        calls++;
        var actual = Api.dependentRoundtrip(value);
        check(snapshot(actual).equals(before) && actual.equals(value)
            , label + " exact result");
        check(snapshot(value).equals(before), label + " preserves caller input");
        snapshots++;
        return actual;
    }

    private static void refuse(Dependent value, String label) {
        var before = snapshot(value);
        calls++;
        var refused = false;
        try { Api.dependentTotal(value); }
        catch (IllegalArgumentException error) {
            check(error.getClass() == IllegalArgumentException.class
                && (PREFIX + " was rejected by DependentRecords.mkDependent")
                    .equals(error.getMessage())
                , label + " exact checked-record refusal");
            check(true, label + " refuses invalid input");
            refused = true;
        }
        if (!refused)
            throw new IllegalStateException("Accepted invalid dependent record: " + label);
        check(snapshot(value).equals(before), label + " preserves rejected input");
        rejections++;
        snapshots++;
    }

    private static void recover() {
        total(record(n(2), n(1)), n(3), "recovery");
        recoveries++;
    }
    // END FULL_ONLY

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
        // BEGIN FULL_ONLY
        full = true;
        // END FULL_ONLY
        check(exported.contains("dependentTotal") == full, "dependentTotal export selection");
        check(exported.contains("dependentRoundtrip") == full
            , "dependentRoundtrip export selection");
        check(exported.contains("dependentResult"), "dependentResult export selection");

        for (var index = 0; index < 512; index++) produced(n(index), "result " + index);
        var huge = BigInteger.ONE.shiftLeft(130);
        produced(huge, "huge result");
        var totals = new int[] { calls, checks, recoveries, rejections, snapshots };
        var expected = new int[] { 513, 516, 0, 0, 513 };

        // BEGIN FULL_ONLY
        total(record(n(3), n(2)), n(5), "valid total");
        refuse(record(n(2), n(2)), "equal fields");
        recover();
        refuse(record(n(0), n(0)), "zero bound");
        recover();
        var valid = record(n(3), n(2));
        roundtrip(valid, "roundtrip");
        var below = huge.subtract(BigInteger.ONE);
        total(record(huge, below), huge.add(below), "huge total");
        var hugeRecord = record(huge, below);
        roundtrip(hugeRecord, "huge roundtrip");
        for (var index = 0; index < 256; index++) {
            var bound = n(index + 1);
            total(record(bound, n(index)), n(2L * index + 1), "loop total " + index);
            refuse(record(bound, bound), "loop refusal " + index);
            recover();
        }
        totals = new int[] { calls, checks, recoveries, rejections, snapshots };
        expected = new int[] { 1289, 2326, 258, 258, 1289 };
        // END FULL_ONLY

        if (!Arrays.equals(totals, expected))
            throw new IllegalStateException("dependent-record exact caller totals: "
                + Arrays.toString(totals) + " != " + Arrays.toString(expected));
    }
}
