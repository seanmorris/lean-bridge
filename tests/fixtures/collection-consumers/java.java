// Typed calls use only the original installed Maven package's public API.
import org.leanbridge.collections.*;
import java.math.BigInteger;
import java.lang.reflect.Array;
import java.util.Arrays;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

public final class Consumer {
    private Consumer() { }
    private static final AtomicInteger checks = new AtomicInteger(), calls = new AtomicInteger();
    private static int rejected;
    private static void check(boolean value) { int n = checks.incrementAndGet(); if (!value) throw new AssertionError("collection check " + n); }
    private static <T> T call(Supplier<T> action) { calls.incrementAndGet(); return action.get(); }
    private static void equal(Object actual, Object expected) {
        check(actual.getClass() == expected.getClass());
        if (expected instanceof Float f) check(Float.isNaN(f) ? Float.isNaN((Float)actual) : Float.floatToRawIntBits(f) == Float.floatToRawIntBits((Float)actual));
        else if (expected instanceof Double d) check(Double.isNaN(d) ? Double.isNaN((Double)actual) : Double.doubleToRawLongBits(d) == Double.doubleToRawLongBits((Double)actual));
        else if (expected.getClass().isArray()) {
            check(Array.getLength(actual) == Array.getLength(expected));
            for (int i = 0; i < Array.getLength(expected); i++) equal(Array.get(actual, i), Array.get(expected, i));
        } else if (expected.getClass().isRecord()) {
            try { for (var field : expected.getClass().getRecordComponents()) equal(field.getAccessor().invoke(actual), field.getAccessor().invoke(expected)); }
            catch (ReflectiveOperationException error) { throw new AssertionError(error); }
            check(actual.equals(expected)); check(actual.hashCode() == expected.hashCode());
        } else check(Objects.equals(actual, expected));
    }
    private static void reverse(Object input, Object result) {
        check(input != result); check(input.getClass() == result.getClass()); check(Array.getLength(input) == Array.getLength(result));
        for (int i = 0; i < Array.getLength(input); i++) {
            Object row = Array.get(input, i), reversed = Array.get(result, Array.getLength(input) - 1 - i);
            check(row != reversed); check(Array.getLength(row) == Array.getLength(reversed));
            for (int j = 0; j < Array.getLength(row); j++) equal(Array.get(reversed, Array.getLength(row) - 1 - j), Array.get(row, j));
        }
    }
    private static void reject(Class<? extends Throwable> type, Runnable action) {
        boolean failed = false;
        try { action.run(); } catch (Throwable error) { check(type.isInstance(error)); failed = true; rejected++; }
        check(failed); equal(call(Api::recordMake), new Pair(42, "\uFEFF🌱\0"));
    }
    private static Primitives change(Primitives value, int index, Object replacement) {
        try {
            var fields = Primitives.class.getRecordComponents();
            var types = Arrays.stream(fields).map(field -> field.getType()).toArray(Class<?>[]::new);
            Object[] values = new Object[fields.length];
            for (int i = 0; i < values.length; i++) values[i] = fields[i].getAccessor().invoke(value);
            values[index] = replacement; return Primitives.class.getConstructor(types).newInstance(values);
        } catch (ReflectiveOperationException error) { throw new AssertionError(error); }
    }
    public static void main(String[] args) throws Exception {
/* SIGNATURES */
        var max = BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE);
        var huge = BigInteger.ONE.shiftLeft(5120).add(BigInteger.valueOf(31));
        var scalar = new Primitives(Unit.INSTANCE, true, 255, 65535, 4294967295L, max, Byte.MIN_VALUE, Short.MIN_VALUE,
            Integer.MIN_VALUE, Long.MIN_VALUE, BigInteger.ONE.shiftLeft(200), BigInteger.ONE.shiftLeft(200).negate(),
            -0f, 3.25, "🌱\0", new byte[] {-1, 0, 1}, 0x1f331, max, -2147483648L);
        check(call(() -> Api.recordInspect(scalar)));
        check(call(() -> Api.arrayCheckElements(new Unit[] {Unit.INSTANCE}, new boolean[] {true}, new int[] {255}, new int[] {65535}, new long[] {4294967295L}, new BigInteger[] {max},
            new byte[] {-128}, new short[] {-32768}, new int[] {Integer.MIN_VALUE}, new long[] {Long.MIN_VALUE},
            new BigInteger[] {BigInteger.ONE.shiftLeft(200)}, new BigInteger[] {BigInteger.ONE.shiftLeft(200).negate()},
            new float[] {-0f}, new double[] {3.25}, new String[] {"🌱\0"}, new byte[][] {{-1, 0, 1}}, new int[] {0x1f331}, new BigInteger[] {max}, new long[] {-2147483648L})));
        Object[] different = {Unit.INSTANCE, false, 0, 0, 0L, BigInteger.ZERO, (byte)0, (short)0, 0, 0L,
            BigInteger.ZERO, BigInteger.ZERO, 0f, 0d, "", new byte[0], 0, BigInteger.ZERO, 0L};
        for (int i = 1; i < different.length; i++) { var changed = change(scalar, i, different[i]); check(!call(() -> Api.recordInspect(changed))); }
        for (int iteration = 0; iteration < 128; iteration++) {
/* ARRAYS */
            var input = new Packet("packet", new Primitives[][] {{scalar, scalar}, {}, {scalar}}, new Empty(), new Single(max), new Count(huge), new Pair(4294967295L, "pair"), new Reversed("reverse", 4294967295L));
            var expected = new Packet("packet!", new Primitives[][] {{scalar}, {}, {scalar, scalar}}, new Empty(), new Single(BigInteger.ZERO), new Count(huge.add(BigInteger.valueOf(7))), new Pair(0, "pairp"), new Reversed("reverser", 1));
            var shuffled = call(() -> Api.recordShuffle(input)); equal(shuffled, expected);
            var copied = call(() -> Api.recordDuplicate(input)); equal(copied, new Packet[] {input, input});
            check(copied[0] != copied[1] && copied[0].values() != copied[1].values());
            copied[0].values()[0][0].bytes()[0] = 7; check(copied[1].values()[0][0].bytes()[0] == -1); check(scalar.bytes()[0] == -1);
            check(!copied[0].equals(input)); check(copied[1].equals(input));
            equal(call(() -> Api.recordReverse(new Primitives[] {scalar, change(scalar, 14, "changed")})), new Primitives[] {change(scalar, 14, "changed"), scalar});
            equal(call(() -> Api.recordEmpty(new Empty())), new Empty());
            equal(call(() -> Api.recordSingle(new Single(max))), new Single(BigInteger.ZERO));
            equal(call(() -> Api.recordCount(new Count(huge))), new Count(huge.add(BigInteger.ONE)));
            equal(call(Api::recordMake), new Pair(42, "\uFEFF🌱\0"));
            equal(call(() -> Api.arrayAdd(huge, new BigInteger[][] {{huge.negate(), BigInteger.ONE}, {}})), new BigInteger[][] {{BigInteger.ZERO, huge.add(BigInteger.ONE)}, {}});
            equal(call(() -> Api.arrayTotal(new BigInteger[][] {{huge, huge}, {}})), huge.shiftLeft(1));
            equal(call(Api::arrayWords), new String[][] {{"\uFEFFLean", "🌱\0"}, {}});
            var bytes = new byte[] {0, -1, 42}; var duplicates = call(() -> Api.arrayDuplicate(new byte[][] {bytes}));
            equal(duplicates, new byte[][] {bytes, bytes}); check(duplicates[0] != duplicates[1]); duplicates[0][0] = 1; check(duplicates[1][0] == 0 && bytes[0] == 0);
            equal(call(() -> Api.arraySize(new Unit[] {Unit.INSTANCE, Unit.INSTANCE})), BigInteger.TWO);
            equal(call(() -> Api.generate(BigInteger.valueOf(3))), new Unit[] {Unit.INSTANCE, Unit.INSTANCE, Unit.INSTANCE});
        }
/* DEEP */
        for (int i = 0; i < 19; i++) if (!Primitives.class.getRecordComponents()[i].getType().isPrimitive()) {
            var invalid = change(scalar, i, null); reject(NullPointerException.class, () -> call(() -> Api.recordReverse(new Primitives[] {scalar, invalid})));
        }
        for (int field : new int[] {2, 3, 16}) for (int value : field == 2 ? new int[] {-1, 256} : field == 3 ? new int[] {-1, 65536} : new int[] {-1, 0xd800, 0xdfff, 0x110000})
            reject(IllegalArgumentException.class, () -> call(() -> Api.recordReverse(new Primitives[] {scalar, change(scalar, field, value)})));
        for (long value : new long[] {-1, 4294967296L}) reject(IllegalArgumentException.class, () -> call(() -> Api.arrayReverseUint32(new long[][] {{0, value}})));
        for (int field : new int[] {5, 17}) for (var value : new BigInteger[] {BigInteger.valueOf(-1), BigInteger.ONE.shiftLeft(64)})
            reject(IllegalArgumentException.class, () -> call(() -> Api.recordReverse(new Primitives[] {change(scalar, field, value)})));
        reject(IllegalArgumentException.class, () -> call(() -> Api.arrayReverseNat(new BigInteger[][] {{BigInteger.valueOf(-1)}})));
        reject(IllegalArgumentException.class, () -> call(() -> Api.arrayReverseString(new String[][] {{"ok", "\ud800"}})));
        reject(NullPointerException.class, () -> call(() -> Api.arrayReverseUint32(null)));
        reject(NullPointerException.class, () -> call(() -> Api.arrayReverseUint32(new long[][] {{1}, null})));
        reject(NullPointerException.class, () -> call(() -> Api.recordDuplicate(null)));
        reject(NullPointerException.class, () -> call(() -> Api.recordShuffle(new Packet("ok", null, new Empty(), new Single(max), new Count(huge), new Pair(0, ""), new Reversed("", 0)))));
        reject(IllegalArgumentException.class, () -> call(() -> Api.arrayReverseString(new String[][] {{"x".repeat(17 * 1024 * 1024)}})));
        reject(IllegalArgumentException.class, () -> call(() -> Api.arrayDuplicate(new byte[][] {new byte[9 * 1024 * 1024]})));
        reject(IllegalArgumentException.class, () -> call(() -> Api.generate(BigInteger.valueOf(17 * 1024 * 1024))));
        try (var workers = java.util.concurrent.Executors.newFixedThreadPool(4)) {
            var tasks = new java.util.ArrayList<java.util.concurrent.Future<?>>();
            for (int lane = 0; lane < 4; lane++) tasks.add(workers.submit(() -> { for (int i = 0; i < 64; i++) equal(call(() -> Api.arrayReverseInt(new BigInteger[][] {{huge, huge.negate()}})), new BigInteger[][] {{huge.negate(), huge}}); }));
            for (var task : tasks) task.get();
        }
/* DOCUMENTATION */
        Wire.result("collections/assertions", Wire.integer(checks.get()), true);
        Wire.result("collections/calls", Wire.integer(calls.get()), true);
        Wire.result("collections/rejections", Wire.integer(rejected), true);
        Wire.finish("java", "Collections", System.getProperty("java.version"), Api.class);
    }
}
