package org.leanbridge.nominalsubtypes;
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
    private static final MethodHandle CALL0 = downcall("nominalsubtypes_array_values", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL1 = downcall("nominalsubtypes_branch", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL2 = downcall("nominalsubtypes_event_choices", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL3 = downcall("nominalsubtypes_event_empty", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL4 = downcall("nominalsubtypes_event_value", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL5 = downcall("nominalsubtypes_group_values", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL6 = downcall("nominalsubtypes_list_values", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL7 = downcall("nominalsubtypes_no_items", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL8 = downcall("nominalsubtypes_optional", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL9 = downcall("nominalsubtypes_pair_values", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL10 = downcall("nominalsubtypes_produce_envelope", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL11 = downcall("nominalsubtypes_product", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL12 = downcall("nominalsubtypes_scalar", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CLEAR0 = downcall("nominalsubtypes_nat_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR1 = downcall("nominalsubtypes_array_nat_span_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR2 = downcall("nominalsubtypes_result_nat_nat_value_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR3 = downcall("nominalsubtypes_envelope_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR4 = downcall("nominalsubtypes_option_result_nat_nat_value_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR5 = downcall("nominalsubtypes_array_option_result_nat_nat_span_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR6 = downcall("nominalsubtypes_event_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR7 = downcall("nominalsubtypes_option_lean_nominal_subtypes_envelope_value_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR8 = downcall("nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR9 = downcall("nominalsubtypes_list_nat_span_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR10 = downcall("nominalsubtypes_option_nat_value_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR11 = downcall("nominalsubtypes_alias_pair_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR12 = downcall("nominalsubtypes_tuple_nat_nat_value_clear", FunctionDescriptor.ofVoid(ADDRESS));
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
    private static MemorySegment to1(java.math.BigInteger[] value, Scope scope) {
        Objects.requireNonNull(value);
        scope.charge((long)value.length * Math.max(32, 8));
        var data = scope.arena.allocate(Math.max(1, (long)value.length * 32), 8);
        for (int index = 0; index < value.length; index++) { MemorySegment.copy(to0(value[index], scope), 0, data, (long)index * 32, 32); }
        return slice(scope, data, value.length, 32);
    }
    private static java.math.BigInteger[] from1(MemorySegment value) {
        long length = value.get(JAVA_LONG, 8);
        if (length < 0 || length > (16 * 1024 * 1024) / Math.max(32, 8))
            throw new IllegalArgumentException("Lean Bridge native sequence exceeds the 16 MiB copy limit");
        var pointer = value.get(ADDRESS, 0);
        if (length != 0 && (pointer.address() == 0 || pointer.address() % 8 != 0))
            throw new IllegalStateException("Invalid native sequence buffer");
        int count = (int)length;
        @SuppressWarnings("unchecked")
        var result = (java.math.BigInteger[])java.lang.reflect.Array.newInstance(java.math.BigInteger.class, count);
        var data = pointer.reinterpret((long)count * 32);
        for (int index = 0; index < count; index++) result[index] = from0(data.asSlice((long)index * 32, 32));
        return result;
    }
    private static MemorySegment to2(org.leanbridge.nominalsubtypes.kotlin.Result<java.math.BigInteger, java.math.BigInteger> value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(72, 8);
        if (value.isOk()) { result.set(JAVA_BYTE, 0, (byte)1); MemorySegment.copy(to0(value.value(), scope), 0, result, 8, 32); }
        else { MemorySegment.copy(to0(value.error(), scope), 0, result, 40, 32); }
        return result;
    }
    private static org.leanbridge.nominalsubtypes.kotlin.Result<java.math.BigInteger, java.math.BigInteger> from2(MemorySegment value) {
        return switch (value.get(JAVA_BYTE, 0)) { case 1 -> org.leanbridge.nominalsubtypes.kotlin.Result.ok(from0(value.asSlice(8, 32))); case 0 -> org.leanbridge.nominalsubtypes.kotlin.Result.err(from0(value.asSlice(40, 32))); default -> throw new IllegalStateException("Invalid native Except flag"); };
    }
    private static MemorySegment to3(org.leanbridge.nominalsubtypes.kotlin.Envelope value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(64, 8);
        MemorySegment.copy(to0(value.payload(), scope), 0, result, 0, 32);
        MemorySegment.copy(to0(value.digit(), scope), 0, result, 32, 32);
        return result;
    }
    private static org.leanbridge.nominalsubtypes.kotlin.Envelope from3(MemorySegment value) {
        return new org.leanbridge.nominalsubtypes.kotlin.Envelope(from0(value.asSlice(0, 32)), from0(value.asSlice(32, 32)));
    }
    private static MemorySegment to4(org.leanbridge.nominalsubtypes.kotlin.Option<org.leanbridge.nominalsubtypes.kotlin.Result<java.math.BigInteger, java.math.BigInteger>> value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(80, 8);
        if (value.isSome()) { result.set(JAVA_BYTE, 0, (byte)1); MemorySegment.copy(to2(value.value(), scope), 0, result, 8, 72); }
        return result;
    }
    private static org.leanbridge.nominalsubtypes.kotlin.Option<org.leanbridge.nominalsubtypes.kotlin.Result<java.math.BigInteger, java.math.BigInteger>> from4(MemorySegment value) {
        return switch (value.get(JAVA_BYTE, 0)) { case 0 -> org.leanbridge.nominalsubtypes.kotlin.Option.none(); case 1 -> org.leanbridge.nominalsubtypes.kotlin.Option.some(from2(value.asSlice(8, 72))); default -> throw new IllegalStateException("Invalid native Option flag"); };
    }
    private static MemorySegment to5(org.leanbridge.nominalsubtypes.kotlin.Option<org.leanbridge.nominalsubtypes.kotlin.Result<java.math.BigInteger, java.math.BigInteger>>[] value, Scope scope) {
        Objects.requireNonNull(value);
        scope.charge((long)value.length * Math.max(80, 8));
        var data = scope.arena.allocate(Math.max(1, (long)value.length * 80), 8);
        for (int index = 0; index < value.length; index++) { MemorySegment.copy(to4(value[index], scope), 0, data, (long)index * 80, 80); }
        return slice(scope, data, value.length, 32);
    }
    private static org.leanbridge.nominalsubtypes.kotlin.Option<org.leanbridge.nominalsubtypes.kotlin.Result<java.math.BigInteger, java.math.BigInteger>>[] from5(MemorySegment value) {
        long length = value.get(JAVA_LONG, 8);
        if (length < 0 || length > (16 * 1024 * 1024) / Math.max(80, 8))
            throw new IllegalArgumentException("Lean Bridge native sequence exceeds the 16 MiB copy limit");
        var pointer = value.get(ADDRESS, 0);
        if (length != 0 && (pointer.address() == 0 || pointer.address() % 8 != 0))
            throw new IllegalStateException("Invalid native sequence buffer");
        int count = (int)length;
        @SuppressWarnings("unchecked")
        var result = (org.leanbridge.nominalsubtypes.kotlin.Option<org.leanbridge.nominalsubtypes.kotlin.Result<java.math.BigInteger, java.math.BigInteger>>[])java.lang.reflect.Array.newInstance(org.leanbridge.nominalsubtypes.kotlin.Option.class, count);
        var data = pointer.reinterpret((long)count * 80);
        for (int index = 0; index < count; index++) result[index] = from4(data.asSlice((long)index * 80, 80));
        return result;
    }
    private static MemorySegment to6(org.leanbridge.nominalsubtypes.kotlin.Event value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(72, 8);
        switch (value) {
            case org.leanbridge.nominalsubtypes.kotlin.EventEmpty branch -> {
                result.set(JAVA_INT, 0, 0);

            }
            case org.leanbridge.nominalsubtypes.kotlin.EventBox branch -> {
                result.set(JAVA_INT, 0, 1);
                MemorySegment.copy(to3(branch.value(), scope), 0, result, 8, 64);
            }
            case org.leanbridge.nominalsubtypes.kotlin.EventChoices branch -> {
                result.set(JAVA_INT, 0, 2);
                MemorySegment.copy(to5(branch.values(), scope), 0, result, 8, 32);
            }
        }
        return result;
    }
    private static org.leanbridge.nominalsubtypes.kotlin.Event from6(MemorySegment value) {
        return switch (value.get(JAVA_INT, 0)) {
            case 0 -> new org.leanbridge.nominalsubtypes.kotlin.EventEmpty();
            case 1 -> new org.leanbridge.nominalsubtypes.kotlin.EventBox(from3(value.asSlice(8, 64)));
            case 2 -> new org.leanbridge.nominalsubtypes.kotlin.EventChoices(from5(value.asSlice(8, 32)));
            default -> throw new IllegalStateException("Invalid native org.leanbridge.nominalsubtypes.kotlin.Event constructor");
        };
    }
    private static MemorySegment to7(org.leanbridge.nominalsubtypes.kotlin.Option<org.leanbridge.nominalsubtypes.kotlin.Envelope> value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(72, 8);
        if (value.isSome()) { result.set(JAVA_BYTE, 0, (byte)1); MemorySegment.copy(to3(value.value(), scope), 0, result, 8, 64); }
        return result;
    }
    private static org.leanbridge.nominalsubtypes.kotlin.Option<org.leanbridge.nominalsubtypes.kotlin.Envelope> from7(MemorySegment value) {
        return switch (value.get(JAVA_BYTE, 0)) { case 0 -> org.leanbridge.nominalsubtypes.kotlin.Option.none(); case 1 -> org.leanbridge.nominalsubtypes.kotlin.Option.some(from3(value.asSlice(8, 64))); default -> throw new IllegalStateException("Invalid native Option flag"); };
    }
    private static MemorySegment to8(org.leanbridge.nominalsubtypes.kotlin.Option<org.leanbridge.nominalsubtypes.kotlin.Envelope>[] value, Scope scope) {
        Objects.requireNonNull(value);
        scope.charge((long)value.length * Math.max(72, 8));
        var data = scope.arena.allocate(Math.max(1, (long)value.length * 72), 8);
        for (int index = 0; index < value.length; index++) { MemorySegment.copy(to7(value[index], scope), 0, data, (long)index * 72, 72); }
        return slice(scope, data, value.length, 32);
    }
    private static org.leanbridge.nominalsubtypes.kotlin.Option<org.leanbridge.nominalsubtypes.kotlin.Envelope>[] from8(MemorySegment value) {
        long length = value.get(JAVA_LONG, 8);
        if (length < 0 || length > (16 * 1024 * 1024) / Math.max(72, 8))
            throw new IllegalArgumentException("Lean Bridge native sequence exceeds the 16 MiB copy limit");
        var pointer = value.get(ADDRESS, 0);
        if (length != 0 && (pointer.address() == 0 || pointer.address() % 8 != 0))
            throw new IllegalStateException("Invalid native sequence buffer");
        int count = (int)length;
        @SuppressWarnings("unchecked")
        var result = (org.leanbridge.nominalsubtypes.kotlin.Option<org.leanbridge.nominalsubtypes.kotlin.Envelope>[])java.lang.reflect.Array.newInstance(org.leanbridge.nominalsubtypes.kotlin.Option.class, count);
        var data = pointer.reinterpret((long)count * 72);
        for (int index = 0; index < count; index++) result[index] = from7(data.asSlice((long)index * 72, 72));
        return result;
    }
    private static MemorySegment to9(java.math.BigInteger[] value, Scope scope) {
        Objects.requireNonNull(value);
        scope.charge((long)value.length * Math.max(32, 8));
        var data = scope.arena.allocate(Math.max(1, (long)value.length * 32), 8);
        for (int index = 0; index < value.length; index++) { MemorySegment.copy(to0(value[index], scope), 0, data, (long)index * 32, 32); }
        return slice(scope, data, value.length, 32);
    }
    private static java.math.BigInteger[] from9(MemorySegment value) {
        long length = value.get(JAVA_LONG, 8);
        if (length < 0 || length > (16 * 1024 * 1024) / Math.max(32, 8))
            throw new IllegalArgumentException("Lean Bridge native sequence exceeds the 16 MiB copy limit");
        var pointer = value.get(ADDRESS, 0);
        if (length != 0 && (pointer.address() == 0 || pointer.address() % 8 != 0))
            throw new IllegalStateException("Invalid native sequence buffer");
        int count = (int)length;
        @SuppressWarnings("unchecked")
        var result = (java.math.BigInteger[])java.lang.reflect.Array.newInstance(java.math.BigInteger.class, count);
        var data = pointer.reinterpret((long)count * 32);
        for (int index = 0; index < count; index++) result[index] = from0(data.asSlice((long)index * 32, 32));
        return result;
    }
    private static MemorySegment to10(org.leanbridge.nominalsubtypes.kotlin.Option<java.math.BigInteger> value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(40, 8);
        if (value.isSome()) { result.set(JAVA_BYTE, 0, (byte)1); MemorySegment.copy(to0(value.value(), scope), 0, result, 8, 32); }
        return result;
    }
    private static org.leanbridge.nominalsubtypes.kotlin.Option<java.math.BigInteger> from10(MemorySegment value) {
        return switch (value.get(JAVA_BYTE, 0)) { case 0 -> org.leanbridge.nominalsubtypes.kotlin.Option.none(); case 1 -> org.leanbridge.nominalsubtypes.kotlin.Option.some(from0(value.asSlice(8, 32))); default -> throw new IllegalStateException("Invalid native Option flag"); };
    }
    private static MemorySegment to11(org.leanbridge.nominalsubtypes.kotlin.AliasPair value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(64, 8);
        MemorySegment.copy(to8(value.left(), scope), 0, result, 0, 32);
        MemorySegment.copy(to8(value.right(), scope), 0, result, 32, 32);
        return result;
    }
    private static org.leanbridge.nominalsubtypes.kotlin.AliasPair from11(MemorySegment value) {
        return new org.leanbridge.nominalsubtypes.kotlin.AliasPair(from8(value.asSlice(0, 32)), from8(value.asSlice(32, 32)));
    }
    private static MemorySegment to12(org.leanbridge.nominalsubtypes.kotlin.Pair<java.math.BigInteger, java.math.BigInteger> value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(64, 8);
        MemorySegment.copy(to0(value.first(), scope), 0, result, 0, 32);
        MemorySegment.copy(to0(value.second(), scope), 0, result, 32, 32);
        return result;
    }
    private static org.leanbridge.nominalsubtypes.kotlin.Pair<java.math.BigInteger, java.math.BigInteger> from12(MemorySegment value) {
        return new org.leanbridge.nominalsubtypes.kotlin.Pair<>(from0(value.asSlice(0, 32)), from0(value.asSlice(32, 32)));
    }


    static java.math.BigInteger[] call0(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL0.invokeExact(input0, output, error);
                
                check(status, error);
                return from1(output);
            } finally { CLEAR1.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static org.leanbridge.nominalsubtypes.kotlin.Result<java.math.BigInteger, java.math.BigInteger> call1(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(72, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL1.invokeExact(input0, output, error);
                
                check(status, error);
                return from2(output);
            } finally { CLEAR2.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static org.leanbridge.nominalsubtypes.kotlin.Event call2(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(72, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL2.invokeExact(input0, output, error);
                
                check(status, error);
                return from6(output);
            } finally { CLEAR6.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static org.leanbridge.nominalsubtypes.kotlin.Event call3(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(72, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL3.invokeExact(input0, output, error);
                
                check(status, error);
                return from6(output);
            } finally { CLEAR6.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static org.leanbridge.nominalsubtypes.kotlin.Event call4(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(72, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL4.invokeExact(input0, output, error);
                
                check(status, error);
                return from6(output);
            } finally { CLEAR6.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static org.leanbridge.nominalsubtypes.kotlin.Option<org.leanbridge.nominalsubtypes.kotlin.Envelope>[] call5(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL5.invokeExact(input0, output, error);
                
                check(status, error);
                return from8(output);
            } finally { CLEAR8.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger[] call6(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL6.invokeExact(input0, output, error);
                
                check(status, error);
                return from9(output);
            } finally { CLEAR9.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger[] call7(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL7.invokeExact(input0, output, error);
                
                check(status, error);
                return from1(output);
            } finally { CLEAR1.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static org.leanbridge.nominalsubtypes.kotlin.Option<java.math.BigInteger> call8(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(40, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL8.invokeExact(input0, output, error);
                
                check(status, error);
                return from10(output);
            } finally { CLEAR10.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static org.leanbridge.nominalsubtypes.kotlin.AliasPair call9(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(64, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL9.invokeExact(input0, output, error);
                
                check(status, error);
                return from11(output);
            } finally { CLEAR11.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static org.leanbridge.nominalsubtypes.kotlin.Envelope call10(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(64, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL10.invokeExact(input0, output, error);
                
                check(status, error);
                return from3(output);
            } finally { CLEAR3.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static org.leanbridge.nominalsubtypes.kotlin.Pair<java.math.BigInteger, java.math.BigInteger> call11(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(64, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL11.invokeExact(input0, output, error);
                
                check(status, error);
                return from12(output);
            } finally { CLEAR12.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call12(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
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
