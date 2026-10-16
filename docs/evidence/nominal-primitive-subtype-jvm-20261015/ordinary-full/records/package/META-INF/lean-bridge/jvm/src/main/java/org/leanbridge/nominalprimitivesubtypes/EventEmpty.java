package org.leanbridge.nominalprimitivesubtypes;
public record EventEmpty() implements Event {
    @Override public boolean equals(Object candidate) {
        if (this == candidate) return true;
        return candidate instanceof EventEmpty other;
    }
    @Override public int hashCode() {
        return java.util.Arrays.deepHashCode(new Object[] { EventEmpty.class });
    }
}
