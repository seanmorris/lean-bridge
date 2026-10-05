package org.leanbridge.collections;
import java.lang.foreign.*;
import static java.lang.foreign.ValueLayout.*;
import java.lang.reflect.*;
import java.math.BigInteger;
import java.util.Objects;

public final class Conversions {
    private Conversions() { }
    private static int checks, rejected;
    private static void check(boolean condition) { checks++; if (!condition) throw new AssertionError("check " + checks); }
    private static Method method(String name) {
        for (var method : ConversionProbe.class.getDeclaredMethods()) if (method.getName().equals(name)) { method.setAccessible(true); return method; }
        throw new AssertionError(name);
    }
    private static Object invoke(Method method, Object... args) throws Exception {
        try { return method.invoke(null, args); }
        catch (InvocationTargetException error) {
            if (error.getCause() instanceof Exception cause) throw cause;
            if (error.getCause() instanceof Error cause) throw cause;
            throw error;
        }
    }
    private static void reject(Method method, Object value) throws Exception {
        try { invoke(method, value); throw new AssertionError("invalid native value accepted"); }
        catch (IllegalStateException | IllegalArgumentException expected) { rejected++; check(true); }
    }
    private static MemorySegment span(Arena arena, MemorySegment data, long length) {
        var value = arena.allocate(40, 8); value.set(ADDRESS, 0, data); value.set(JAVA_LONG, 8, length); return value;
    }
    public static void main(String[] args) throws Exception {
        Method[] from = new Method[args.length], to = new Method[args.length];
        for (int i = 0; i < args.length; i++) { from[i] = method("from" + args[i]); to[i] = method("to" + args[i]); }
        for (int value = -128; value <= 127; value++) {
            if (value == 0) check(invoke(from[0], (byte)value) == Unit.INSTANCE); else reject(from[0], (byte)value);
            if (value == 0 || value == 1) check(invoke(from[1], (byte)value).equals(value == 1)); else reject(from[1], (byte)value);
        }
        for (int value : new int[] {-1, 0xd800, 0xdfff, 0x110000, Integer.MAX_VALUE}) reject(from[2], value);
        for (int value : new int[] {0, 0xd7ff, 0xe000, 0x1f680, 0x10ffff}) check(invoke(from[2], value).equals(value));
        try (Arena arena = Arena.ofConfined()) {
            var data = arena.allocate(16, 8); data.set(JAVA_INT, 0, 42);
            for (int index = 3; index <= 7; index++) {
                int width = index == 5 || index == 6 ? 4 : index == 7 ? 8 : 1;
                for (long length : new long[] {-1, Long.MIN_VALUE, Long.MAX_VALUE, 1L << 62, 16L * 1024 * 1024 / width + 1})
                    reject(from[index], span(arena, MemorySegment.ofAddress(1), length));
                reject(from[index], span(arena, MemorySegment.NULL, 1));
                if (width > 1) reject(from[index], span(arena, data.asSlice(1), 1));
                Object empty = invoke(from[index], span(arena, MemorySegment.ofAddress(1), 0));
                check(index == 3 ? empty.equals("") : index == 5 || index == 6 ? empty.equals(BigInteger.ZERO) : Array.getLength(empty) == 0);
            }
            for (int index : new int[] {5, 6}) {
                var zero = arena.allocate(8, 4); reject(from[index], span(arena, zero, 1));
                zero.set(JAVA_INT, 0, 1); reject(from[index], span(arena, zero, 2));
                check(invoke(from[index], span(arena, data, 1)).equals(BigInteger.valueOf(42)));
            }
            for (byte sign : new byte[] {2, -1, 127}) {
                var value = span(arena, data, 1); value.set(JAVA_BYTE, 32, sign); reject(from[6], value);
            }
            var negativeZero = span(arena, MemorySegment.ofAddress(1), 0); negativeZero.set(JAVA_BYTE, 32, (byte)1); reject(from[6], negativeZero);
            var negative = span(arena, data, 1); negative.set(JAVA_BYTE, 32, (byte)1); check(invoke(from[6], negative).equals(BigInteger.valueOf(-42)));
            for (byte[] bytes : new byte[][] {{(byte)0xff}, {(byte)0xc0, (byte)0x80}, {(byte)0xed, (byte)0xa0, (byte)0x80}, {(byte)0xf0, (byte)0x9f}}) {
                var buffer = arena.allocate(bytes.length, 1); MemorySegment.copy(MemorySegment.ofArray(bytes), 0, buffer, 0, bytes.length);
                reject(from[3], span(arena, buffer, bytes.length));
            }
            Scope scope = new Scope(arena);
            for (String value : new String[] {"", "ASCII", "雪\u0000🚀"}) check(invoke(from[3], invoke(to[3], value, scope)).equals(value));
            for (String value : new String[] {"\ud800", "\udc00", "before\ud800after"}) {
                try { invoke(to[3], value, scope); throw new AssertionError("malformed UTF-16 accepted"); }
                catch (IllegalArgumentException expected) { rejected++; check(true); }
            }
            for (int bits = 0; bits < 4096; bits += 31) {
                var value = BigInteger.ONE.shiftLeft(bits).add(BigInteger.valueOf(bits));
                for (int index : new int[] {5, 6}) check(invoke(from[index], invoke(to[index], value, scope)).equals(value));
                check(invoke(from[6], invoke(to[6], value.negate(), scope)).equals(value.negate()));
            }
            byte[] bytes = {0, -1, 42}; byte[] result = (byte[])invoke(from[4], invoke(to[4], bytes, scope));
            check(result != bytes && java.util.Arrays.equals(result, bytes)); result[0] = 1; check(bytes[0] == 0);
            Object deep = new long[] {0, 42, 0xffffffffL};
            for (int level = 1; level < 24; level++) {
                Object outer = Array.newInstance(deep.getClass(), 1); Array.set(outer, 0, deep); deep = outer;
            }
            Object output = invoke(from[8], invoke(to[8], deep, scope));
            check(output != deep && Objects.deepEquals(output, deep));
            Object leaf = output;
            for (int level = 1; level < 24; level++) leaf = Array.get(leaf, 0);
            Array.setLong(leaf, 0, 1); check(!Objects.deepEquals(output, deep));
        }
        System.out.println("{\"checks\":" + checks + ",\"rejected\":" + rejected + ",\"nativeCalls\":0}");
    }
}
