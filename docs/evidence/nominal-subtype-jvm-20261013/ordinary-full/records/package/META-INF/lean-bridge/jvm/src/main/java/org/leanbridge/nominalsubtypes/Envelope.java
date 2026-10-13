package org.leanbridge.nominalsubtypes;
/**
 * @param payload Contract type: <code>nat</code>.
 * @param digit Contract type: <code>nat</code>.
 */
public record Envelope(java.math.BigInteger payload, java.math.BigInteger digit) {
    @Override public boolean equals(Object candidate) {
        if (this == candidate) return true;
        return candidate instanceof Envelope other
            && java.util.Objects.deepEquals(this.payload, other.payload)
            && java.util.Objects.deepEquals(this.digit, other.digit);
    }
    @Override public int hashCode() {
        return java.util.Arrays.deepHashCode(new Object[] { Envelope.class, this.payload, this.digit });
    }
}
