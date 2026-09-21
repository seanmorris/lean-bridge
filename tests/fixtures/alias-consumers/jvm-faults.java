// Separate instrumented projection, not the installed release classes.
package org.leanbridge.aliases;
import java.lang.foreign.*;
import static java.lang.foreign.ValueLayout.*;
import java.lang.reflect.*;
import java.math.BigInteger;

public final class Faults {
    private Faults() { }
    static void check(boolean value) { if (!value) throw new AssertionError("alias cleanup/layout check"); }
    static int faults(Runnable action) {
        AliasProbe.reset(); action.run(); int count = AliasProbe.count; check(count > 0); AliasProbe.closed();
        for (int target = 1; target <= count; ++target) {
            AliasProbe.reset(); AliasProbe.target = target;
            int calls = AliasProbe.calls, clears = AliasProbe.clears; boolean failed = false;
            try { action.run(); } catch (OutOfMemoryError expected) { failed = true; }
            finally { AliasProbe.target = 0; }
            check(failed); AliasProbe.closed();
            check(AliasProbe.calls - calls <= 1); check(AliasProbe.clears - clears == AliasProbe.calls - calls);
            check(Api.make() == 41); check(Api.echoNat(BigInteger.ONE.shiftLeft(256)).equals(BigInteger.ONE.shiftLeft(256)));
        }
        return count;
    }
    static void reject(Runnable action) {
        AliasProbe.reset(); int calls = AliasProbe.calls;
        try { action.run(); } catch (IllegalArgumentException | NullPointerException expected) { AliasProbe.closed(); check(AliasProbe.calls == calls); return; }
        throw new AssertionError("invalid input accepted");
    }
    static int invalid(Method method, Object value, Class<? extends Throwable> type) throws Exception {
        try { method.invoke(null, value); throw new AssertionError("invalid native value accepted"); }
        catch (InvocationTargetException error) { check(type.isInstance(error.getCause())); return 1; }
    }
    static void poison(MemorySegment value, long offset) { value.set(ADDRESS, offset, MemorySegment.ofAddress(1)); value.set(JAVA_LONG, offset + 8, Long.MAX_VALUE); }
    static int layouts(String[] args) throws Exception {
        Method[] from = new Method[5];
        for (int i = 0; i < 5; ++i) { from[i] = Runtime.class.getDeclaredMethod("from" + args[i], i == 4 ? int.class : MemorySegment.class); from[i].setAccessible(true); }
        var maybe = from[0]; var outcome = from[1]; var rows = from[2]; var text = from[3]; var character = from[4]; int checks = 0;
        try (Arena arena = Arena.ofConfined()) {
            for (var method : new Method[] {maybe, outcome}) for (byte flag : new byte[] {2, 127, -1}) {
                var value = arena.allocate(80, 8); value.set(JAVA_BYTE, 0, flag); checks += invalid(method, value, IllegalStateException.class);
            }
            var none = arena.allocate(8, 8); none.set(JAVA_BYTE, 1, (byte)-1);
            check(!((Option<?>)maybe.invoke(null, none)).isSome()); ++checks;
            none.set(JAVA_BYTE, 0, (byte)1); checks += invalid(maybe, none, IllegalStateException.class);
            var ok = arena.allocate(80, 8); ok.set(JAVA_BYTE, 0, (byte)1); poison(ok, 48);
            check(((Pair<?, ?>)((Result<?, ?>)outcome.invoke(null, ok)).value()).second() instanceof byte[] bytes && bytes.length == 0); ++checks;
            var error = arena.allocate(80, 8); poison(error, 16);
            check(((Result<?, ?>)outcome.invoke(null, error)).error().equals("")); ++checks;
            var sequence = arena.allocate(32, 8); sequence.set(JAVA_LONG, 8, 1);
            checks += invalid(rows, sequence, IllegalStateException.class); sequence.set(ADDRESS, 0, MemorySegment.ofAddress(1));
            checks += invalid(rows, sequence, IllegalStateException.class);
            sequence.set(JAVA_LONG, 8, Long.MAX_VALUE); checks += invalid(rows, sequence, IllegalArgumentException.class);
            sequence.set(JAVA_LONG, 8, -1); checks += invalid(rows, sequence, IllegalArgumentException.class);
            sequence.set(JAVA_LONG, 8, 0); check(Array.getLength(rows.invoke(null, sequence)) == 0); ++checks;
            for (int value : new int[] {0xd800, 0x110000}) checks += invalid(character, value, IllegalArgumentException.class);
            var bytes = arena.allocate(1); bytes.set(JAVA_BYTE, 0, (byte)-1);
            var string = arena.allocate(32, 8); string.set(ADDRESS, 0, bytes); string.set(JAVA_LONG, 8, 1);
            checks += invalid(text, string, IllegalArgumentException.class);
        }
        return checks;
    }
    public static void main(String[] args) throws Exception {
        var huge = BigInteger.ONE.shiftLeft(4096);
        var fields = new Scalars(Unit.INSTANCE, true, 255, 65535, 4294967295L, BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE),
            Byte.MIN_VALUE, Short.MIN_VALUE, Integer.MIN_VALUE, Long.MIN_VALUE, huge, huge.negate(), 1.5f, -2.25,
            "text\0🌱", new byte[] {0, -1}, 0x1f331, BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE), Long.MIN_VALUE);
        var packet = new Packet(41, "allocated\0🌱", new long[][] {{1, 2, 3}, {}, {4}}, Option.some(Option.some(Unit.INSTANCE)), Result.ok(new Pair<>(7L, new byte[] {0, -1})));
        var other = new Packet(packet.count(), packet.text(), packet.rows(), packet.maybe(), Result.err("error\0🌱"));
        int count = faults(() -> Api.echoScalars(fields)) + faults(() -> Api.changePacket(packet))
            + faults(() -> Api.reversePackets(new Packet[] {packet, other})) + faults(() -> Api.duplicate(new byte[] {0, -1}))
            + faults(() -> Api.echoNat(huge)) + faults(() -> Api.echoOutcome(Result.err("allocated")));
        var negative = new Scalars(fields.vUnit(), fields.vBool(), fields.vUint8(), fields.vUint16(), fields.vUint32(), fields.vUint64(),
            fields.vInt8(), fields.vInt16(), fields.vInt32(), fields.vInt64(), BigInteger.valueOf(-1), fields.vInt(), fields.vFloat32(), fields.vFloat64(),
            fields.vString(), fields.vBytes(), fields.vChar(), fields.vUsize(), fields.vIsize());
        for (int i = 0; i < 16; ++i) {
            reject(() -> Api.echoScalars(negative));
            reject(() -> Api.changePacket(new Packet(packet.count(), packet.text(), new long[][] {{1}, null}, packet.maybe(), packet.outcome())));
            reject(() -> Api.changePacket(new Packet(packet.count(), packet.text(), packet.rows(), packet.maybe(), Result.ok(new Pair<>(4294967296L, new byte[0])))));
            reject(() -> Api.changePacket(new Packet(packet.count(), packet.text(), packet.rows(), packet.maybe(), Result.err("\ud800"))));
        }
        System.out.println("alias-jvm-faults:" + count + ":" + layouts(args));
    }
}
