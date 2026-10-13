package org.leanbridge.nominalsubtypes;
/**
 * @param left Contract type: <code>array&lt;option&lt;EnvelopeAlias&gt;&gt;</code>.
 * @param right Contract type: <code>array&lt;option&lt;EnvelopeAlias&gt;&gt;</code>.
 */
public record AliasPair(Option<Envelope>[] left, Option<Envelope>[] right) {
    @Override public boolean equals(Object candidate) {
        if (this == candidate) return true;
        return candidate instanceof AliasPair other
            && java.util.Objects.deepEquals(this.left, other.left)
            && java.util.Objects.deepEquals(this.right, other.right);
    }
    @Override public int hashCode() {
        return java.util.Arrays.deepHashCode(new Object[] { AliasPair.class, this.left, this.right });
    }
}
