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
    private static final MethodHandle CALL0 = downcall("nestedcheckedrecords_echo_array", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL1 = downcall("nestedcheckedrecords_first", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL2 = downcall("nestedcheckedrecords_in_array", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL3 = downcall("nestedcheckedrecords_in_choice", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL4 = downcall("nestedcheckedrecords_in_except", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL5 = downcall("nestedcheckedrecords_in_holder", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL6 = downcall("nestedcheckedrecords_in_list", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL7 = downcall("nestedcheckedrecords_in_option", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL8 = downcall("nestedcheckedrecords_in_product", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL9 = downcall("nestedcheckedrecords_pair", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL10 = downcall("nestedcheckedrecords_produce_array", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL11 = downcall("nestedcheckedrecords_produce_option", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL12 = downcall("nestedcheckedrecords_second", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CLEAR0 = downcall("nestedcheckedrecords_nat_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR1 = downcall("nestedcheckedrecords_packet_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR2 = downcall("nestedcheckedrecords_array_lean_nested_checked_records_packet_span_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR3 = downcall("nestedcheckedrecords_choice_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR4 = downcall("nestedcheckedrecords_result_lean_nested_checked_records_packet_lean_nested_checked_records_packet_value_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR5 = downcall("nestedcheckedrecords_holder_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR6 = downcall("nestedcheckedrecords_list_lean_nested_checked_records_packet_span_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR7 = downcall("nestedcheckedrecords_option_lean_nested_checked_records_packet_value_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR8 = downcall("nestedcheckedrecords_tuple_lean_nested_checked_records_packet_lean_nested_checked_records_packet_value_clear", FunctionDescriptor.ofVoid(ADDRESS));
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
    private static MemorySegment to3(org.leanbridge.nestedcheckedrecords.kotlin.Choice value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(72, 8);
        switch (value) {
            case org.leanbridge.nestedcheckedrecords.kotlin.ChoiceEmpty branch -> {
                result.set(JAVA_INT, 0, 0);

            }
            case org.leanbridge.nestedcheckedrecords.kotlin.ChoicePacket branch -> {
                result.set(JAVA_INT, 0, 1);
                MemorySegment.copy(to1(branch.value(), scope), 0, result, 8, 64);
            }
        }
        return result;
    }
    private static org.leanbridge.nestedcheckedrecords.kotlin.Choice from3(MemorySegment value) {
        return switch (value.get(JAVA_INT, 0)) {
            case 0 -> new org.leanbridge.nestedcheckedrecords.kotlin.ChoiceEmpty();
            case 1 -> new org.leanbridge.nestedcheckedrecords.kotlin.ChoicePacket(from1(value.asSlice(8, 64)));
            default -> throw new IllegalStateException("Invalid native org.leanbridge.nestedcheckedrecords.kotlin.Choice constructor");
        };
    }
    private static MemorySegment to4(org.leanbridge.nestedcheckedrecords.kotlin.Result<org.leanbridge.nestedcheckedrecords.kotlin.Packet, org.leanbridge.nestedcheckedrecords.kotlin.Packet> value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(136, 8);
        if (value.isOk()) { result.set(JAVA_BYTE, 0, (byte)1); MemorySegment.copy(to1(value.value(), scope), 0, result, 8, 64); }
        else { MemorySegment.copy(to1(value.error(), scope), 0, result, 72, 64); }
        return result;
    }
    private static org.leanbridge.nestedcheckedrecords.kotlin.Result<org.leanbridge.nestedcheckedrecords.kotlin.Packet, org.leanbridge.nestedcheckedrecords.kotlin.Packet> from4(MemorySegment value) {
        return switch (value.get(JAVA_BYTE, 0)) { case 1 -> org.leanbridge.nestedcheckedrecords.kotlin.Result.ok(from1(value.asSlice(8, 64))); case 0 -> org.leanbridge.nestedcheckedrecords.kotlin.Result.err(from1(value.asSlice(72, 64))); default -> throw new IllegalStateException("Invalid native Except flag"); };
    }
    private static MemorySegment to5(org.leanbridge.nestedcheckedrecords.kotlin.Holder value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(96, 8);
        MemorySegment.copy(to1(value.packet(), scope), 0, result, 0, 64);
        MemorySegment.copy(to0(value.tag(), scope), 0, result, 64, 32);
        return result;
    }
    private static org.leanbridge.nestedcheckedrecords.kotlin.Holder from5(MemorySegment value) {
        return new org.leanbridge.nestedcheckedrecords.kotlin.Holder(from1(value.asSlice(0, 64)), from0(value.asSlice(64, 32)));
    }
    private static MemorySegment to6(org.leanbridge.nestedcheckedrecords.kotlin.Packet[] value, Scope scope) {
        Objects.requireNonNull(value);
        scope.charge((long)value.length * Math.max(64, 8));
        var data = scope.arena.allocate(Math.max(1, (long)value.length * 64), 8);
        for (int index = 0; index < value.length; index++) { MemorySegment.copy(to1(value[index], scope), 0, data, (long)index * 64, 64); }
        return slice(scope, data, value.length, 32);
    }
    private static org.leanbridge.nestedcheckedrecords.kotlin.Packet[] from6(MemorySegment value) {
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
    private static MemorySegment to7(org.leanbridge.nestedcheckedrecords.kotlin.Option<org.leanbridge.nestedcheckedrecords.kotlin.Packet> value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(72, 8);
        if (value.isSome()) { result.set(JAVA_BYTE, 0, (byte)1); MemorySegment.copy(to1(value.value(), scope), 0, result, 8, 64); }
        return result;
    }
    private static org.leanbridge.nestedcheckedrecords.kotlin.Option<org.leanbridge.nestedcheckedrecords.kotlin.Packet> from7(MemorySegment value) {
        return switch (value.get(JAVA_BYTE, 0)) { case 0 -> org.leanbridge.nestedcheckedrecords.kotlin.Option.none(); case 1 -> org.leanbridge.nestedcheckedrecords.kotlin.Option.some(from1(value.asSlice(8, 64))); default -> throw new IllegalStateException("Invalid native Option flag"); };
    }
    private static MemorySegment to8(org.leanbridge.nestedcheckedrecords.kotlin.Pair<org.leanbridge.nestedcheckedrecords.kotlin.Packet, org.leanbridge.nestedcheckedrecords.kotlin.Packet> value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(128, 8);
        MemorySegment.copy(to1(value.first(), scope), 0, result, 0, 64);
        MemorySegment.copy(to1(value.second(), scope), 0, result, 64, 64);
        return result;
    }
    private static org.leanbridge.nestedcheckedrecords.kotlin.Pair<org.leanbridge.nestedcheckedrecords.kotlin.Packet, org.leanbridge.nestedcheckedrecords.kotlin.Packet> from8(MemorySegment value) {
        return new org.leanbridge.nestedcheckedrecords.kotlin.Pair<>(from1(value.asSlice(0, 64)), from1(value.asSlice(64, 64)));
    }


    static org.leanbridge.nestedcheckedrecords.kotlin.Packet[] call0(org.leanbridge.nestedcheckedrecords.kotlin.Packet[] arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to2(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL0.invokeExact(input0, output, error);
                
                check(status, error);
                return from2(output);
            } finally { CLEAR2.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call1(org.leanbridge.nestedcheckedrecords.kotlin.Packet arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to1(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL1.invokeExact(input0, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call2(org.leanbridge.nestedcheckedrecords.kotlin.Packet[] arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to2(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL2.invokeExact(input0, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call3(org.leanbridge.nestedcheckedrecords.kotlin.Choice arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to3(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL3.invokeExact(input0, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call4(org.leanbridge.nestedcheckedrecords.kotlin.Result<org.leanbridge.nestedcheckedrecords.kotlin.Packet, org.leanbridge.nestedcheckedrecords.kotlin.Packet> arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to4(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL4.invokeExact(input0, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call5(org.leanbridge.nestedcheckedrecords.kotlin.Holder arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to5(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL5.invokeExact(input0, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call6(org.leanbridge.nestedcheckedrecords.kotlin.Packet[] arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to6(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL6.invokeExact(input0, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call7(org.leanbridge.nestedcheckedrecords.kotlin.Option<org.leanbridge.nestedcheckedrecords.kotlin.Packet> arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to7(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL7.invokeExact(input0, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call8(org.leanbridge.nestedcheckedrecords.kotlin.Pair<org.leanbridge.nestedcheckedrecords.kotlin.Packet, org.leanbridge.nestedcheckedrecords.kotlin.Packet> arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to8(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL8.invokeExact(input0, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call9(org.leanbridge.nestedcheckedrecords.kotlin.Packet arg0, org.leanbridge.nestedcheckedrecords.kotlin.Packet arg1) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to1(arg0, scope);
            MemorySegment input1 = to1(arg1, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL9.invokeExact(input0, input1, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static org.leanbridge.nestedcheckedrecords.kotlin.Packet[] call10(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL10.invokeExact(input0, output, error);
                
                check(status, error);
                return from2(output);
            } finally { CLEAR2.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static org.leanbridge.nestedcheckedrecords.kotlin.Option<org.leanbridge.nestedcheckedrecords.kotlin.Packet> call11(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(72, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL11.invokeExact(input0, output, error);
                
                check(status, error);
                return from7(output);
            } finally { CLEAR7.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call12(org.leanbridge.nestedcheckedrecords.kotlin.Packet arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to1(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL12.invokeExact(input0, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
}
