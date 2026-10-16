package org.leanbridge.nominalprimitivesubtypes;
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
    private static final MethodHandle CALL0 = downcall("nominalprimitivesubtypes_produce", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL1 = downcall("nominalprimitivesubtypes_produce_choices", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL2 = downcall("nominalprimitivesubtypes_produce_event", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL3 = downcall("nominalprimitivesubtypes_produce_group", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL4 = downcall("nominalprimitivesubtypes_produce_pair", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle CALL5 = downcall("nominalprimitivesubtypes_word_bits", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS));
    private static final MethodHandle CLEAR10 = downcall("nominalprimitivesubtypes_nat_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR11 = downcall("nominalprimitivesubtypes_int_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR14 = downcall("nominalprimitivesubtypes_string_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR15 = downcall("nominalprimitivesubtypes_bytes_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR19 = downcall("nominalprimitivesubtypes_raw_packet_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR20 = downcall("nominalprimitivesubtypes_packet_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR21 = downcall("nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR22 = downcall("nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR23 = downcall("nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR24 = downcall("nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR25 = downcall("nominalprimitivesubtypes_event_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR26 = downcall("nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle CLEAR27 = downcall("nominalprimitivesubtypes_packet_pair_clear", FunctionDescriptor.ofVoid(ADDRESS));
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
    private static byte to0(Unit value) {
        Objects.requireNonNull(value); return (byte)0;
    }
    private static Unit from0(byte value) {
        if (value != 0) throw new IllegalStateException("Invalid native Unit"); return Unit.INSTANCE;
    }
    private static byte to1(boolean value) {
        return value ? (byte)1 : (byte)0;
    }
    private static boolean from1(byte value) {
        if (value != 0 && value != 1) throw new IllegalStateException("Invalid native Bool"); return value == 1;
    }
    private static byte to2(int value) {
        if (value < 0 || value > 255) throw new IllegalArgumentException("uint8 is out of range"); return (byte)value;
    }
    private static int from2(byte value) {
        return Byte.toUnsignedInt(value);
    }
    private static short to3(int value) {
        if (value < 0 || value > 65535) throw new IllegalArgumentException("uint16 is out of range"); return (short)value;
    }
    private static int from3(short value) {
        return Short.toUnsignedInt(value);
    }
    private static int to4(long value) {
        if (value < 0 || value > 0xffff_ffffL) throw new IllegalArgumentException("uint32 is out of range"); return (int)value;
    }
    private static long from4(int value) {
        return Integer.toUnsignedLong(value);
    }
    private static long to5(java.math.BigInteger value) {
        Objects.requireNonNull(value); if (value.signum() < 0 || value.bitLength() > 64) throw new IllegalArgumentException("uint64 is out of range"); return value.longValue();
    }
    private static java.math.BigInteger from5(long value) {
        return BigInteger.valueOf(value >>> 1).shiftLeft(1).add(BigInteger.valueOf(value & 1));
    }
    private static byte to6(byte value) {
        return value;
    }
    private static byte from6(byte value) {
        return value;
    }
    private static short to7(short value) {
        return value;
    }
    private static short from7(short value) {
        return value;
    }
    private static int to8(int value) {
        return value;
    }
    private static int from8(int value) {
        return value;
    }
    private static long to9(long value) {
        return value;
    }
    private static long from9(long value) {
        return value;
    }
    private static MemorySegment to10(java.math.BigInteger value, Scope scope) {
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
    private static java.math.BigInteger from10(MemorySegment value) {
        var buffer = checkedData(value, 4, 4);
        long limbs = value.get(JAVA_LONG, 8);
        if (limbs != 0 && buffer.get(JAVA_INT, (limbs - 1) * 4) == 0)
            throw new IllegalStateException("Invalid native integer magnitude");
        
        byte[] bytes = buffer.toArray(JAVA_BYTE);
        for (int left = 0, right = bytes.length - 1; left < right; left++, right--) { byte saved = bytes[left]; bytes[left] = bytes[right]; bytes[right] = saved; }
        var result = new BigInteger(1, bytes);
        return result;
    }
    private static MemorySegment to11(java.math.BigInteger value, Scope scope) {
        Objects.requireNonNull(value);
        
        var magnitude = value.abs();
        long limbs = ((long)magnitude.bitLength() + 31) / 32;
        var data = scope.allocate(Math.max(1, limbs * 4), 4);
        byte[] bytes = magnitude.toByteArray();
        for (int index = 0; index < bytes.length && index < limbs * 4; index++) data.set(JAVA_BYTE, index, bytes[bytes.length - 1 - index]);
        var result = slice(scope, data, limbs, 40);
        result.set(JAVA_BYTE, 32, (byte)(value.signum() < 0 ? 1 : 0));
        return result;
    }
    private static java.math.BigInteger from11(MemorySegment value) {
        var buffer = checkedData(value, 4, 4);
        long limbs = value.get(JAVA_LONG, 8);
        if (limbs != 0 && buffer.get(JAVA_INT, (limbs - 1) * 4) == 0)
            throw new IllegalStateException("Invalid native integer magnitude");
        byte sign = value.get(JAVA_BYTE, 32);
        if ((sign != 0 && sign != 1) || (sign != 0 && limbs == 0))
            throw new IllegalStateException("Invalid native integer sign");
        byte[] bytes = buffer.toArray(JAVA_BYTE);
        for (int left = 0, right = bytes.length - 1; left < right; left++, right--) { byte saved = bytes[left]; bytes[left] = bytes[right]; bytes[right] = saved; }
        var result = new BigInteger(1, bytes);
        return sign == 1 ? result.negate() : result;
    }
    private static float to12(float value) {
        return value;
    }
    private static float from12(float value) {
        return value;
    }
    private static double to13(double value) {
        return value;
    }
    private static double from13(double value) {
        return value;
    }
    private static MemorySegment to14(String value, Scope scope) {
        Objects.requireNonNull(value);
        int length = utf8Length(value);
        var data = scope.allocate(Math.max(1, length), 1);
        try {
            var encoder = StandardCharsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT);
            var buffer = data.asByteBuffer();
            var encoded = encoder.encode(CharBuffer.wrap(value), buffer, true);
            if (!encoded.isUnderflow()) encoded.throwException();
            var flushed = encoder.flush(buffer);
            if (!flushed.isUnderflow()) flushed.throwException();
        } catch (CharacterCodingException error) { throw new IllegalArgumentException("Invalid UTF-16", error); }
        return slice(scope, data, length, 32);
    }
    private static String from14(MemorySegment value) {
        try { return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).decode(data(value).asByteBuffer()).toString(); } catch (CharacterCodingException error) { throw new IllegalArgumentException("Invalid native UTF-8", error); }
    }
    private static MemorySegment to15(byte[] value, Scope scope) {
        Objects.requireNonNull(value);
        var data = scope.allocate(Math.max(1, value.length), 1);
        MemorySegment.copy(MemorySegment.ofArray(value), 0, data, 0, value.length);
        return slice(scope, data, value.length, 32);
    }
    private static byte[] from15(MemorySegment value) {
        return data(value).toArray(JAVA_BYTE);
    }
    private static int to16(int value) {
        if (value < 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) throw new IllegalArgumentException("Char requires a Unicode scalar code point"); return value;
    }
    private static int from16(int value) {
        if (value < 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) throw new IllegalArgumentException("Invalid native Unicode scalar"); return value;
    }
    private static long to17(java.math.BigInteger value) {
        Objects.requireNonNull(value); if (value.signum() < 0 || value.bitLength() > 64) throw new IllegalArgumentException("uint64 is out of range"); return value.longValue();
    }
    private static java.math.BigInteger from17(long value) {
        return BigInteger.valueOf(value >>> 1).shiftLeft(1).add(BigInteger.valueOf(value & 1));
    }
    private static long to18(long value) {
        return value;
    }
    private static long from18(long value) {
        return value;
    }
    private static MemorySegment to19(org.leanbridge.nominalprimitivesubtypes.kotlin.RawPacket value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(248, 8);
        result.set(JAVA_BYTE, 0, to0(value.unitValue()));
        result.set(JAVA_BYTE, 1, to1(value.boolValue()));
        result.set(JAVA_BYTE, 2, to2(value.uint8Value()));
        result.set(JAVA_SHORT, 4, to3(value.uint16Value()));
        result.set(JAVA_INT, 8, to4(value.uint32Value()));
        result.set(JAVA_LONG, 16, to5(value.uint64Value()));
        result.set(JAVA_BYTE, 24, to6(value.int8Value()));
        result.set(JAVA_SHORT, 26, to7(value.int16Value()));
        result.set(JAVA_INT, 28, to8(value.int32Value()));
        result.set(JAVA_LONG, 32, to9(value.int64Value()));
        MemorySegment.copy(to10(value.natValue(), scope), 0, result, 40, 32);
        MemorySegment.copy(to11(value.intValue(), scope), 0, result, 72, 40);
        result.set(JAVA_FLOAT, 112, to12(value.float32Value()));
        result.set(JAVA_DOUBLE, 120, to13(value.float64Value()));
        MemorySegment.copy(to14(value.textValue(), scope), 0, result, 128, 32);
        MemorySegment.copy(to15(value.bytesValue(), scope), 0, result, 160, 32);
        result.set(JAVA_INT, 192, to16(value.charValue()));
        result.set(JAVA_LONG, 200, to17(value.usizeValue()));
        result.set(JAVA_LONG, 208, to18(value.isizeValue()));
        MemorySegment.copy(to10(value.digit(), scope), 0, result, 216, 32);
        return result;
    }
    private static org.leanbridge.nominalprimitivesubtypes.kotlin.RawPacket from19(MemorySegment value) {
        return new org.leanbridge.nominalprimitivesubtypes.kotlin.RawPacket(from0(value.get(JAVA_BYTE, 0)), from1(value.get(JAVA_BYTE, 1)), from2(value.get(JAVA_BYTE, 2)), from3(value.get(JAVA_SHORT, 4)), from4(value.get(JAVA_INT, 8)), from5(value.get(JAVA_LONG, 16)), from6(value.get(JAVA_BYTE, 24)), from7(value.get(JAVA_SHORT, 26)), from8(value.get(JAVA_INT, 28)), from9(value.get(JAVA_LONG, 32)), from10(value.asSlice(40, 32)), from11(value.asSlice(72, 40)), from12(value.get(JAVA_FLOAT, 112)), from13(value.get(JAVA_DOUBLE, 120)), from14(value.asSlice(128, 32)), from15(value.asSlice(160, 32)), from16(value.get(JAVA_INT, 192)), from17(value.get(JAVA_LONG, 200)), from18(value.get(JAVA_LONG, 208)), from10(value.asSlice(216, 32)));
    }
    private static MemorySegment to20(org.leanbridge.nominalprimitivesubtypes.kotlin.Packet value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(248, 8);
        result.set(JAVA_BYTE, 0, to0(value.unitValue()));
        result.set(JAVA_BYTE, 1, to1(value.boolValue()));
        result.set(JAVA_BYTE, 2, to2(value.uint8Value()));
        result.set(JAVA_SHORT, 4, to3(value.uint16Value()));
        result.set(JAVA_INT, 8, to4(value.uint32Value()));
        result.set(JAVA_LONG, 16, to5(value.uint64Value()));
        result.set(JAVA_BYTE, 24, to6(value.int8Value()));
        result.set(JAVA_SHORT, 26, to7(value.int16Value()));
        result.set(JAVA_INT, 28, to8(value.int32Value()));
        result.set(JAVA_LONG, 32, to9(value.int64Value()));
        MemorySegment.copy(to10(value.natValue(), scope), 0, result, 40, 32);
        MemorySegment.copy(to11(value.intValue(), scope), 0, result, 72, 40);
        result.set(JAVA_FLOAT, 112, to12(value.float32Value()));
        result.set(JAVA_DOUBLE, 120, to13(value.float64Value()));
        MemorySegment.copy(to14(value.textValue(), scope), 0, result, 128, 32);
        MemorySegment.copy(to15(value.bytesValue(), scope), 0, result, 160, 32);
        result.set(JAVA_INT, 192, to16(value.charValue()));
        result.set(JAVA_LONG, 200, to17(value.usizeValue()));
        result.set(JAVA_LONG, 208, to18(value.isizeValue()));
        MemorySegment.copy(to10(value.digit(), scope), 0, result, 216, 32);
        return result;
    }
    private static org.leanbridge.nominalprimitivesubtypes.kotlin.Packet from20(MemorySegment value) {
        return new org.leanbridge.nominalprimitivesubtypes.kotlin.Packet(from0(value.get(JAVA_BYTE, 0)), from1(value.get(JAVA_BYTE, 1)), from2(value.get(JAVA_BYTE, 2)), from3(value.get(JAVA_SHORT, 4)), from4(value.get(JAVA_INT, 8)), from5(value.get(JAVA_LONG, 16)), from6(value.get(JAVA_BYTE, 24)), from7(value.get(JAVA_SHORT, 26)), from8(value.get(JAVA_INT, 28)), from9(value.get(JAVA_LONG, 32)), from10(value.asSlice(40, 32)), from11(value.asSlice(72, 40)), from12(value.get(JAVA_FLOAT, 112)), from13(value.get(JAVA_DOUBLE, 120)), from14(value.asSlice(128, 32)), from15(value.asSlice(160, 32)), from16(value.get(JAVA_INT, 192)), from17(value.get(JAVA_LONG, 200)), from18(value.get(JAVA_LONG, 208)), from10(value.asSlice(216, 32)));
    }
    private static MemorySegment to21(org.leanbridge.nominalprimitivesubtypes.kotlin.Option<org.leanbridge.nominalprimitivesubtypes.kotlin.Packet> value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(256, 8);
        if (value.isSome()) { result.set(JAVA_BYTE, 0, (byte)1); MemorySegment.copy(to20(value.value(), scope), 0, result, 8, 248); }
        return result;
    }
    private static org.leanbridge.nominalprimitivesubtypes.kotlin.Option<org.leanbridge.nominalprimitivesubtypes.kotlin.Packet> from21(MemorySegment value) {
        return switch (value.get(JAVA_BYTE, 0)) { case 0 -> org.leanbridge.nominalprimitivesubtypes.kotlin.Option.none(); case 1 -> org.leanbridge.nominalprimitivesubtypes.kotlin.Option.some(from20(value.asSlice(8, 248))); default -> throw new IllegalStateException("Invalid native Option flag"); };
    }
    private static MemorySegment to22(org.leanbridge.nominalprimitivesubtypes.kotlin.Result<org.leanbridge.nominalprimitivesubtypes.kotlin.Packet, org.leanbridge.nominalprimitivesubtypes.kotlin.Packet> value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(504, 8);
        if (value.isOk()) { result.set(JAVA_BYTE, 0, (byte)1); MemorySegment.copy(to20(value.value(), scope), 0, result, 8, 248); }
        else { MemorySegment.copy(to20(value.error(), scope), 0, result, 256, 248); }
        return result;
    }
    private static org.leanbridge.nominalprimitivesubtypes.kotlin.Result<org.leanbridge.nominalprimitivesubtypes.kotlin.Packet, org.leanbridge.nominalprimitivesubtypes.kotlin.Packet> from22(MemorySegment value) {
        return switch (value.get(JAVA_BYTE, 0)) { case 1 -> org.leanbridge.nominalprimitivesubtypes.kotlin.Result.ok(from20(value.asSlice(8, 248))); case 0 -> org.leanbridge.nominalprimitivesubtypes.kotlin.Result.err(from20(value.asSlice(256, 248))); default -> throw new IllegalStateException("Invalid native Except flag"); };
    }
    private static MemorySegment to23(org.leanbridge.nominalprimitivesubtypes.kotlin.Option<org.leanbridge.nominalprimitivesubtypes.kotlin.Result<org.leanbridge.nominalprimitivesubtypes.kotlin.Packet, org.leanbridge.nominalprimitivesubtypes.kotlin.Packet>> value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(512, 8);
        if (value.isSome()) { result.set(JAVA_BYTE, 0, (byte)1); MemorySegment.copy(to22(value.value(), scope), 0, result, 8, 504); }
        return result;
    }
    private static org.leanbridge.nominalprimitivesubtypes.kotlin.Option<org.leanbridge.nominalprimitivesubtypes.kotlin.Result<org.leanbridge.nominalprimitivesubtypes.kotlin.Packet, org.leanbridge.nominalprimitivesubtypes.kotlin.Packet>> from23(MemorySegment value) {
        return switch (value.get(JAVA_BYTE, 0)) { case 0 -> org.leanbridge.nominalprimitivesubtypes.kotlin.Option.none(); case 1 -> org.leanbridge.nominalprimitivesubtypes.kotlin.Option.some(from22(value.asSlice(8, 504))); default -> throw new IllegalStateException("Invalid native Option flag"); };
    }
    private static MemorySegment to24(org.leanbridge.nominalprimitivesubtypes.kotlin.Option<org.leanbridge.nominalprimitivesubtypes.kotlin.Result<org.leanbridge.nominalprimitivesubtypes.kotlin.Packet, org.leanbridge.nominalprimitivesubtypes.kotlin.Packet>>[] value, Scope scope) {
        Objects.requireNonNull(value);
        scope.charge((long)value.length * Math.max(512, 8));
        var data = scope.arena.allocate(Math.max(1, (long)value.length * 512), 8);
        for (int index = 0; index < value.length; index++) { MemorySegment.copy(to23(value[index], scope), 0, data, (long)index * 512, 512); }
        return slice(scope, data, value.length, 32);
    }
    private static org.leanbridge.nominalprimitivesubtypes.kotlin.Option<org.leanbridge.nominalprimitivesubtypes.kotlin.Result<org.leanbridge.nominalprimitivesubtypes.kotlin.Packet, org.leanbridge.nominalprimitivesubtypes.kotlin.Packet>>[] from24(MemorySegment value) {
        long length = value.get(JAVA_LONG, 8);
        if (length < 0 || length > (16 * 1024 * 1024) / Math.max(512, 8))
            throw new IllegalArgumentException("Lean Bridge native sequence exceeds the 16 MiB copy limit");
        var pointer = value.get(ADDRESS, 0);
        if (length != 0 && (pointer.address() == 0 || pointer.address() % 8 != 0))
            throw new IllegalStateException("Invalid native sequence buffer");
        int count = (int)length;
        @SuppressWarnings("unchecked")
        var result = (org.leanbridge.nominalprimitivesubtypes.kotlin.Option<org.leanbridge.nominalprimitivesubtypes.kotlin.Result<org.leanbridge.nominalprimitivesubtypes.kotlin.Packet, org.leanbridge.nominalprimitivesubtypes.kotlin.Packet>>[])java.lang.reflect.Array.newInstance(org.leanbridge.nominalprimitivesubtypes.kotlin.Option.class, count);
        var data = pointer.reinterpret((long)count * 512);
        for (int index = 0; index < count; index++) result[index] = from23(data.asSlice((long)index * 512, 512));
        return result;
    }
    private static MemorySegment to25(org.leanbridge.nominalprimitivesubtypes.kotlin.Event value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(256, 8);
        switch (value) {
            case org.leanbridge.nominalprimitivesubtypes.kotlin.EventEmpty branch -> {
                result.set(JAVA_INT, 0, 0);

            }
            case org.leanbridge.nominalprimitivesubtypes.kotlin.EventBox branch -> {
                result.set(JAVA_INT, 0, 1);
                MemorySegment.copy(to20(branch.value(), scope), 0, result, 8, 248);
            }
            case org.leanbridge.nominalprimitivesubtypes.kotlin.EventChoices branch -> {
                result.set(JAVA_INT, 0, 2);
                MemorySegment.copy(to24(branch.values(), scope), 0, result, 8, 32);
            }
        }
        return result;
    }
    private static org.leanbridge.nominalprimitivesubtypes.kotlin.Event from25(MemorySegment value) {
        return switch (value.get(JAVA_INT, 0)) {
            case 0 -> new org.leanbridge.nominalprimitivesubtypes.kotlin.EventEmpty();
            case 1 -> new org.leanbridge.nominalprimitivesubtypes.kotlin.EventBox(from20(value.asSlice(8, 248)));
            case 2 -> new org.leanbridge.nominalprimitivesubtypes.kotlin.EventChoices(from24(value.asSlice(8, 32)));
            default -> throw new IllegalStateException("Invalid native org.leanbridge.nominalprimitivesubtypes.kotlin.Event constructor");
        };
    }
    private static MemorySegment to26(org.leanbridge.nominalprimitivesubtypes.kotlin.Option<org.leanbridge.nominalprimitivesubtypes.kotlin.Packet>[] value, Scope scope) {
        Objects.requireNonNull(value);
        scope.charge((long)value.length * Math.max(256, 8));
        var data = scope.arena.allocate(Math.max(1, (long)value.length * 256), 8);
        for (int index = 0; index < value.length; index++) { MemorySegment.copy(to21(value[index], scope), 0, data, (long)index * 256, 256); }
        return slice(scope, data, value.length, 32);
    }
    private static org.leanbridge.nominalprimitivesubtypes.kotlin.Option<org.leanbridge.nominalprimitivesubtypes.kotlin.Packet>[] from26(MemorySegment value) {
        long length = value.get(JAVA_LONG, 8);
        if (length < 0 || length > (16 * 1024 * 1024) / Math.max(256, 8))
            throw new IllegalArgumentException("Lean Bridge native sequence exceeds the 16 MiB copy limit");
        var pointer = value.get(ADDRESS, 0);
        if (length != 0 && (pointer.address() == 0 || pointer.address() % 8 != 0))
            throw new IllegalStateException("Invalid native sequence buffer");
        int count = (int)length;
        @SuppressWarnings("unchecked")
        var result = (org.leanbridge.nominalprimitivesubtypes.kotlin.Option<org.leanbridge.nominalprimitivesubtypes.kotlin.Packet>[])java.lang.reflect.Array.newInstance(org.leanbridge.nominalprimitivesubtypes.kotlin.Option.class, count);
        var data = pointer.reinterpret((long)count * 256);
        for (int index = 0; index < count; index++) result[index] = from21(data.asSlice((long)index * 256, 256));
        return result;
    }
    private static MemorySegment to27(org.leanbridge.nominalprimitivesubtypes.kotlin.PacketPair value, Scope scope) {
        Objects.requireNonNull(value);
        var result = scope.allocate(64, 8);
        MemorySegment.copy(to26(value.left(), scope), 0, result, 0, 32);
        MemorySegment.copy(to26(value.right(), scope), 0, result, 32, 32);
        return result;
    }
    private static org.leanbridge.nominalprimitivesubtypes.kotlin.PacketPair from27(MemorySegment value) {
        return new org.leanbridge.nominalprimitivesubtypes.kotlin.PacketPair(from26(value.asSlice(0, 32)), from26(value.asSlice(32, 32)));
    }


    static org.leanbridge.nominalprimitivesubtypes.kotlin.Option<org.leanbridge.nominalprimitivesubtypes.kotlin.Packet> call0(org.leanbridge.nominalprimitivesubtypes.kotlin.RawPacket arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to19(arg0, scope);
            var output = arena.allocate(256, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL0.invokeExact(input0, output, error);
                
                check(status, error);
                return from21(output);
            } finally { CLEAR21.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static org.leanbridge.nominalprimitivesubtypes.kotlin.Event call1(org.leanbridge.nominalprimitivesubtypes.kotlin.RawPacket arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to19(arg0, scope);
            var output = arena.allocate(256, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL1.invokeExact(input0, output, error);
                
                check(status, error);
                return from25(output);
            } finally { CLEAR25.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static org.leanbridge.nominalprimitivesubtypes.kotlin.Event call2(org.leanbridge.nominalprimitivesubtypes.kotlin.RawPacket arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to19(arg0, scope);
            var output = arena.allocate(256, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL2.invokeExact(input0, output, error);
                
                check(status, error);
                return from25(output);
            } finally { CLEAR25.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static org.leanbridge.nominalprimitivesubtypes.kotlin.Option<org.leanbridge.nominalprimitivesubtypes.kotlin.Packet>[] call3(org.leanbridge.nominalprimitivesubtypes.kotlin.RawPacket arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to19(arg0, scope);
            var output = arena.allocate(32, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL3.invokeExact(input0, output, error);
                
                check(status, error);
                return from26(output);
            } finally { CLEAR26.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static org.leanbridge.nominalprimitivesubtypes.kotlin.PacketPair call4(org.leanbridge.nominalprimitivesubtypes.kotlin.RawPacket arg0) {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            var scope = new Scope(arena);
            
            MemorySegment input0 = to19(arg0, scope);
            var output = arena.allocate(64, 8);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL4.invokeExact(input0, output, error);
                
                check(status, error);
                return from27(output);
            } finally { CLEAR27.invokeExact(output); }
        } catch (Throwable error) { throw propagate(error); }
        
    }
    static long call5() {
        NativeAssets.ensureProcess();
        
        
        try (Arena arena = Arena.ofConfined()) {
            
            

            var output = arena.allocate(4, 4);
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL5.invokeExact(output, error);
                
                check(status, error);
                return from4(output.get(JAVA_INT, 0));
            } finally {  }
        } catch (Throwable error) { throw propagate(error); }
        
    }
}
