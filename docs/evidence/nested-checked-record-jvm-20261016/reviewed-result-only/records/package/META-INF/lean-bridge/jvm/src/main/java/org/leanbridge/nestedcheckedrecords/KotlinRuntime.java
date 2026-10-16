package org.leanbridge.nestedcheckedrecords;
import static java.lang.foreign.ValueLayout.*;
import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.math.BigInteger;
import java.nio.CharBuffer;
import java.nio.charset.*;
import java.util.Objects;

final class KotlinRuntime {
    private KotlinRuntime() { }
    private static final SymbolLookup LOOKUP = NativeAssets.lookup();
    private static MethodHandle downcall(String name, FunctionDescriptor descriptor) {
        return Linker.nativeLinker().downcallHandle(LOOKUP.find(name).orElseThrow(), descriptor);
    }
    private static final MethodHandle CALL0 = downcall("nestedcheckedrecords_produce_array", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL1 = downcall("nestedcheckedrecords_produce_option", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CLEAR0 = downcall("nestedcheckedrecords_nat_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR1 = downcall("nestedcheckedrecords_packet_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR2 = downcall("nestedcheckedrecords_array_lean_nested_checked_records_packet_span_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR3 = downcall("nestedcheckedrecords_option_lean_nested_checked_records_packet_value_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static MemorySegment slice(Scope scope, MemorySegment data, long length, int size) {
        var result = scope.arena.allocate(size, 8);
        result.set(ADDRESS, 0, data); result.set(JAVA_LONG, 8, length);
        return result;
    }
    private static MemorySegment checkedData(MemorySegment value, long width, long alignment) {
        long length = value.get(JAVA_LONG, 8);
        if (length < 0 || length > (16 * 1024 * 1024) / width)
            throw new IllegalArgumentException("Lean Bridge native buffer exceeds the 16 MiB copy limit");
        if (length == 0) return MemorySegment.NULL;
        var pointer = value.get(ADDRESS, 0);
        if (pointer.address() == 0 || pointer.address() % alignment != 0)
            throw new IllegalStateException("Invalid native buffer");
        return pointer.reinterpret(length * width);
    }
    private static MemorySegment data(MemorySegment value) { return checkedData(value, 1, 1); }
    private static int utf8Length(String value) {
        long length = 0;
        for (int index = 0; index < value.length(); index++) {
            char next = value.charAt(index);
            if (Character.isHighSurrogate(next)) {
                if (++index == value.length() || !Character.isLowSurrogate(value.charAt(index))) throw new IllegalArgumentException("Invalid UTF-16");
                length += 4;
            } else if (Character.isLowSurrogate(next)) throw new IllegalArgumentException("Invalid UTF-16");
            else length += next < 128 ? 1 : next < 2048 ? 2 : 3;
        }
        if (length > 16 * 1024 * 1024) throw new IllegalArgumentException("Lean Bridge copy budget exceeded");
        return (int)length;
    }
    private static RuntimeException propagate(Throwable error) {
        if (error instanceof RuntimeException runtime) return runtime;
        if (error instanceof Error fatal) throw fatal;
        return new LeanBridgeException("Native call failed", error);
    }
    private static void check(int status, MemorySegment error) {
        if (status == 0) return;
        var address = error.get(ADDRESS, 8);
        String message = address.equals(MemorySegment.NULL) ? "Lean call failed" : new String(address.reinterpret(error.get(JAVA_LONG, 16)).toArray(JAVA_BYTE), StandardCharsets.UTF_8);
        if (status == 1) throw new IllegalArgumentException(message);
        throw new LeanBridgeException(message, null);
    }
    private static MemorySegment to0(java.math.BigInteger value, Scope scope) {
        Objects.requireNonNull(value);
        if (value.signum() < 0) throw new IllegalArgumentException("Nat cannot be negative");
        var magnitude = value.abs();
        long limbs = ((long)magnitude.bitLength() + 31) / 32;
        var data = scope.allocate(Math.max(1, limbs * 4), 4);
        byte[] bytes = magnitude.toByteArray();
        for (int index = 0; index < bytes.length && index < limbs * 4; index++) data.set(JAVA_BYTE, index, bytes[bytes.length - 1 - index]);
        var result = slice(scope, data, limbs, 32);
        
        return result;
    }
    private static java.math.BigInteger from0(MemorySegment value) {
        var buffer = checkedData(value, 4, 4);
        long limbs = value.get(JAVA_LONG, 8);
        if (limbs != 0 && buffer.get(JAVA_INT, (limbs - 1) * 4) == 0)
            throw new IllegalStateException("Invalid native integer magnitude");
        
        byte[] bytes = buffer.toArray(JAVA_BYTE);
        for (int left = 0, right = bytes.length - 1; left < right; left++, right--) { byte saved = bytes[left]; bytes[left] = bytes[right]; bytes[right] = saved; }
        var result = new BigInteger(1, bytes);
        return result;
    }
    private static MemorySegment to1(org.leanbridge.nestedcheckedrecords.kotlin.Packet value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(64, 8);
        MemorySegment.copy(to0(value.digit(), scope), 0, result, 0, 32);
        MemorySegment.copy(to0(value.word(), scope), 0, result, 32, 32);
        return result;
    }
    private static org.leanbridge.nestedcheckedrecords.kotlin.Packet from1(MemorySegment value) {
        return new org.leanbridge.nestedcheckedrecords.kotlin.Packet(from0(value.asSlice(0, 32)), from0(value.asSlice(32, 32)));
    }
    private static MemorySegment to2(org.leanbridge.nestedcheckedrecords.kotlin.Packet[] value, Scope scope) {
        Objects.requireNonNull(value);
        scope.charge((long)value.length * Math.max(64, 8));
        var data = scope.arena.allocate(Math.max(1, (long)value.length * 64), 8);
        for (int index = 0; index < value.length; index++) { MemorySegment.copy(to1(value[index], scope), 0, data, (long)index * 64, 64); }
        return slice(scope, data, value.length, 32);
    }
    private static org.leanbridge.nestedcheckedrecords.kotlin.Packet[] from2(MemorySegment value) {
        long length = value.get(JAVA_LONG, 8);
        if (length < 0 || length > (16 * 1024 * 1024) / Math.max(64, 8))
            throw new IllegalArgumentException("Lean Bridge native sequence exceeds the 16 MiB copy limit");
        var pointer = value.get(ADDRESS, 0);
        if (length != 0 && (pointer.address() == 0 || pointer.address() % 8 != 0))
            throw new IllegalStateException("Invalid native sequence buffer");
        int count = (int)length;
        @SuppressWarnings("unchecked")
        var result = (org.leanbridge.nestedcheckedrecords.kotlin.Packet[])java.lang.reflect.Array.newInstance(org.leanbridge.nestedcheckedrecords.kotlin.Packet.class, count);
        var data = pointer.reinterpret((long)count * 64);
        for (int index = 0; index < count; index++) result[index] = from1(data.asSlice((long)index * 64, 64));
        return result;
    }
    private static MemorySegment to3(org.leanbridge.nestedcheckedrecords.kotlin.Option<org.leanbridge.nestedcheckedrecords.kotlin.Packet> value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(72, 8);
        if (value.isSome()) { result.set(JAVA_BYTE, 0, (byte)1); MemorySegment.copy(to1(value.value(), scope), 0, result, 8, 64); }
        return result;
    }
    private static org.leanbridge.nestedcheckedrecords.kotlin.Option<org.leanbridge.nestedcheckedrecords.kotlin.Packet> from3(MemorySegment value) {
        return switch (value.get(JAVA_BYTE, 0)) { case 0 -> org.leanbridge.nestedcheckedrecords.kotlin.Option.none(); case 1 -> org.leanbridge.nestedcheckedrecords.kotlin.Option.some(from1(value.asSlice(8, 64))); default -> throw new IllegalStateException("Invalid native Option flag"); };
    }


    static org.leanbridge.nestedcheckedrecords.kotlin.Packet[] call0(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL0.invokeExact(input0, output, error);
                
                check(status, error);
                return from2(output);
            } finally { CLEAR2.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static org.leanbridge.nestedcheckedrecords.kotlin.Option<org.leanbridge.nestedcheckedrecords.kotlin.Packet> call1(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(72, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL1.invokeExact(input0, output, error);
                
                check(status, error);
                return from3(output);
            } finally { CLEAR3.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
}
