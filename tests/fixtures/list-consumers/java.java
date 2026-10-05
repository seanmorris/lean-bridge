// Independent public-API checks against an installed prepared Maven JAR.
import org.leanbridge.lists.*;
import org.leanbridge.lists.Unit;
import java.math.BigInteger;
import java.lang.reflect.Array;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;

public final class Consumer {
    private Consumer() { }
    private static final AtomicInteger checks = new AtomicInteger();
    static void check(boolean value) { int n = checks.incrementAndGet(); if (!value) throw new AssertionError("check " + n); }
    static void reject(Class<? extends Throwable> type, Runnable action) {
        try { action.run(); } catch (Throwable error) { check(type.isInstance(error)); return; }
        throw new AssertionError("Expected " + type.getName());
    }
    static void equal(Object a, Object b) {
        check(a.getClass() == b.getClass());
        if (a instanceof Float f && b instanceof Float g) check(Float.isNaN(f) && Float.isNaN(g) || Float.floatToRawIntBits(f) == Float.floatToRawIntBits(g));
        else if (a instanceof Double f && b instanceof Double g) check(Double.isNaN(f) && Double.isNaN(g) || Double.doubleToRawLongBits(f) == Double.doubleToRawLongBits(g));
        else if (a.getClass().isArray()) { check(Array.getLength(a) == Array.getLength(b)); for (int i = 0; i < Array.getLength(a); ++i) equal(Array.get(a, i), Array.get(b, i)); }
        else if (a.getClass().isRecord()) {
            try { for (var field : a.getClass().getRecordComponents()) equal(field.getAccessor().invoke(a), field.getAccessor().invoke(b)); }
            catch (ReflectiveOperationException error) { throw new AssertionError(error); }
        } else check(Objects.equals(a, b));
    }
    static byte[] allBytes() { byte[] result = new byte[256]; for (int i = 0; i < result.length; ++i) result[i] = (byte)i; return result; }
    @SuppressWarnings("unchecked")
    static <T> void exercise(Function<T, T> reverse, T values) {
        var type = values.getClass().getComponentType(); int size = Array.getLength(values);
        T empty = (T)Array.newInstance(type, 0); equal(reverse.apply(empty), empty);
        for (int i = 0; i < 32; ++i) {
            T input = (T)Array.newInstance(type, 4), expected = (T)Array.newInstance(type, 4);
            int[] positions = { i % size, (i + 1) % size, i % size, (i + 2) % size };
            for (int j = 0; j < 4; ++j) { Array.set(input, j, Array.get(values, positions[j])); Array.set(expected, 3 - j, Array.get(values, positions[j])); }
            equal(reverse.apply(input), expected);
        }
        T singleton = (T)Array.newInstance(type, 1); Array.set(singleton, 0, Array.get(values, 0)); equal(reverse.apply(singleton), singleton);
        reject(NullPointerException.class, () -> reverse.apply(null));
    }
    static void deep() throws Exception {
        Class<?>[] types = new Class<?>[25]; types[0] = long.class;
        for (int level = 1; level <= 24; ++level) types[level] = Array.newInstance(types[level - 1], 0).getClass();
        var method = Api.class.getMethod("deep", types[24]); check(method.getReturnType() == types[24]);
        for (int depth = 0; depth <= 24; ++depth) {
            Object value = depth == 24 ? 42L : Array.newInstance(types[23 - depth], 0);
            for (int level = 25 - depth; level <= 24; ++level) {
                Object next = Array.newInstance(types[level - 1], 1); Array.set(next, 0, value); value = next;
            }
            equal(method.invoke(null, value), value);
        }
    }
    @SuppressWarnings("unchecked")
    public static void main(String[] args) throws Exception {
        var huge = BigInteger.ONE.shiftLeft(5120).add(BigInteger.ONE.shiftLeft(255)).add(BigInteger.valueOf(17));
/* PRIMITIVE_CASES */
        Function<String[], String> join = Api::join;
        Function<long[][], long[][]> mix = Api::mix;
        equal(join.apply(new String[] { "a\0", "", "🌿" }), "a\0🌱🌱🌿"); equal(join.apply(new String[0]), "");
        equal(mix.apply(new long[][] {{1, 2, 3}, {}, {4}}), new long[][] {{4}, {}, {3, 2, 1}});
        for (long index = 0; index < 20; ++index) {
            var branches = (Option<Result<Pair<BigInteger, Unit>, String>>[])new Option<?>[] {
                Option.none(), Option.some(Result.ok(new Pair<>(huge, Unit.INSTANCE))), Option.some(Result.err("oops\0"))
            };
            var pairs = (Pair<Boolean, Integer>[][])new Pair<?, ?>[][] { {new Pair<>(true, 0x1f33f), new Pair<>(false, 0)}, {} };
            var packet = new Packet(new long[][] {{1, 2, 3}, {}, {index}}, branches, new byte[][] {{0, -1}, {}}, pairs);
            var copied = Api.transform(packet);
            equal(copied.sequences(), new long[][] {{index}, {}, {3, 2, 1}});
            equal(copied.branches()[0], Option.some(Result.err("oops\0!")));
            equal(copied.branches()[1], Option.some(Result.ok(new Pair<>(huge.add(BigInteger.ONE), Unit.INSTANCE))));
            equal(copied.branches()[2], Option.none()); equal(copied.buffers(), new byte[][] {{}, {0, -1}});
            equal(copied.arrays()[0], new Pair<?, ?>[0]);
            equal(copied.arrays()[1], new Pair<?, ?>[] {new Pair<>(false, 0), new Pair<>(true, 0x1f33f)});
            check(copied != packet); copied.buffers()[1][0] = 9; check(packet.buffers()[0][0] == 0);
            packet.sequences()[0][0] = 99; packet.arrays()[0][0] = new Pair<>(false, 1); packet.branches()[1] = Option.none();
            equal(copied.sequences()[2], new long[] {3, 2, 1}); check(copied.branches()[1].isSome());
            equal(copied.arrays()[1][1], new Pair<>(true, 0x1f33f));
        }
        Function<Option<Result<Unit[], String>[]>, Option<Result<Unit[], String>[]>> nest = Api::nest;
        Function<Result<Pair<BigInteger[], long[]>, String[]>, Result<String[], Pair<BigInteger[], long[]>>> swap = Api::swap;
        var empty = (Result<Unit[], String>[])new Result<?, ?>[0];
        equal(nest.apply(Option.none()), Option.none()); equal(nest.apply(Option.some(empty)), Option.some(empty));
        var nested = (Result<Unit[], String>[])new Result<?, ?>[] { Result.ok(new Unit[] {Unit.INSTANCE, Unit.INSTANCE}), Result.err("bad\0"), Result.ok(new Unit[0]) };
        equal(nest.apply(Option.some(nested)), Option.some(new Result<?, ?>[] { Result.ok(new Unit[0]), Result.err("bad\0!"), Result.ok(new Unit[] {Unit.INSTANCE, Unit.INSTANCE}) }));
        equal(swap.apply(Result.err(new String[] {"first", "last"})), Result.ok(new String[] {"last", "first"}));
        equal(swap.apply(Result.ok(new Pair<>(new BigInteger[] {huge, BigInteger.valueOf(42)}, new long[] {1, 2, 3}))), Result.err(new Pair<>(new BigInteger[] {BigInteger.valueOf(42), huge}, new long[] {3, 2, 1})));
        deep();
        byte[] input = {0, -1}; var copies = Api.duplicate(input); equal(copies, new byte[][] {{0, -1}, {0, -1}});
        copies[0][0] = 7; check(copies[1][0] == 0 && input[0] == 0); equal(Api.duplicate(new byte[0]), new byte[][] {{}, {}});
        reject(IllegalArgumentException.class, () -> Api.reverseNat(new BigInteger[] {huge, BigInteger.valueOf(-1)}));
        reject(IllegalArgumentException.class, () -> Api.reverseUint8(new int[] {1, 256}));
        reject(IllegalArgumentException.class, () -> Api.reverseUint16(new int[] {1, -1}));
        reject(IllegalArgumentException.class, () -> Api.reverseUint32(new long[] {1, 4294967296L}));
        reject(IllegalArgumentException.class, () -> Api.reverseUint64(new BigInteger[] {huge}));
        reject(IllegalArgumentException.class, () -> Api.reverseUsize(new BigInteger[] {BigInteger.valueOf(-1)}));
        reject(IllegalArgumentException.class, () -> Api.reverseChar(new int[] {1, 0xd800}));
        reject(IllegalArgumentException.class, () -> Api.reverseString(new String[] {"copied first", "\ud800"}));
        reject(NullPointerException.class, () -> Api.reverseString(new String[] {"copied first", null}));
        reject(NullPointerException.class, () -> Api.reverseBytes(new byte[][] {{0}, null}));
        reject(NullPointerException.class, () -> Api.reverseUnit(new Unit[] {Unit.INSTANCE, null}));
        reject(NullPointerException.class, () -> Api.mix(new long[][] {{1}, null}));
        reject(NullPointerException.class, () -> Api.nest(Option.some((Result<Unit[], String>[])new Result<?, ?>[] { Result.ok(new Unit[0]), null })));
        reject(NullPointerException.class, () -> Api.transform(null));
        reject(IllegalArgumentException.class, () -> Api.reverseUnit(new Unit[(1 << 21) + 1]));
        reject(IllegalArgumentException.class, () -> Api.reverseBytes(new byte[][] {new byte[16 * 1024 * 1024]}));
        for (int i = 0; i < 3; ++i) { reject(IllegalArgumentException.class, () -> Api.duplicate(new byte[6 * 1024 * 1024])); equal(Api.duplicate(input), new byte[][] {{0, -1}, {0, -1}}); }
        reject(IllegalArgumentException.class, () -> Api.generate(BigInteger.valueOf(2097153)));
        equal(Api.generate(BigInteger.ONE), new long[] {7}); var expected = new long[30000]; java.util.Arrays.fill(expected, 7);
        equal(Api.generate(BigInteger.valueOf(30000)), expected);
        try (var workers = java.util.concurrent.Executors.newFixedThreadPool(4)) {
            var tasks = new java.util.ArrayList<java.util.concurrent.Future<?>>();
            for (int lane = 0; lane < 4; ++lane) tasks.add(workers.submit(() -> { for (int i = 0; i < 64; ++i) {
                var n = huge.add(BigInteger.valueOf(i)); equal(Api.reverseNat(new BigInteger[] {n, BigInteger.ONE}), new BigInteger[] {BigInteger.ONE, n});
            } }));
            for (var task : tasks) task.get();
        }
        Wire.result("lists/assertions", Wire.integer(checks.get()), true);
        Wire.finish("java", "Lists", System.getProperty("java.version"), Api.class);
    }
}
