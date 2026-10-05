// Separate instrumented projection, not the installed release classes.
package org.leanbridge.compounds;
import java.lang.foreign.*;
import static java.lang.foreign.ValueLayout.*;
import java.lang.reflect.*;
import java.math.BigInteger;

public final class Faults {
    private Faults() { }
    static void check(boolean value) { if (!value) throw new AssertionError("compound cleanup/flag check"); }
    static int faults(Runnable action) {
        CompoundProbe.reset(); action.run(); int count = CompoundProbe.count; check(count > 0); CompoundProbe.closed();
        for (int target = 1; target <= count; ++target) {
            CompoundProbe.reset(); CompoundProbe.target = target;
            int calls = CompoundProbe.calls, clears = CompoundProbe.clears; boolean failed = false;
            try { action.run(); } catch (OutOfMemoryError expected) { failed = true; }
            finally { CompoundProbe.target = 0; }
            check(failed); CompoundProbe.closed();
            check(CompoundProbe.calls - calls <= 1); check(CompoundProbe.clears - clears == CompoundProbe.calls - calls);
            check(Api.classify(Option.some(Option.some(Unit.INSTANCE))) == 2);
        }
        return count;
    }
    static void poison(MemorySegment value, long offset) {
        value.set(ADDRESS, offset, MemorySegment.ofAddress(1)); value.set(JAVA_LONG, offset + 8, Long.MAX_VALUE);
    }
    static int flags(int optionIndex, int resultIndex) throws Exception {
        var option = Runtime.class.getDeclaredMethod("from" + optionIndex, MemorySegment.class);
        var result = Runtime.class.getDeclaredMethod("from" + resultIndex, MemorySegment.class);
        option.setAccessible(true); result.setAccessible(true); int checks = 0;
        try (Arena arena = Arena.ofConfined()) {
            for (var method : new Method[] { option, result }) for (byte flag : new byte[] { 2, 127, -1 }) {
                var value = arena.allocate(72, 8); value.set(JAVA_BYTE, 0, flag);
                try { method.invoke(null, value); throw new AssertionError("invalid flag accepted"); }
                catch (InvocationTargetException error) { check(error.getCause() instanceof IllegalStateException); ++checks; }
            }
            var none = arena.allocate(40, 8); poison(none, 8);
            check(!((Option<?>)option.invoke(null, none)).isSome()); ++checks;
            var ok = arena.allocate(72, 8); ok.set(JAVA_BYTE, 0, (byte)1); poison(ok, 40);
            check(((Result<?, ?>)result.invoke(null, ok)).value().equals("")); ++checks;
            var err = arena.allocate(72, 8); poison(err, 8);
            check(((Result<?, ?>)result.invoke(null, err)).error().equals("")); ++checks;
        }
        return checks;
    }
    public static void main(String[] args) throws Exception {
        var huge = BigInteger.ONE.shiftLeft(4096);
        @SuppressWarnings("unchecked")
        var rows = (Option<Result<Pair<String, BigInteger>, Pair<byte[], BigInteger>>>[])new Option<?>[] {
            Option.some(Result.err(new Pair<>(new byte[] {0, -1}, huge.negate()))), Option.some(Result.ok(new Pair<>("row", BigInteger.ONE)))
        };
        var packet = new Packet(Option.some(Result.ok(new Pair<>(huge, Unit.INSTANCE))), new Pair<>(new Pair<>(42L, "copied\0λ"), new Pair<>(true, 0x1f331)), rows, Result.ok(Option.some(Result.err("nested"))));
        int count = faults(() -> Api.transform(packet))
            + faults(() -> Api.duplicate(Option.some(new byte[] {0, -1})))
            + faults(() -> Api.optionNat(Option.some(huge)))
            + faults(() -> Api.resultString(Result.ok("success")))
            + faults(() -> Api.resultString(Result.err("error")))
            + faults(() -> Api.tupleString(new Pair<>("left", "right")));
        for (int i = 0; i < 16; ++i) {
            CompoundProbe.reset(); int calls = CompoundProbe.calls;
            try { Api.transform(new Packet(packet.choice(), packet.products(), null, packet.nested())); throw new AssertionError("null accepted"); }
            catch (NullPointerException expected) { CompoundProbe.closed(); check(CompoundProbe.calls == calls); }
        }
        System.out.println("compound-jvm-faults:" + count + ":" + flags(Integer.parseInt(args[0]), Integer.parseInt(args[1])));
    }
}
