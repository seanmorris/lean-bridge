package org.leanbridge.nominalprimitivesubtypes;
/**
 * @param value Contract type: <code>Packet</code>.
 */
public record EventBox(Packet value) implements Event {
    @Override public boolean equals(Object candidate) {
        if (this == candidate) return true;
        return candidate instanceof EventBox other
            && java.util.Objects.deepEquals(this.value, other.value);
    }
    @Override public int hashCode() {
        return java.util.Arrays.deepHashCode(new Object[] { EventBox.class, this.value });
    }
}
