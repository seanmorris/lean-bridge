package org.leanbridge.nestedcheckedrecords;
public record ChoiceEmpty() implements Choice {
    @Override public boolean equals(Object candidate) {
        if (this == candidate) return true;
        return candidate instanceof ChoiceEmpty other;
    }
    @Override public int hashCode() {
        return java.util.Arrays.deepHashCode(new Object[] { ChoiceEmpty.class });
    }
}
