package org.leanbridge.nominalsubtypes;
/**
 * @param left Contract type: <code>Envelope</code>.
 * @param right Contract type: <code>Envelope</code>.
 */
public record EnvelopePair(Envelope left, Envelope right) {
    @Override public boolean equals(Object candidate) {
        if (this == candidate) return true;
        return candidate instanceof EnvelopePair other
            && java.util.Objects.deepEquals(this.left, other.left)
            && java.util.Objects.deepEquals(this.right, other.right);
    }
    @Override public int hashCode() {
        return java.util.Arrays.deepHashCode(new Object[] { EnvelopePair.class, this.left, this.right });
    }
}
