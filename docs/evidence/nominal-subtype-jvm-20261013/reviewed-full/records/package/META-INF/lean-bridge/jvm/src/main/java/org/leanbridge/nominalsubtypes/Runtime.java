package org.leanbridge.nominalsubtypes;
import static java.lang.foreign.ValueLayout.*;
import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.math.BigInteger;
import java.nio.CharBuffer;
import java.nio.charset.*;
import java.util.Objects;

final class Runtime {
    private Runtime() { }
    private static final SymbolLookup LOOKUP = NativeAssets.lookup();
    private static MethodHandle downcall(String name, FunctionDescriptor descriptor) {
        return Linker.nativeLinker().downcallHandle(LOOKUP.find(name).orElseThrow(), descriptor);
    }
    private static final MethodHandle CALL0 = downcall("nominalsubtypes_aliases", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL1 = downcall("nominalsubtypes_array_values", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL2 = downcall("nominalsubtypes_branch", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL3 = downcall("nominalsubtypes_combine", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL4 = downcall("nominalsubtypes_echo", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL5 = downcall("nominalsubtypes_echo_event", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL6 = downcall("nominalsubtypes_echo_groups", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL7 = downcall("nominalsubtypes_echo_pair", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL8 = downcall("nominalsubtypes_event_choices", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL9 = downcall("nominalsubtypes_event_empty", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL10 = downcall("nominalsubtypes_event_first", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL11 = downcall("nominalsubtypes_event_second", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL12 = downcall("nominalsubtypes_event_value", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL13 = downcall("nominalsubtypes_first", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL14 = downcall("nominalsubtypes_group_values", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL15 = downcall("nominalsubtypes_inspect_alias_pair", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL16 = downcall("nominalsubtypes_list_values", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL17 = downcall("nominalsubtypes_nested", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL18 = downcall("nominalsubtypes_no_items", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL19 = downcall("nominalsubtypes_optional", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL20 = downcall("nominalsubtypes_pair_values", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL21 = downcall("nominalsubtypes_plain_fin", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL22 = downcall("nominalsubtypes_produce_envelope", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL23 = downcall("nominalsubtypes_product", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL24 = downcall("nominalsubtypes_scalar", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL25 = downcall("nominalsubtypes_second", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CLEAR0 = downcall("nominalsubtypes_nat_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR1 = downcall("nominalsubtypes_envelope_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR2 = downcall("nominalsubtypes_option_lean_nominal_subtypes_envelope_value_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR3 = downcall("nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR4 = downcall("nominalsubtypes_array_nat_span_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR5 = downcall("nominalsubtypes_result_nat_nat_value_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR6 = downcall("nominalsubtypes_option_result_nat_nat_value_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR7 = downcall("nominalsubtypes_array_option_result_nat_nat_span_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR8 = downcall("nominalsubtypes_event_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR9 = downcall("nominalsubtypes_alias_pair_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR10 = downcall("nominalsubtypes_list_nat_span_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR11 = downcall("nominalsubtypes_envelope_pair_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR12 = downcall("nominalsubtypes_option_nat_value_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR13 = downcall("nominalsubtypes_tuple_nat_nat_value_clear", FunctionDescriptor.ofVoid(ADDRESS));
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
    private static MemorySegment to1(Envelope value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(64, 8);
        MemorySegment.copy(to0(value.payload(), scope), 0, result, 0, 32);
        MemorySegment.copy(to0(value.digit(), scope), 0, result, 32, 32);
        return result;
    }
    private static Envelope from1(MemorySegment value) {
        return new Envelope(from0(value.asSlice(0, 32)), from0(value.asSlice(32, 32)));
    }
    private static MemorySegment to2(Option<Envelope> value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(72, 8);
        if (value.isSome()) { result.set(JAVA_BYTE, 0, (byte)1); MemorySegment.copy(to1(value.value(), scope), 0, result, 8, 64); }
        return result;
    }
    private static Option<Envelope> from2(MemorySegment value) {
        return switch (value.get(JAVA_BYTE, 0)) { case 0 -> Option.none(); case 1 -> Option.some(from1(value.asSlice(8, 64))); default -> throw new IllegalStateException("Invalid native Option flag"); };
    }
    private static MemorySegment to3(Option<Envelope>[] value, Scope scope) {
        Objects.requireNonNull(value);
        scope.charge((long)value.length * Math.max(72, 8));
        var data = scope.arena.allocate(Math.max(1, (long)value.length * 72), 8);
        for (int index = 0; index < value.length; index++) { MemorySegment.copy(to2(value[index], scope), 0, data, (long)index * 72, 72); }
        return slice(scope, data, value.length, 32);
    }
    private static Option<Envelope>[] from3(MemorySegment value) {
        long length = value.get(JAVA_LONG, 8);
        if (length < 0 || length > (16 * 1024 * 1024) / Math.max(72, 8))
            throw new IllegalArgumentException("Lean Bridge native sequence exceeds the 16 MiB copy limit");
        var pointer = value.get(ADDRESS, 0);
        if (length != 0 && (pointer.address() == 0 || pointer.address() % 8 != 0))
            throw new IllegalStateException("Invalid native sequence buffer");
        int count = (int)length;
        @SuppressWarnings("unchecked")
        var result = (Option<Envelope>[])java.lang.reflect.Array.newInstance(Option.class, count);
        var data = pointer.reinterpret((long)count * 72);
        for (int index = 0; index < count; index++) result[index] = from2(data.asSlice((long)index * 72, 72));
        return result;
    }
    private static MemorySegment to4(java.math.BigInteger[] value, Scope scope) {
        Objects.requireNonNull(value);
        scope.charge((long)value.length * Math.max(32, 8));
        var data = scope.arena.allocate(Math.max(1, (long)value.length * 32), 8);
        for (int index = 0; index < value.length; index++) { MemorySegment.copy(to0(value[index], scope), 0, data, (long)index * 32, 32); }
        return slice(scope, data, value.length, 32);
    }
    private static java.math.BigInteger[] from4(MemorySegment value) {
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
    private static MemorySegment to5(Result<java.math.BigInteger, java.math.BigInteger> value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(72, 8);
        if (value.isOk()) { result.set(JAVA_BYTE, 0, (byte)1); MemorySegment.copy(to0(value.value(), scope), 0, result, 8, 32); }
        else { MemorySegment.copy(to0(value.error(), scope), 0, result, 40, 32); }
        return result;
    }
    private static Result<java.math.BigInteger, java.math.BigInteger> from5(MemorySegment value) {
        return switch (value.get(JAVA_BYTE, 0)) { case 1 -> Result.ok(from0(value.asSlice(8, 32))); case 0 -> Result.err(from0(value.asSlice(40, 32))); default -> throw new IllegalStateException("Invalid native Except flag"); };
    }
    private static MemorySegment to6(Option<Result<java.math.BigInteger, java.math.BigInteger>> value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(80, 8);
        if (value.isSome()) { result.set(JAVA_BYTE, 0, (byte)1); MemorySegment.copy(to5(value.value(), scope), 0, result, 8, 72); }
        return result;
    }
    private static Option<Result<java.math.BigInteger, java.math.BigInteger>> from6(MemorySegment value) {
        return switch (value.get(JAVA_BYTE, 0)) { case 0 -> Option.none(); case 1 -> Option.some(from5(value.asSlice(8, 72))); default -> throw new IllegalStateException("Invalid native Option flag"); };
    }
    private static MemorySegment to7(Option<Result<java.math.BigInteger, java.math.BigInteger>>[] value, Scope scope) {
        Objects.requireNonNull(value);
        scope.charge((long)value.length * Math.max(80, 8));
        var data = scope.arena.allocate(Math.max(1, (long)value.length * 80), 8);
        for (int index = 0; index < value.length; index++) { MemorySegment.copy(to6(value[index], scope), 0, data, (long)index * 80, 80); }
        return slice(scope, data, value.length, 32);
    }
    private static Option<Result<java.math.BigInteger, java.math.BigInteger>>[] from7(MemorySegment value) {
        long length = value.get(JAVA_LONG, 8);
        if (length < 0 || length > (16 * 1024 * 1024) / Math.max(80, 8))
            throw new IllegalArgumentException("Lean Bridge native sequence exceeds the 16 MiB copy limit");
        var pointer = value.get(ADDRESS, 0);
        if (length != 0 && (pointer.address() == 0 || pointer.address() % 8 != 0))
            throw new IllegalStateException("Invalid native sequence buffer");
        int count = (int)length;
        @SuppressWarnings("unchecked")
        var result = (Option<Result<java.math.BigInteger, java.math.BigInteger>>[])java.lang.reflect.Array.newInstance(Option.class, count);
        var data = pointer.reinterpret((long)count * 80);
        for (int index = 0; index < count; index++) result[index] = from6(data.asSlice((long)index * 80, 80));
        return result;
    }
    private static MemorySegment to8(Event value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(72, 8);
        switch (value) {
            case EventEmpty branch -> {
                result.set(JAVA_INT, 0, 0);

            }
            case EventBox branch -> {
                result.set(JAVA_INT, 0, 1);
                MemorySegment.copy(to1(branch.value(), scope), 0, result, 8, 64);
            }
            case EventChoices branch -> {
                result.set(JAVA_INT, 0, 2);
                MemorySegment.copy(to7(branch.values(), scope), 0, result, 8, 32);
            }
        }
        return result;
    }
    private static Event from8(MemorySegment value) {
        return switch (value.get(JAVA_INT, 0)) {
            case 0 -> new EventEmpty();
            case 1 -> new EventBox(from1(value.asSlice(8, 64)));
            case 2 -> new EventChoices(from7(value.asSlice(8, 32)));
            default -> throw new IllegalStateException("Invalid native Event constructor");
        };
    }
    private static MemorySegment to9(AliasPair value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(64, 8);
        MemorySegment.copy(to3(value.left(), scope), 0, result, 0, 32);
        MemorySegment.copy(to3(value.right(), scope), 0, result, 32, 32);
        return result;
    }
    private static AliasPair from9(MemorySegment value) {
        return new AliasPair(from3(value.asSlice(0, 32)), from3(value.asSlice(32, 32)));
    }
    private static MemorySegment to10(java.math.BigInteger[] value, Scope scope) {
        Objects.requireNonNull(value);
        scope.charge((long)value.length * Math.max(32, 8));
        var data = scope.arena.allocate(Math.max(1, (long)value.length * 32), 8);
        for (int index = 0; index < value.length; index++) { MemorySegment.copy(to0(value[index], scope), 0, data, (long)index * 32, 32); }
        return slice(scope, data, value.length, 32);
    }
    private static java.math.BigInteger[] from10(MemorySegment value) {
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
    private static MemorySegment to11(EnvelopePair value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(128, 8);
        MemorySegment.copy(to1(value.left(), scope), 0, result, 0, 64);
        MemorySegment.copy(to1(value.right(), scope), 0, result, 64, 64);
        return result;
    }
    private static EnvelopePair from11(MemorySegment value) {
        return new EnvelopePair(from1(value.asSlice(0, 64)), from1(value.asSlice(64, 64)));
    }
    private static MemorySegment to12(Option<java.math.BigInteger> value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(40, 8);
        if (value.isSome()) { result.set(JAVA_BYTE, 0, (byte)1); MemorySegment.copy(to0(value.value(), scope), 0, result, 8, 32); }
        return result;
    }
    private static Option<java.math.BigInteger> from12(MemorySegment value) {
        return switch (value.get(JAVA_BYTE, 0)) { case 0 -> Option.none(); case 1 -> Option.some(from0(value.asSlice(8, 32))); default -> throw new IllegalStateException("Invalid native Option flag"); };
    }
    private static MemorySegment to13(Pair<java.math.BigInteger, java.math.BigInteger> value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(64, 8);
        MemorySegment.copy(to0(value.first(), scope), 0, result, 0, 32);
        MemorySegment.copy(to0(value.second(), scope), 0, result, 32, 32);
        return result;
    }
    private static Pair<java.math.BigInteger, java.math.BigInteger> from13(MemorySegment value) {
        return new Pair<>(from0(value.asSlice(0, 32)), from0(value.asSlice(32, 32)));
    }


    static java.math.BigInteger call0(Option<Envelope>[] arg0, Option<Envelope>[] arg1) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to3(arg0, scope);
            MemorySegment input1 = to3(arg1, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL0.invokeExact(input0, input1, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger[] call1(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL1.invokeExact(input0, output, error);
                
                check(status, error);
                return from4(output);
            } finally { CLEAR4.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static Result<java.math.BigInteger, java.math.BigInteger> call2(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(72, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL2.invokeExact(input0, output, error);
                
                check(status, error);
                return from5(output);
            } finally { CLEAR5.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call3(Envelope arg0, Envelope arg1) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to1(arg0, scope);
            MemorySegment input1 = to1(arg1, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL3.invokeExact(input0, input1, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static Envelope call4(Envelope arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to1(arg0, scope);
            var output = arena.allocate(64, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL4.invokeExact(input0, output, error);
                
                check(status, error);
                return from1(output);
            } finally { CLEAR1.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static Event call5(Event arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to8(arg0, scope);
            var output = arena.allocate(72, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL5.invokeExact(input0, output, error);
                
                check(status, error);
                return from8(output);
            } finally { CLEAR8.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static Option<Envelope>[] call6(Option<Envelope>[] arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to3(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL6.invokeExact(input0, output, error);
                
                check(status, error);
                return from3(output);
            } finally { CLEAR3.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static AliasPair call7(AliasPair arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to9(arg0, scope);
            var output = arena.allocate(64, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL7.invokeExact(input0, output, error);
                
                check(status, error);
                return from9(output);
            } finally { CLEAR9.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static Event call8(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(72, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL8.invokeExact(input0, output, error);
                
                check(status, error);
                return from8(output);
            } finally { CLEAR8.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static Event call9(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(72, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL9.invokeExact(input0, output, error);
                
                check(status, error);
                return from8(output);
            } finally { CLEAR8.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call10(Event arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to8(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL10.invokeExact(input0, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call11(Event arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to8(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL11.invokeExact(input0, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static Event call12(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(72, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL12.invokeExact(input0, output, error);
                
                check(status, error);
                return from8(output);
            } finally { CLEAR8.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call13(Envelope arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to1(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL13.invokeExact(input0, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static Option<Envelope>[] call14(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL14.invokeExact(input0, output, error);
                
                check(status, error);
                return from3(output);
            } finally { CLEAR3.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call15(AliasPair arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to9(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL15.invokeExact(input0, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger[] call16(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL16.invokeExact(input0, output, error);
                
                check(status, error);
                return from10(output);
            } finally { CLEAR10.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call17(EnvelopePair arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to11(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL17.invokeExact(input0, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger[] call18(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL18.invokeExact(input0, output, error);
                
                check(status, error);
                return from4(output);
            } finally { CLEAR4.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static Option<java.math.BigInteger> call19(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(40, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL19.invokeExact(input0, output, error);
                
                check(status, error);
                return from12(output);
            } finally { CLEAR12.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static AliasPair call20(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(64, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL20.invokeExact(input0, output, error);
                
                check(status, error);
                return from9(output);
            } finally { CLEAR9.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call21(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL21.invokeExact(input0, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static Envelope call22(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(64, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL22.invokeExact(input0, output, error);
                
                check(status, error);
                return from1(output);
            } finally { CLEAR1.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static Pair<java.math.BigInteger, java.math.BigInteger> call23(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(64, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL23.invokeExact(input0, output, error);
                
                check(status, error);
                return from13(output);
            } finally { CLEAR13.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call24(java.math.BigInteger arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to0(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL24.invokeExact(input0, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static java.math.BigInteger call25(Envelope arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to1(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL25.invokeExact(input0, output, error);
                
                check(status, error);
                return from0(output);
            } finally { CLEAR0.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
}
