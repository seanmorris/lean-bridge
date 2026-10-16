package org.leanbridge.nestedcheckedrecords;
public record Packet(java.math.BigInteger digit, java.math.BigInteger word) {
    @Override public boolean equals(Object candidate) {
        if (this == candidate) return true;
        return candidate instanceof Packet other
            && java.util.Objects.deepEquals(this.digit, other.digit)
            && java.util.Objects.deepEquals(this.word, other.word);
    }
    @Override public int hashCode() {
        return java.util.Arrays.deepHashCode(new Object[] { Packet.class, this.digit, this.word });
    }
}
