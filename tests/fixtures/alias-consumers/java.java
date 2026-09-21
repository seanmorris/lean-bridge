// Independent public-API checks against an installed prepared Maven JAR.
import org.leanbridge.aliases.*;
import org.leanbridge.aliases.Unit;
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
    static <T> void exercise(Function<T, T> echo, T[] values) { for (T value : values) equal(echo.apply(value), value); }
    public static void main(String[] args) throws Exception {
        var huge = BigInteger.ONE.shiftLeft(5120).add(BigInteger.valueOf(19));
/* PRIMITIVE_CASES */
        java.util.function.Consumer<Unit> unit = Api::echoUnit; unit.accept(Unit.INSTANCE);
        check(Api.class.getMethod("echoUnit", Unit.class).getReturnType() == void.class);
        Function<Long, Long> increment = Api::increment;
        check(Api.make() == 41); equal(Api.label(), "alias🌱"); check(increment.apply(4294967295L) == 0);
        for (long i = 0; i < 512; ++i) check(increment.apply(i) == i + 1);
        for (int bit : new int[] {0, 7, 31, 32, 53, 64, 255, 1024, 5120}) {
            var value = BigInteger.ONE.shiftLeft(bit).add(BigInteger.valueOf(19));
            equal(Api.echoNat(value), value); equal(Api.echoInt(value), value); equal(Api.echoInt(value.negate()), value.negate());
        }
        var fields = new Scalars(Unit.INSTANCE, true, 255, 65535, 4294967295L,
            BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE), Byte.MIN_VALUE, Short.MIN_VALUE, Integer.MIN_VALUE, Long.MIN_VALUE,
            huge, BigInteger.ONE.shiftLeft(5120).add(BigInteger.valueOf(31)).negate(), 1.5f, -2.25,
            "A\0🌱", new byte[] {0, -1, 1}, 0x1f331, BigInteger.valueOf(4294967295L), -2147483648L);
        check(Api.inspect(fields)); var copied = Api.echoScalars(fields); equal(copied, fields);
        check(copied != fields); check(copied.vBytes() != fields.vBytes());
        var components = Scalars.class.getRecordComponents(); check(components.length == 19);
        var constructor = Scalars.class.getConstructor(java.util.Arrays.stream(components).map(c -> c.getType()).toArray(Class<?>[]::new));
        Object[] original = new Object[19]; for (int i = 0; i < 19; ++i) original[i] = components[i].getAccessor().invoke(fields);
        Object[] different = {Unit.INSTANCE, false, 0, 0, 0L, BigInteger.ZERO, (byte)0, (short)0, 0, 0L,
            BigInteger.ZERO, BigInteger.ZERO, 0f, 0d, "", new byte[0], 0, BigInteger.ZERO, 0L};
        for (int i = 1; i < 19; ++i) { var changed = original.clone(); changed[i] = different[i]; check(!Api.inspect(constructor.newInstance(changed))); }
        copied.vBytes()[0] = 17; check(Api.inspect(fields));
        equal(Api.reverseRows(new long[0][]), new long[0][]); equal(Api.reversePackets(new Packet[0]), new Packet[0]);
        for (var maybe : java.util.List.<Option<Option<Unit>>>of(Option.none(), Option.some(Option.none()), Option.some(Option.some(Unit.INSTANCE)))) {
            equal(Api.echoMaybe(maybe), maybe);
            for (var outcome : java.util.List.<Result<Pair<Long, byte[]>, String>>of(Result.ok(new Pair<>(7L, new byte[] {0, -1, 1})),
                Result.ok(new Pair<>(0L, new byte[0])), Result.err(""), Result.err("no\0🌱"))) {
                equal(Api.echoOutcome(outcome), outcome);
                var packet = new Packet(41, "packet\0🌱", new long[][] {{1, 2, 3}, {}, {1, 1}}, maybe, outcome);
                var changed = Api.changePacket(packet); equal(changed, new Packet(42, packet.text(), packet.rows(), maybe, outcome));
                check(changed != packet && changed.rows() != packet.rows()); changed.rows()[0][0] = 99; check(packet.rows()[0][0] == 1);
                var result = Api.reversePackets(new Packet[] {packet, changed}); equal(result, new Packet[] {changed, packet});
                result[1].rows()[0][0] = 17; check(packet.rows()[0][0] == 1);
                var reversed = Api.reverseRows(packet.rows()); equal(reversed, new long[][] {{3, 2, 1}, {}, {1, 1}});
                reversed[0][0] = 77; check(packet.rows()[0][0] == 1);
            }
        }
        reject(IllegalArgumentException.class, () -> Api.echoNat(BigInteger.valueOf(-1))); equal(Api.echoInt(BigInteger.valueOf(-1)), BigInteger.valueOf(-1));
        for (int value : new int[] {-1, 256}) reject(IllegalArgumentException.class, () -> Api.echoUint8(value));
        for (int value : new int[] {-1, 65536}) reject(IllegalArgumentException.class, () -> Api.echoUint16(value));
        for (long value : new long[] {-1, 4294967296L}) { reject(IllegalArgumentException.class, () -> Api.echoUint32(value)); reject(IllegalArgumentException.class, () -> Api.increment(value)); }
        for (var value : new BigInteger[] {BigInteger.valueOf(-1), BigInteger.ONE.shiftLeft(64)}) { reject(IllegalArgumentException.class, () -> Api.echoUint64(value)); reject(IllegalArgumentException.class, () -> Api.echoUsize(value)); }
        for (int value : new int[] {-1, 0xd800, 0xdfff, 0x110000}) reject(IllegalArgumentException.class, () -> Api.echoChar(value));
        reject(IllegalArgumentException.class, () -> Api.echoString("\ud800"));
        reject(IllegalArgumentException.class, () -> Api.reverseRows(new long[][] {{1}, {4294967296L}}));
        reject(IllegalArgumentException.class, () -> Api.echoOutcome(Result.ok(new Pair<>(4294967296L, new byte[0]))));
        Object[] negative = original.clone(); negative[10] = BigInteger.valueOf(-1);
        var invalid = constructor.newInstance(negative); reject(IllegalArgumentException.class, () -> Api.echoScalars(invalid));
        reject(NullPointerException.class, () -> Api.echoUnit(null)); reject(NullPointerException.class, () -> Api.echoString(null));
        reject(NullPointerException.class, () -> Api.echoNat(null)); reject(NullPointerException.class, () -> Api.echoBytes(null));
        reject(NullPointerException.class, () -> Api.echoScalars(null)); reject(NullPointerException.class, () -> Api.changePacket(null));
        reject(NullPointerException.class, () -> Api.reverseRows(new long[][] {{1}, null}));
        reject(NullPointerException.class, () -> Api.reversePackets(new Packet[] {null}));
        reject(NullPointerException.class, () -> Api.echoMaybe(null)); reject(NullPointerException.class, () -> Api.echoOutcome(null));
        reject(NullPointerException.class, () -> Api.echoMaybe(Option.some(null)));
        reject(NullPointerException.class, () -> Api.echoOutcome(Result.ok(new Pair<>(1L, null))));
        reject(NullPointerException.class, () -> Api.echoOutcome(Result.err(null)));
        reject(IllegalStateException.class, () -> Option.none().value()); reject(IllegalStateException.class, () -> Result.ok(1L).error());
        reject(IllegalStateException.class, () -> Result.err("error").value());
        for (int i = 0; i < 3; ++i) {
            reject(IllegalArgumentException.class, () -> Api.echoBytes(new byte[16 * 1024 * 1024 + 1]));
            reject(IllegalArgumentException.class, () -> Api.duplicate(new byte[9 * 1024 * 1024]));
            reject(IllegalArgumentException.class, () -> Api.produce(BigInteger.valueOf(16 * 1024 * 1024 + 1)));
            equal(Api.duplicate(new byte[] {0, -1}), Result.ok(new Pair<>(7L, new byte[] {0, -1, 0, -1})));
            equal(Api.produce(BigInteger.valueOf(3)), new byte[] {7, 7, 7}); check(Api.make() == 41);
        }
        try (var workers = java.util.concurrent.Executors.newFixedThreadPool(4)) {
            var tasks = new java.util.ArrayList<java.util.concurrent.Future<?>>();
            for (int lane = 0; lane < 4; ++lane) tasks.add(workers.submit(() -> { for (int i = 0; i < 64; ++i) {
                var n = huge.add(BigInteger.valueOf(i)); equal(Api.echoNat(n), n); check(Api.inspect(fields));
            } }));
            for (var task : tasks) task.get();
        }
        Wire.result("aliases/assertions", Wire.integer(checks.get()), true);
        Wire.finish("java", "Aliases", System.getProperty("java.version"), Api.class);
    }
}
