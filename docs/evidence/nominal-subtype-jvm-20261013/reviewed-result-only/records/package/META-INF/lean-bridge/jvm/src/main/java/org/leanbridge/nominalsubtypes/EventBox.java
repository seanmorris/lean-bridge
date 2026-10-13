package org.leanbridge.nominalsubtypes;
/**
 * @param value Contract type: <code>Envelope</code>.
 */
public record EventBox(Envelope value) implements Event {
    @Override public boolean equals(Object candidate) {
        if (this == candidate) return true;
        return candidate instanceof EventBox other
            && java.util.Objects.deepEquals(this.value, other.value);
    }
    @Override public int hashCode() {
        return java.util.Arrays.deepHashCode(new Object[] { EventBox.class, this.value });
    }
}
