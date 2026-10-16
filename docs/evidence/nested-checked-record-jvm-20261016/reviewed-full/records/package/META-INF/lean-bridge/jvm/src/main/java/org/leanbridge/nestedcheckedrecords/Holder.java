package org.leanbridge.nestedcheckedrecords;
public record Holder(Packet packet, java.math.BigInteger tag) {
    @Override public boolean equals(Object candidate) {
        if (this == candidate) return true;
        return candidate instanceof Holder other
            && java.util.Objects.deepEquals(this.packet, other.packet)
            && java.util.Objects.deepEquals(this.tag, other.tag);
    }
    @Override public int hashCode() {
        return java.util.Arrays.deepHashCode(new Object[] { Holder.class, this.packet, this.tag });
    }
}
