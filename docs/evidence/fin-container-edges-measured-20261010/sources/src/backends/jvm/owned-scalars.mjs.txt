/**
 * Exact Java primitives for the owned C ABI, including read-only GMP views.
 *
 * @file
 */

export const ownedJvmScalarNames = Object.freeze(["unit", "bool", "char", "uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64", "usize", "isize", "float32", "float64", "string", "bytes", "nat", "int"]);

/** Temporary GMP limbs belong to the input scope; no process-wide GMP allocator is used. */
export const ownedJvmScalars = `final class _OwnedScalars {
    private _OwnedScalars() { }
    private static void scalar(int value, boolean nativeValue) {
        if (value < 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) {
            if (nativeValue) throw new _OwnedConvert.InvalidNative("Invalid native Unicode scalar");
            throw new IllegalArgumentException("Char requires a Unicode scalar");
        }
    }
    private static int utf8Length(String text) {
        if (text.length() > 16 * 1024 * 1024) throw new _OwnedConvert.Limit("16 MiB ownership string limit exceeded");
        long length = 0;
        for (int index = 0; index < text.length(); index++) {
            char value = text.charAt(index);
            if (Character.isHighSurrogate(value)) {
                if (++index == text.length() || !Character.isLowSurrogate(text.charAt(index))) throw new IllegalArgumentException("Invalid UTF-16");
                length += 4;
            } else if (Character.isLowSurrogate(value)) throw new IllegalArgumentException("Invalid UTF-16");
            else length += value < 128 ? 1 : value < 2048 ? 2 : 3;
        }
        if (length > 16 * 1024 * 1024) throw new _OwnedConvert.Limit("16 MiB ownership string limit exceeded");
        return (int)length;
    }
    private static void utf8Write(String text, java.lang.foreign.MemorySegment target) {
        long offset = 0;
        for (int index = 0; index < text.length(); index++) {
            int value = text.charAt(index);
            if (Character.isHighSurrogate((char)value)) value = Character.toCodePoint((char)value, text.charAt(++index));
            if (value < 128) target.set(java.lang.foreign.ValueLayout.JAVA_BYTE, offset++, (byte)value);
            else {
                int width = value < 2048 ? 2 : value < 65536 ? 3 : 4;
                target.set(java.lang.foreign.ValueLayout.JAVA_BYTE, offset++, (byte)((width == 2 ? 0xc0 : width == 3 ? 0xe0 : 0xf0) | (value >> (6 * (width - 1)))));
                for (int part = width - 2; part >= 0; part--) target.set(java.lang.foreign.ValueLayout.JAVA_BYTE, offset++, (byte)(0x80 | ((value >> (6 * part)) & 63)));
            }
        }
    }
    private static int utf8Read(java.lang.foreign.MemorySegment data, int length, char[] target) {
        int characters = 0;
        for (int index = 0; index < length;) {
            int first = Byte.toUnsignedInt(data.get(java.lang.foreign.ValueLayout.JAVA_BYTE, index++));
            int value, width;
            if (first < 128) { value = first; width = 1; }
            else if (first >= 0xc2 && first <= 0xdf) { value = first & 31; width = 2; }
            else if (first >= 0xe0 && first <= 0xef) { value = first & 15; width = 3; }
            else if (first >= 0xf0 && first <= 0xf4) { value = first & 7; width = 4; }
            else throw new _OwnedConvert.InvalidNative("Invalid native UTF-8");
            if (width - 1 > length - index) throw new _OwnedConvert.InvalidNative("Truncated native UTF-8");
            for (int part = 1; part < width; part++) {
                int next = Byte.toUnsignedInt(data.get(java.lang.foreign.ValueLayout.JAVA_BYTE, index++));
                if ((next & 0xc0) != 0x80) throw new _OwnedConvert.InvalidNative("Invalid native UTF-8 continuation");
                value = (value << 6) | (next & 63);
            }
            if ((width == 2 && value < 128) || (width == 3 && value < 2048) || (width == 4 && value < 65536))
                throw new _OwnedConvert.InvalidNative("Noncanonical native UTF-8");
            scalar(value, true);
            if (value < 65536) { if (target != null) target[characters] = (char)value; characters++; }
            else {
                if (target != null) { target[characters] = Character.highSurrogate(value); target[characters + 1] = Character.lowSurrogate(value); }
                characters += 2;
            }
        }
        return characters;
    }
    private static void span(java.lang.foreign.MemorySegment raw, java.lang.foreign.MemorySegment data, long length) {
        raw.set(java.lang.foreign.ValueLayout.ADDRESS, 0, data); raw.set(java.lang.foreign.ValueLayout.JAVA_LONG, 8, length);
    }
    static void write(int kind, Object value, java.lang.foreign.MemorySegment raw, _OwnedConvert.Scope scope) {
        switch (kind) {
            case 0: if (!scope.checkOnly) raw.set(java.lang.foreign.ValueLayout.JAVA_BYTE, 0, (byte)0); return;
            case 1: if (!scope.checkOnly) raw.set(java.lang.foreign.ValueLayout.JAVA_BYTE, 0, (byte)((Boolean)value ? 1 : 0)); return;
            case 2: scalar((Integer)value, false); if (!scope.checkOnly) raw.set(java.lang.foreign.ValueLayout.JAVA_INT, 0, (Integer)value); return;
            case 3: case 4: {
                int number = (Integer)value;
                if (number < 0 || number > (kind == 3 ? 255 : 65535)) throw new IllegalArgumentException("Unsigned value is out of range");
                if (!scope.checkOnly) {
                    if (kind == 3) raw.set(java.lang.foreign.ValueLayout.JAVA_BYTE, 0, (byte)number);
                    else raw.set(java.lang.foreign.ValueLayout.JAVA_SHORT, 0, (short)number);
                }
                return;
            }
            case 5: {
                long number = (Long)value;
                if (number < 0 || number > 0xffff_ffffL) throw new IllegalArgumentException("UInt32 is out of range");
                if (!scope.checkOnly) raw.set(java.lang.foreign.ValueLayout.JAVA_INT, 0, (int)number); return;
            }
            case 6: case 11: {
                var integer = (java.math.BigInteger)value;
                if (integer.signum() < 0 || integer.bitLength() > 64) throw new IllegalArgumentException("Unsigned word is out of range");
                if (!scope.checkOnly) raw.set(java.lang.foreign.ValueLayout.JAVA_LONG, 0, integer.longValue()); return;
            }
            case 7: if (!scope.checkOnly) raw.set(java.lang.foreign.ValueLayout.JAVA_BYTE, 0, (Byte)value); return;
            case 8: if (!scope.checkOnly) raw.set(java.lang.foreign.ValueLayout.JAVA_SHORT, 0, (Short)value); return;
            case 9: if (!scope.checkOnly) raw.set(java.lang.foreign.ValueLayout.JAVA_INT, 0, (Integer)value); return;
            case 10: case 12: if (!scope.checkOnly) raw.set(java.lang.foreign.ValueLayout.JAVA_LONG, 0, (Long)value); return;
            case 13: if (!scope.checkOnly) raw.set(java.lang.foreign.ValueLayout.JAVA_FLOAT, 0, (Float)value); return;
            case 14: if (!scope.checkOnly) raw.set(java.lang.foreign.ValueLayout.JAVA_DOUBLE, 0, (Double)value); return;
            case 15: {
                String text = (String)value; int length = utf8Length(text); scope.nativeBytes(length, 1);
                var data = scope.allocate(length, 1);
                if (!scope.checkOnly) { utf8Write(text, data); span(raw, data, length); } return;
            }
            case 16: {
                byte[] bytes = (byte[])value; scope.nativeBytes(bytes.length, 1); var data = scope.allocate(bytes.length, 1);
                if (!scope.checkOnly) { java.lang.foreign.MemorySegment.copy(bytes, 0, data, java.lang.foreign.ValueLayout.JAVA_BYTE, 0, bytes.length); span(raw, data, bytes.length); } return;
            }
            case 17: case 18: {
                var integer = (java.math.BigInteger)value;
                if (kind == 17 && integer.signum() < 0) throw new IllegalArgumentException("Nat cannot be negative");
                var magnitude = integer.abs(); long limbs = ((long)magnitude.bitLength() + 63) / 64;
                scope.nativeBytes(16, 1); scope.nativeBytes(limbs, 8);
                var mpz = scope.allocate(16, 8); var data = scope.allocate(limbs * 8, 8);
                scope.storage(limbs * 8 + 1, 1);
                if (!scope.checkOnly) {
                    _OwnedConvert.checkpoint(); byte[] bytes = magnitude.toByteArray();
                    for (int index = 0; index < bytes.length && index < limbs * 8; index++)
                        data.set(java.lang.foreign.ValueLayout.JAVA_BYTE, index, bytes[bytes.length - 1 - index]);
                    mpz.set(java.lang.foreign.ValueLayout.JAVA_INT, 0, (int)limbs);
                    mpz.set(java.lang.foreign.ValueLayout.JAVA_INT, 4, (int)(integer.signum() < 0 ? -limbs : limbs));
                    mpz.set(java.lang.foreign.ValueLayout.ADDRESS, 8, data);
                    raw.set(java.lang.foreign.ValueLayout.ADDRESS, 0, mpz);
                }
                return;
            }
            default: throw new IllegalStateException("Unknown ownership scalar");
        }
    }
    static Object read(int kind, java.lang.foreign.MemorySegment raw, _OwnedConvert.Scope scope) {
        switch (kind) {
            case 0: if (raw.get(java.lang.foreign.ValueLayout.JAVA_BYTE, 0) != 0) throw new _OwnedConvert.InvalidNative("Invalid native Unit"); return Unit.INSTANCE;
            case 1: {
                byte value = raw.get(java.lang.foreign.ValueLayout.JAVA_BYTE, 0);
                if (value != 0 && value != 1) throw new _OwnedConvert.InvalidNative("Invalid native Bool"); return value == 1;
            }
            case 2: { int value = raw.get(java.lang.foreign.ValueLayout.JAVA_INT, 0); scalar(value, true); return value; }
            case 3: return Byte.toUnsignedInt(raw.get(java.lang.foreign.ValueLayout.JAVA_BYTE, 0));
            case 4: return Short.toUnsignedInt(raw.get(java.lang.foreign.ValueLayout.JAVA_SHORT, 0));
            case 5: return Integer.toUnsignedLong(raw.get(java.lang.foreign.ValueLayout.JAVA_INT, 0));
            case 6: case 11: {
                long value = raw.get(java.lang.foreign.ValueLayout.JAVA_LONG, 0); scope.storage(128, 1); _OwnedConvert.checkpoint();
                return java.math.BigInteger.valueOf(value >>> 1).shiftLeft(1).add(java.math.BigInteger.valueOf(value & 1));
            }
            case 7: return raw.get(java.lang.foreign.ValueLayout.JAVA_BYTE, 0);
            case 8: return raw.get(java.lang.foreign.ValueLayout.JAVA_SHORT, 0);
            case 9: return raw.get(java.lang.foreign.ValueLayout.JAVA_INT, 0);
            case 10: case 12: return raw.get(java.lang.foreign.ValueLayout.JAVA_LONG, 0);
            case 13: return raw.get(java.lang.foreign.ValueLayout.JAVA_FLOAT, 0);
            case 14: return raw.get(java.lang.foreign.ValueLayout.JAVA_DOUBLE, 0);
            case 15: case 16: {
                long length = raw.get(java.lang.foreign.ValueLayout.JAVA_LONG, 8); scope.nativeBytes(length, 1);
                var data = _OwnedConvert.checked(raw.get(java.lang.foreign.ValueLayout.ADDRESS, 0), length, 1, 1);
                if (kind == 16) { scope.storage(length + 32, 1); _OwnedConvert.checkpoint(); return data.toArray(java.lang.foreign.ValueLayout.JAVA_BYTE); }
                int count = utf8Read(data, (int)length, null); scope.storage(64L + count * 4L, 1); _OwnedConvert.checkpoint();
                char[] characters = new char[count]; utf8Read(data, (int)length, characters); _OwnedConvert.checkpoint(); return new String(characters);
            }
            case 17: case 18: {
                scope.nativeBytes(16, 1);
                var mpz = _OwnedConvert.checked(raw.get(java.lang.foreign.ValueLayout.ADDRESS, 0), 1, 16, 8);
                int allocated = mpz.get(java.lang.foreign.ValueLayout.JAVA_INT, 0);
                int length = mpz.get(java.lang.foreign.ValueLayout.JAVA_INT, 4);
                if (allocated < 0 || length == Integer.MIN_VALUE || (kind == 17 && length < 0))
                    throw new _OwnedConvert.InvalidNative("Invalid GMP integer size or sign");
                int limbs = Math.abs(length);
                if (limbs > allocated) throw new _OwnedConvert.InvalidNative("GMP integer exceeds allocation");
                scope.nativeBytes(limbs, 8); scope.storage(limbs, 16); scope.storage(128, 1);
                var data = _OwnedConvert.checked(mpz.get(java.lang.foreign.ValueLayout.ADDRESS, 8), limbs, 8, 8);
                if (limbs != 0 && data.get(java.lang.foreign.ValueLayout.JAVA_LONG, ((long)limbs - 1) * 8) == 0)
                    throw new _OwnedConvert.InvalidNative("Noncanonical GMP magnitude");
                _OwnedConvert.checkpoint(); byte[] bytes = new byte[limbs * 8];
                for (int index = 0; index < bytes.length; index++) bytes[bytes.length - 1 - index] = data.get(java.lang.foreign.ValueLayout.JAVA_BYTE, index);
                _OwnedConvert.checkpoint(); return new java.math.BigInteger(length < 0 ? -1 : 1, bytes);
            }
            default: throw new IllegalStateException("Unknown ownership scalar");
        }
    }
}
`;
