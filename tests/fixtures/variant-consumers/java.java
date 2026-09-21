// Independent calls to the public types in an installed prepared Maven JAR.
import org.leanbridge.variants.*;
import org.leanbridge.variants.Unit;
import java.math.BigInteger;
import java.lang.reflect.Array;
import java.util.Arrays;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

public final class Consumer {
    private Consumer() { }
    static final AtomicInteger checks = new AtomicInteger(), calls = new AtomicInteger();
    static int rejected;
    static void check(boolean value) { int n = checks.incrementAndGet(); if (!value) throw new AssertionError("variant check " + n); }
    static <T> T call(Supplier<T> action) { calls.incrementAndGet(); return action.get(); }
    static void equal(Object actual, Object expected) {
        check(actual.getClass() == expected.getClass());
        if (expected instanceof Float f) check(Float.isNaN(f) ? Float.isNaN((Float)actual) : Float.floatToRawIntBits(f) == Float.floatToRawIntBits((Float)actual));
        else if (expected instanceof Double d) check(Double.isNaN(d) ? Double.isNaN((Double)actual) : Double.doubleToRawLongBits(d) == Double.doubleToRawLongBits((Double)actual));
        else if (expected.getClass().isArray()) {
            check(Array.getLength(actual) == Array.getLength(expected));
            for (int i = 0; i < Array.getLength(expected); ++i) equal(Array.get(actual, i), Array.get(expected, i));
        } else if (expected.getClass().isRecord()) {
            try { for (var field : expected.getClass().getRecordComponents()) equal(field.getAccessor().invoke(actual), field.getAccessor().invoke(expected)); }
            catch (ReflectiveOperationException error) { throw new AssertionError(error); }
        } else check(Objects.equals(actual, expected));
    }
    static void reject(Class<? extends Throwable> type, Runnable action) {
        boolean failed = false;
        try { action.run(); } catch (Throwable error) { check(type.isInstance(error)); failed = true; ++rejected; }
        check(failed); equal(call(() -> Api.next(new SignalIdle())), new SignalStopped());
    }
    static ScalarsAll change(ScalarsAll value, int index, Object replacement) {
        try {
            var components = ScalarsAll.class.getRecordComponents();
            var types = Arrays.stream(components).map(c -> c.getType()).toArray(Class<?>[]::new);
            Object[] values = new Object[components.length];
            for (int i = 0; i < values.length; ++i) values[i] = components[i].getAccessor().invoke(value);
            values[index] = replacement;
            return ScalarsAll.class.getConstructor(types).newInstance(values);
        } catch (ReflectiveOperationException error) { throw new AssertionError(error); }
    }
    static String describe(Signal value) {
        return switch (value) {
            case SignalIdle ignored -> "idle";
            case SignalStopped ignored -> "stopped";
            case SignalData data -> data.count() + ":" + data.label();
            case SignalMarker ignored -> "marker";
        };
    }
    public static void main(String[] args) throws Exception {
/* SIGNATURES */
        var scalar = new ScalarsAll(Unit.INSTANCE, true, 255, 65535, 4294967295L,
            BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE), Byte.MIN_VALUE, Short.MIN_VALUE, Integer.MIN_VALUE, Long.MIN_VALUE,
            BigInteger.ONE.shiftLeft(5120).add(BigInteger.valueOf(19)), BigInteger.ONE.shiftLeft(5120).add(BigInteger.valueOf(31)).negate(),
            1.5f, -2.25, "A\0🌱", new byte[] {0, -1, 1}, 0x1f331, BigInteger.valueOf(4294967295L), -2147483648L);
        check(call(() -> Api.inspect(scalar)));
        Object[] different = {Unit.INSTANCE, false, 0, 0, 0L, BigInteger.ZERO, (byte)0, (short)0, 0, 0L,
            BigInteger.ZERO, BigInteger.ZERO, 0f, 0d, "", new byte[0], 0, BigInteger.ZERO, 0L};
        for (int i = 1; i < different.length; ++i) { var changed = change(scalar, i, different[i]); check(!call(() -> Api.inspect(changed))); }
        Signal[] cases = {new SignalIdle(), new SignalStopped(), new SignalData(42, "A\0🌱"), new SignalMarker(Unit.INSTANCE)};
        for (int repeat = 0; repeat < 128; ++repeat) {
            for (var value : cases) { var result = call(() -> Api.echo(value)); equal(result, value); check(result != value); }
            equal(call(() -> Api.next(cases[0])), new SignalStopped());
            equal(call(() -> Api.next(cases[1])), new SignalMarker(Unit.INSTANCE));
            equal(call(() -> Api.next(cases[2])), new SignalData(43, "A\0🌱!"));
            equal(call(() -> Api.next(cases[3])), new SignalData(42, "ready"));
            long[] codes = {7, 13, 48, 29};
            for (int i = 0; i < cases.length; ++i) { var value = cases[i]; equal(call(() -> Api.code(value)), codes[i]); }
            for (var value : new Mode[] {new ModeFirst(), new ModeSecond(), new ModeThird()}) equal(call(() -> Api.echoMode(value)), value);
            var events = cases.clone();
            var packet = new Packet(cases[2], events, Option.some(cases[3]), new Mode[] {new ModeFirst(), new ModeThird()});
            var nested = new NestedPacket(packet); var copied = (NestedPacket)call(() -> Api.echoNested(nested));
            equal(copied, nested); events[0] = new SignalData(99, "changed"); equal(copied.value().events()[0], new SignalIdle());
            check(copied.value().events() != packet.events()); check(copied.value().modes() != packet.modes());
            for (var value : new Nested[] {new NestedEmpty(),
                new NestedPacket(new Packet(new SignalIdle(), new Signal[0], Option.none(), new Mode[0])),
                new NestedOutcome(Result.ok(new Pair<>(new SignalMarker(Unit.INSTANCE), new ModeSecond()))),
                new NestedOutcome(Result.err("A\0🌱"))}) equal(call(() -> Api.echoNested(value)), value);
            var rows = new Signal[][] {{}, cases, {cases[2], cases[2]}};
            var resultRows = call(() -> Api.signals(rows)); equal(resultRows, new Signal[][] {{}, {cases[3], cases[2], cases[1], cases[0]}, rows[2]});
            resultRows[1][0] = new SignalStopped(); equal(cases[3], new SignalMarker(Unit.INSTANCE));
            equal(call(() -> Api.echoScalars(scalar)), scalar); equal(call(() -> Api.echoScalars(new ScalarsAbsent())), new ScalarsAbsent());
            for (var value : new Anonymous[] {new AnonymousNumber(13), new AnonymousPair(17, "A\0🌱"), new AnonymousCollision(19, "A\0🌱")}) equal(call(() -> Api.echoAnonymous(value)), value);
            final int counter = repeat; equal(call(() -> Api.echoOne(new OneOnly(counter))), new OneOnly(counter + 1));
            for (var value : new Buffers[] {new BuffersEmpty(), new BuffersPair(new byte[0], new byte[0]), new BuffersPair(new byte[] {0, -1}, new byte[] {1})}) equal(call(() -> Api.echoBuffers(value)), value);
            var duplicate = (BuffersPair)call(() -> Api.duplicate(new byte[] {0, -1, 1}));
            equal(duplicate, new BuffersPair(new byte[] {0, -1, 1}, new byte[] {0, -1, 1}));
            check(duplicate.first() != duplicate.second()); duplicate.first()[0] = 42; equal(duplicate.second()[0], (byte)0);
        }
        for (double value : new double[] {0d, -0d, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY, Double.NaN, 1d / 3, Double.MIN_VALUE}) {
            var input = change(change(change(change(scalar, 12, (float)value), 13, value), 17, BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)), 18, Long.MIN_VALUE);
            equal(call(() -> Api.echoScalars(input)), input);
        }
        for (int value : new int[] {0, 0xd7ff, 0xe000, 0x10ffff}) { var input = change(scalar, 16, value); equal(call(() -> Api.echoScalars(input)), input); }
        equal(call(() -> Api.echoOne(new OneOnly(4294967295L))), new OneOnly(0));
        equal(call(() -> Api.next(new SignalData(4294967295L, ""))), new SignalData(0, "!"));
        reject(NullPointerException.class, () -> call(() -> Api.echo(null)));
        reject(NullPointerException.class, () -> call(() -> Api.echo(new SignalData(1, null))));
        reject(NullPointerException.class, () -> call(() -> Api.echo(new SignalMarker(null))));
        reject(IllegalArgumentException.class, () -> call(() -> Api.echo(new SignalData(1, "\ud800"))));
        for (long value : new long[] {-1, 4294967296L}) reject(IllegalArgumentException.class, () -> call(() -> Api.echo(new SignalData(value, "range"))));
        for (int field : new int[] {2, 3, 16}) for (int value : field == 2 ? new int[] {-1, 256} : field == 3 ? new int[] {-1, 65536} : new int[] {-1, 0xd800, 0xdfff, 0x110000})
            reject(IllegalArgumentException.class, () -> call(() -> Api.echoScalars(change(scalar, field, value))));
        for (int field : new int[] {5, 17}) for (var value : new BigInteger[] {BigInteger.valueOf(-1), BigInteger.ONE.shiftLeft(64)})
            reject(IllegalArgumentException.class, () -> call(() -> Api.echoScalars(change(scalar, field, value))));
        reject(IllegalArgumentException.class, () -> call(() -> Api.echoScalars(change(scalar, 10, BigInteger.valueOf(-1)))));
        reject(NullPointerException.class, () -> call(() -> Api.echoScalars(change(scalar, 15, null))));
        reject(NullPointerException.class, () -> call(() -> Api.echoNested(new NestedPacket(null))));
        reject(NullPointerException.class, () -> call(() -> Api.signals(new Signal[][] {cases, null})));
        reject(NullPointerException.class, () -> call(() -> Api.echoNested(new NestedOutcome(Result.ok(new Pair<Signal, Mode>(null, new ModeFirst()))))));
        reject(NullPointerException.class, () -> call(() -> Api.echoNested(new NestedOutcome(null))));
        for (int i = 0; i < 3; ++i) {
            reject(IllegalArgumentException.class, () -> call(() -> Api.echo(new SignalData(0, "x".repeat(17 * 1024 * 1024)))));
            reject(IllegalArgumentException.class, () -> call(() -> Api.duplicate(new byte[9 * 1024 * 1024])));
            reject(IllegalArgumentException.class, () -> call(() -> Api.produce(BigInteger.valueOf(17 * 1024 * 1024))));
            equal(call(() -> Api.make(0)), new SignalIdle()); equal(call(() -> Api.make(7)), new SignalData(7, "made"));
            byte[] expected = new byte[30000]; Arrays.fill(expected, (byte)17);
            equal(call(() -> Api.produce(BigInteger.valueOf(30000))), new BuffersPair(expected, new byte[] {1}));
        }
        equal(Arrays.stream(cases).map(Consumer::describe).toArray(String[]::new), new String[] {"idle", "stopped", "42:A\0🌱", "marker"});
        try (var workers = java.util.concurrent.Executors.newFixedThreadPool(4)) {
            var tasks = new java.util.ArrayList<java.util.concurrent.Future<?>>();
            for (int lane = 0; lane < 4; ++lane) tasks.add(workers.submit(() -> { for (int i = 0; i < 64; ++i) {
                final int value = i; equal(call(() -> Api.next(new SignalData(value, "thread"))), new SignalData(value + 1, "thread!"));
            } }));
            for (var task : tasks) task.get();
        }
        check(rejected == 33); check(calls.get() > 4000);
        Wire.result("variants/assertions", Wire.integer(checks.get()), true);
        Wire.result("variants/calls", Wire.integer(calls.get()), true);
        Wire.result("variants/rejections", Wire.integer(rejected), true);
        Wire.finish("java", "Variants", System.getProperty("java.version"), Api.class);
    }
}
