package org.leanbridge.nominalprimitivesubtypes;
/**
 * @param left Contract type: <code>array&lt;option&lt;PacketAlias&gt;&gt;</code>.
 * @param right Contract type: <code>array&lt;option&lt;PacketAlias&gt;&gt;</code>.
 */
public record PacketPair(Option<Packet>[] left, Option<Packet>[] right) {
    @Override public boolean equals(Object candidate) {
        if (this == candidate) return true;
        return candidate instanceof PacketPair other
            && java.util.Objects.deepEquals(this.left, other.left)
            && java.util.Objects.deepEquals(this.right, other.right);
    }
    @Override public int hashCode() {
        return java.util.Arrays.deepHashCode(new Object[] { PacketPair.class, this.left, this.right });
    }
}
