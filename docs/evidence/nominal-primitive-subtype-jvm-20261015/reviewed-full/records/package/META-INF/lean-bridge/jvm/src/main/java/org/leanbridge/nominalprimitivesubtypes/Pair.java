package org.leanbridge.nominalprimitivesubtypes;
/** A copied binary Lean product. Nested products retain their structure. */
public record Pair<A, B>(A first, B second) {
    public Pair { java.util.Objects.requireNonNull(first); java.util.Objects.requireNonNull(second); }
    @Override public boolean equals(Object candidate) {
        if (this == candidate) return true;
        return candidate instanceof Pair<?, ?> other
            && java.util.Objects.deepEquals(this.first, other.first)
            && java.util.Objects.deepEquals(this.second, other.second);
    }
    @Override public int hashCode() {
        return java.util.Arrays.deepHashCode(new Object[] { Pair.class, this.first, this.second });
    }
}
