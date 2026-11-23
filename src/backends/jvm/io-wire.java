package __PACKAGE__;

import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.*;
import static java.lang.foreign.ValueLayout.*;

/** Private copied-value ABI. The confined frame lives until its synchronous downcall returns. */
final class Wire implements AutoCloseable {
    private static final int LIMIT = 16 * 1024 * 1024;
    private final Arena arena;
    private final MemorySegment args, out, tags;
    private int remaining = LIMIT;
    private static final class Native {
        static MethodHandle bind(String symbol, FunctionDescriptor type) {
            return Linker.nativeLinker().downcallHandle(NativeAssets.lookup().find(symbol).orElseThrow(), type);
        }
        static final MethodHandle CALL = bind("__INVOKE__", FunctionDescriptor.of(JAVA_INT, JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
        static final MethodHandle CLEAR = bind("__CLEAR__", FunctionDescriptor.ofVoid(ADDRESS));
        static final MethodHandle RETIRE = bind("__RETIRE__", FunctionDescriptor.ofVoid());
    }
    Wire(int slots, int tagBytes) {
        arena = Arena.ofConfined();
        try {
            args = slots == 0 ? MemorySegment.NULL : arena.allocate(24L * slots, 8);
            out = arena.allocate(32, 8); tags = arena.allocate(tagBytes, 1);
        } catch (Throwable t) { arena.close(); throw t; }
    }
    int call(int op) {
        NativeAssets.ensureProcess();
        try { return (int) Native.CALL.invokeExact(op, args, out, tags); }
        catch (RuntimeException | Error e) { throw e; }
        catch (Throwable t) { throw new IllegalStateException("Cannot call the prepared Lean component", t); }
    }
    @Override public void close() {
        try {
            if (out.get(JAVA_LONG, 24) != 0) Native.CLEAR.invokeExact(out);
        } catch (RuntimeException | Error e) { throw e; }
        catch (Throwable t) { throw new IllegalStateException("Cannot dispose the owned Lean result", t); }
        finally { arena.close(); }
    }
    private static IllegalStateException corrupt(String why) {
        var failure = new IllegalStateException(why);
        try { Native.RETIRE.invokeExact(); }
        catch (Throwable t) { failure.addSuppressed(t); }
        return failure;
    }
    static void success(int status) {
        switch (status) {
            case 0: return;
            case 5: throw new IllegalArgumentException("Invalid Lean argument");
            case 10: throw new IllegalStateException("Lean runtime is unavailable");
            case 11: throw new OutOfMemoryError("Lean native allocation failed");
            case 12: throw new IllegalArgumentException("Lean conversion limit exceeded");
            default: throw corrupt("Unexpected synchronous Lean status: " + status);
        }
    }
    void word(int slot, long value) { args.set(JAVA_LONG, slot * 24L, value); }
    void bounded(int slot, long value, long max) {
        if (value < 0 || value > max) throw new IllegalArgumentException("Unsigned Lean integer out of range");
        word(slot, value);
    }
    void unsigned64(int slot, BigInteger value) {
        if (value.signum() < 0 || value.bitLength() > 64) throw new IllegalArgumentException("Unsigned Lean integer out of range");
        word(slot, value.longValue());
    }
    static int codePoint(int value) {
        if (!Character.isValidCodePoint(value) || (value >= 0xd800 && value <= 0xdfff))
            throw new IllegalArgumentException("Not a Unicode scalar");
        return value;
    }
    private void reserve(int bytes) {
        if (bytes > remaining) throw new IllegalArgumentException("Lean conversion limit exceeded");
        remaining -= bytes;
    }
    private void blob(int slot, byte[] value, int n, int count, int sign) {
        MemorySegment ptr = n == 0 ? MemorySegment.NULL : arena.allocate(n, 8);
        if (n != 0) MemorySegment.copy(value, 0, ptr, JAVA_BYTE, 0, value.length);
        long start = slot * 24L;
        args.set(ADDRESS, start, ptr); args.set(JAVA_LONG, start + 8, count); args.set(JAVA_LONG, start + 16, sign);
    }
    void bytes(int slot, byte[] value) {
        reserve(value.length); blob(slot, value, value.length, value.length, 0);
    }
    void text(int slot, String value) {
        int size = 0;
        for (int i = 0; i < value.length();) {
            int c = codePoint(value.codePointAt(i)); i += Character.charCount(c);
            size += c < 128 ? 1 : c < 2048 ? 2 : c < 65536 ? 3 : 4;
            if (size > remaining) throw new IllegalArgumentException("Lean conversion limit exceeded");
        }
        bytes(slot, value.getBytes(StandardCharsets.UTF_8));
    }
    void integer(int slot, BigInteger value, boolean natural) {
        if (natural && value.signum() < 0) throw new IllegalArgumentException("Lean Nat cannot be negative");
        int bits = value.abs().bitLength();
        if (bits > 8L * remaining) throw new IllegalArgumentException("Lean conversion limit exceeded");
        int words = (bits + 63) / 64; reserve(words * 8);
        byte[] be = value.abs().toByteArray(), le = new byte[words * 8];
        for (int i = 0; i < (bits+7)/8; ++i) le[i] = be[be.length-1-i];
        blob(slot, le, le.length, words, value.signum() < 0 ? 1 : 0);
    }
    long scalar() {
        if (out.get(JAVA_LONG, 24) != 0) throw corrupt("Unexpected owned Lean scalar");
        return out.get(JAVA_LONG, 0);
    }
    static boolean bool(long value) {
        if (value != 0 && value != 1) throw corrupt("Invalid Lean discriminant");
        return value == 1;
    }
    boolean tag(int i) { return bool(tags.get(JAVA_BYTE, i)); }
    Unit unit() {
        if (scalar() != 0) throw corrupt("Invalid Lean Unit");
        return Unit.INSTANCE;
    }
    static BigInteger unsigned(long x) {
        return x >= 0 ? BigInteger.valueOf(x) : BigInteger.valueOf(x & Long.MAX_VALUE).setBit(63);
    }
    int charValue() {
        long v = scalar();
        if (v < 0 || v > 0x10ffff || (v >= 0xd800 && v <= 0xdfff)) throw corrupt("Invalid Lean Char");
        return (int)v;
    }
    private byte[] owned(int kind, int width) {
        long n = out.get(JAVA_LONG, 8); MemorySegment p = out.get(ADDRESS, 0);
        if (out.get(JAVA_LONG, 24) != kind || n < 0 || n > LIMIT / width || (n != 0 && p.address() == 0))
            throw corrupt("Invalid owned Lean buffer");
        return n == 0 ? new byte[0] : p.reinterpret(n * width).toArray(JAVA_BYTE);
    }
    byte[] bytes() { return owned(1, 1); }
    String text() {
        try { return StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes())).toString(); }
        catch (CharacterCodingException e) { var failure = corrupt("Invalid Lean UTF-8"); failure.initCause(e); throw failure; }
    }
    BigInteger integer(boolean natural) {
        byte[] m = owned(2, 8);
        for (int i = 0, j = m.length - 1; i < j; ++i, --j) { byte b=m[i]; m[i]=m[j]; m[j]=b; }
        boolean negative = bool(out.get(JAVA_LONG, 16));
        BigInteger value = new BigInteger(1, m);
        if (negative && (natural || value.signum() == 0)) throw corrupt("Invalid Lean integer sign");
        return negative ? value.negate() : value;
    }
}
