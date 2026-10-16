package org.leanbridge.nominalprimitivesubtypes;
/**
 * @param unitValue Contract type: <code>unit</code>.
 * @param boolValue Contract type: <code>bool</code>.
 * @param uint8Value Contract type: <code>uint8</code>.
 * @param uint16Value Contract type: <code>uint16</code>.
 * @param uint32Value Contract type: <code>uint32</code>.
 * @param uint64Value Contract type: <code>uint64</code>.
 * @param int8Value Contract type: <code>int8</code>.
 * @param int16Value Contract type: <code>int16</code>.
 * @param int32Value Contract type: <code>int32</code>.
 * @param int64Value Contract type: <code>int64</code>.
 * @param natValue Contract type: <code>nat</code>.
 * @param intValue Contract type: <code>int</code>.
 * @param float32Value Contract type: <code>float32</code>.
 * @param float64Value Contract type: <code>float64</code>.
 * @param textValue Contract type: <code>string</code>.
 * @param bytesValue Contract type: <code>bytes</code>.
 * @param charValue Contract type: <code>char</code>.
 * @param usizeValue Contract type: <code>usize</code>.
 * @param isizeValue Contract type: <code>isize</code>.
 * @param digit Contract type: <code>nat</code>.
 */
public record RawPacket(Unit unitValue, boolean boolValue, int uint8Value, int uint16Value, long uint32Value, java.math.BigInteger uint64Value, byte int8Value, short int16Value, int int32Value, long int64Value, java.math.BigInteger natValue, java.math.BigInteger intValue, float float32Value, double float64Value, String textValue, byte[] bytesValue, int charValue, java.math.BigInteger usizeValue, long isizeValue, java.math.BigInteger digit) {
    @Override public boolean equals(Object candidate) {
        if (this == candidate) return true;
        return candidate instanceof RawPacket other
            && java.util.Objects.deepEquals(this.unitValue, other.unitValue)
            && java.util.Objects.deepEquals(this.boolValue, other.boolValue)
            && java.util.Objects.deepEquals(this.uint8Value, other.uint8Value)
            && java.util.Objects.deepEquals(this.uint16Value, other.uint16Value)
            && java.util.Objects.deepEquals(this.uint32Value, other.uint32Value)
            && java.util.Objects.deepEquals(this.uint64Value, other.uint64Value)
            && java.util.Objects.deepEquals(this.int8Value, other.int8Value)
            && java.util.Objects.deepEquals(this.int16Value, other.int16Value)
            && java.util.Objects.deepEquals(this.int32Value, other.int32Value)
            && java.util.Objects.deepEquals(this.int64Value, other.int64Value)
            && java.util.Objects.deepEquals(this.natValue, other.natValue)
            && java.util.Objects.deepEquals(this.intValue, other.intValue)
            && java.util.Objects.deepEquals(this.float32Value, other.float32Value)
            && java.util.Objects.deepEquals(this.float64Value, other.float64Value)
            && java.util.Objects.deepEquals(this.textValue, other.textValue)
            && java.util.Objects.deepEquals(this.bytesValue, other.bytesValue)
            && java.util.Objects.deepEquals(this.charValue, other.charValue)
            && java.util.Objects.deepEquals(this.usizeValue, other.usizeValue)
            && java.util.Objects.deepEquals(this.isizeValue, other.isizeValue)
            && java.util.Objects.deepEquals(this.digit, other.digit);
    }
    @Override public int hashCode() {
        return java.util.Arrays.deepHashCode(new Object[] { RawPacket.class, this.unitValue, this.boolValue, this.uint8Value, this.uint16Value, this.uint32Value, this.uint64Value, this.int8Value, this.int16Value, this.int32Value, this.int64Value, this.natValue, this.intValue, this.float32Value, this.float64Value, this.textValue, this.bytesValue, this.charValue, this.usizeValue, this.isizeValue, this.digit });
    }
}
