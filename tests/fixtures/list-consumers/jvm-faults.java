// Separate instrumented projection, not the installed release classes.
package org.leanbridge.lists;
import java.lang.foreign.*;
import static java.lang.foreign.ValueLayout.*;
import java.lang.reflect.*;
import java.math.BigInteger;

public final class Faults {
    private Faults() { }
    static void check(boolean value) { if (!value) throw new AssertionError("List cleanup/layout check"); }
    static int faults(Runnable action) {
        ListProbe.reset(); action.run(); int count = ListProbe.count; check(count > 0); ListProbe.closed();
        for (int target = 1; target <= count; ++target) {
            ListProbe.reset(); ListProbe.target = target;
            int calls = ListProbe.calls, clears = ListProbe.clears; boolean failed = false;
            try { action.run(); } catch (OutOfMemoryError expected) { failed = true; }
            finally { ListProbe.target = 0; }
            check(failed); ListProbe.closed();
            check(ListProbe.calls - calls <= 1); check(ListProbe.clears - clears == ListProbe.calls - calls);
            check(java.util.Arrays.equals(Api.reverseUint32(new long[] {1, 2}), new long[] {2, 1}));
        }
        return count;
    }
    static void reject(Method method, MemorySegment value, Class<? extends Throwable> expected) throws Exception {
        try { method.invoke(null, value); throw new AssertionError("invalid layout accepted"); }
        catch (InvocationTargetException error) { check(expected.isInstance(error.getCause())); }
    }
    static int layouts(int listIndex, int arrayIndex) throws Exception {
        var list = Runtime.class.getDeclaredMethod("from" + listIndex, MemorySegment.class);
        var array = Runtime.class.getDeclaredMethod("from" + arrayIndex, MemorySegment.class);
        list.setAccessible(true); array.setAccessible(true); int checks = 0;
        try (Arena arena = Arena.ofConfined()) {
            for (var method : new Method[] { list, array }) {
                var value = arena.allocate(32, 8); value.set(JAVA_LONG, 8, 1);
                reject(method, value, IllegalStateException.class); ++checks;
                value.set(ADDRESS, 0, MemorySegment.ofAddress(1));
                reject(method, value, IllegalStateException.class); ++checks;
                value.set(JAVA_LONG, 8, Long.MAX_VALUE); reject(method, value, IllegalArgumentException.class); ++checks;
                value.set(JAVA_LONG, 8, -1); reject(method, value, IllegalArgumentException.class); ++checks;
                value.set(JAVA_LONG, 8, 0); check(Array.getLength(method.invoke(null, value)) == 0); ++checks;
            }
            var outer = arena.allocate(32, 8); var inner = arena.allocate(32, 8);
            inner.set(JAVA_LONG, 8, 1); outer.set(ADDRESS, 0, inner); outer.set(JAVA_LONG, 8, 1);
            reject(array, outer, IllegalStateException.class); ++checks;
        }
        return checks;
    }
    static Runnable deep() throws Exception {
        Class<?> type = long.class; Object value = 42L;
        for (int i = 0; i < 24; ++i) { Object next = Array.newInstance(type, 1); Array.set(next, 0, value); value = next; type = next.getClass(); }
        final Object input = value; var method = Api.class.getMethod("deep", type);
        return () -> {
            try { method.invoke(null, input); }
            catch (InvocationTargetException error) { if (error.getCause() instanceof OutOfMemoryError failure) throw failure; throw new AssertionError(error); }
            catch (ReflectiveOperationException error) { throw new AssertionError(error); }
        };
    }
    @SuppressWarnings("unchecked")
    public static void main(String[] args) throws Exception {
        var huge = BigInteger.ONE.shiftLeft(4096);
        var branches = (Option<Result<Pair<BigInteger, Unit>, String>>[])new Option<?>[] {
            Option.some(Result.err("branch")), Option.some(Result.ok(new Pair<>(huge, Unit.INSTANCE)))
        };
        var pairs = (Pair<Boolean, Integer>[][])new Pair<?, ?>[][] {{new Pair<>(true, 0x1f331)}};
        var packet = new Packet(new long[][] {{1, 2}, {3}}, branches, new byte[][] {{0, -1}}, pairs);
        var nested = (Result<Unit[], String>[])new Result<?, ?>[] { Result.ok(new Unit[] {Unit.INSTANCE}), Result.err("error") };
        int count = faults(() -> Api.transform(packet))
            + faults(() -> Api.duplicate(new byte[] {0, -1}))
            + faults(() -> Api.reverseNat(new BigInteger[] {huge, BigInteger.ONE}))
            + faults(() -> Api.nest(Option.some(nested)))
            + faults(() -> Api.swap(Result.ok(new Pair<>(new BigInteger[] {huge}, new long[] {1, 2}))))
            + faults(() -> Api.swap(Result.err(new String[] {"copied", "error"})))
            + faults(deep());
        for (int i = 0; i < 16; ++i) {
            ListProbe.reset(); int calls = ListProbe.calls;
            try { Api.reverseString(new String[] {"copied first", null}); throw new AssertionError("null accepted"); }
            catch (NullPointerException expected) { ListProbe.closed(); check(ListProbe.calls == calls); }
        }
        System.out.println("list-jvm-faults:" + count + ":" + layouts(Integer.parseInt(args[0]), Integer.parseInt(args[1])));
    }
}
