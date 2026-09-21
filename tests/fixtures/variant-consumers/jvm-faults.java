// Isolated instrumented projection; the prepared release JAR stays untouched.
package org.leanbridge.variants;
import java.lang.foreign.*;
import static java.lang.foreign.ValueLayout.*;
import java.lang.reflect.*;
import java.math.BigInteger;

public final class Faults {
    private Faults() { }
    static void check(boolean value) { if (!value) throw new AssertionError("variant cleanup/layout check"); }
    static int faults(Runnable action) {
        VariantProbe.reset(); action.run(); int count = VariantProbe.count; check(count > 0); VariantProbe.closed();
        for (int target = 1; target <= count; ++target) {
            VariantProbe.reset(); VariantProbe.target = target;
            int calls = VariantProbe.calls, clears = VariantProbe.clears; boolean failed = false;
            try { action.run(); } catch (OutOfMemoryError expected) { failed = true; }
            finally { VariantProbe.target = 0; }
            check(failed); VariantProbe.closed();
            check(VariantProbe.calls - calls <= 1); check(VariantProbe.clears - clears == VariantProbe.calls - calls);
            check(Api.make(0) instanceof SignalIdle); check(Api.next(new SignalData(3, "ok")).equals(new SignalData(4, "ok!")));
        }
        return count;
    }
    static void reject(Runnable action) {
        VariantProbe.reset(); int calls = VariantProbe.calls;
        try { action.run(); } catch (IllegalArgumentException | NullPointerException expected) { VariantProbe.closed(); check(VariantProbe.calls == calls); return; }
        throw new AssertionError("invalid partial input accepted");
    }
    static int layouts(String[] args) throws Exception {
        int checks = 0;
        try (Arena arena = Arena.ofConfined()) {
            for (String description : args) {
                int[] spec = java.util.Arrays.stream(description.split(":")).mapToInt(Integer::parseInt).toArray();
                var method = Runtime.class.getDeclaredMethod("from" + spec[0], MemorySegment.class); method.setAccessible(true);
                var value = arena.allocate(spec[1], spec[2]); value.fill((byte)-1); value.set(JAVA_INT, 0, -1);
                try { method.invoke(null, value); throw new AssertionError("invalid native tag accepted"); }
                catch (InvocationTargetException error) { check(error.getCause() instanceof IllegalStateException); ++checks; }
                if (method.getReturnType() == One.class) continue;
                value.asSlice(spec[3], spec[4]).fill((byte)0); value.set(JAVA_INT, 0, 0);
                var result = method.invoke(null, value);
                check(result instanceof SignalIdle || result instanceof ModeFirst || result instanceof NestedEmpty
                    || result instanceof ScalarsAbsent || result instanceof AnonymousNumber || result instanceof BuffersEmpty);
                ++checks;
            }
        }
        check(Api.make(0) instanceof SignalIdle);
        return checks;
    }
    public static void main(String[] args) throws Exception {
        var signal = new SignalData(42, "A\0🌱");
        var packet = new Packet(signal, new Signal[] {new SignalIdle(), signal}, Option.some(new SignalMarker(Unit.INSTANCE)), new Mode[] {new ModeFirst(), new ModeThird()});
        var scalar = new ScalarsAll(Unit.INSTANCE, true, 255, 65535, 4294967295L, BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE),
            Byte.MIN_VALUE, Short.MIN_VALUE, Integer.MIN_VALUE, Long.MIN_VALUE, BigInteger.ONE.shiftLeft(5120), BigInteger.ONE.shiftLeft(5120).negate(),
            1.5f, -2.25, "A\0🌱", new byte[] {0, -1, 1}, 0x1f331, BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE), Long.MIN_VALUE);
        int count = faults(() -> Api.echo(signal))
            + faults(() -> Api.echoNested(new NestedPacket(packet)))
            + faults(() -> Api.echoNested(new NestedOutcome(Result.ok(new Pair<>(signal, new ModeSecond())))))
            + faults(() -> Api.echoNested(new NestedOutcome(Result.err("A\0🌱"))))
            + faults(() -> Api.signals(new Signal[][] {{new SignalIdle(), signal}, {signal}}))
            + faults(() -> Api.echoScalars(scalar))
            + faults(() -> Api.echoBuffers(new BuffersPair(new byte[] {0, -1}, new byte[] {1})))
            + faults(() -> Api.duplicate(new byte[] {0, -1}))
            + faults(() -> Api.produce(BigInteger.valueOf(17)));
        var negative = new ScalarsAll(scalar.unit(), scalar.bool(), scalar.u8(), scalar.u16(), scalar.u32(), scalar.u64(),
            scalar.i8(), scalar.i16(), scalar.i32(), scalar.i64(), BigInteger.valueOf(-1), scalar.integer(), scalar.f32(), scalar.f64(),
            scalar.text(), scalar.bytes(), scalar.char_(), scalar.word(), scalar.signedWord());
        for (int i = 0; i < 16; ++i) {
            reject(() -> Api.echoScalars(negative));
            reject(() -> Api.echoNested(new NestedPacket(new Packet(signal, new Signal[] {signal, null}, packet.fallback(), packet.modes()))));
            reject(() -> Api.echoNested(new NestedPacket(new Packet(signal, packet.events(), Option.some(new SignalMarker(null)), packet.modes()))));
            reject(() -> Api.echoNested(new NestedPacket(new Packet(signal, packet.events(), Option.some(new SignalData(1, "\ud800")), packet.modes()))));
        }
        System.out.println("variant-jvm-faults:" + count + ":" + layouts(args));
    }
}
