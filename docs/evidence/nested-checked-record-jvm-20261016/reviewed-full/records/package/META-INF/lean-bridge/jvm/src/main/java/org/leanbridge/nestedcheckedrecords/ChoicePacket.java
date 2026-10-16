package org.leanbridge.nestedcheckedrecords;
public record ChoicePacket(Packet value) implements Choice {
    @Override public boolean equals(Object candidate) {
        if (this == candidate) return true;
        return candidate instanceof ChoicePacket other
            && java.util.Objects.deepEquals(this.value, other.value);
    }
    @Override public int hashCode() {
        return java.util.Arrays.deepHashCode(new Object[] { ChoicePacket.class, this.value });
    }
}
