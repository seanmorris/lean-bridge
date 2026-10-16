package org.leanbridge.nominalprimitivesubtypes;
/**
 * @param values Contract type: <code>array&lt;option&lt;result&lt;Packet, Packet&gt;&gt;&gt;</code>.
 */
public record EventChoices(Option<Result<Packet, Packet>>[] values) implements Event {
    @Override public boolean equals(Object candidate) {
        if (this == candidate) return true;
        return candidate instanceof EventChoices other
            && java.util.Objects.deepEquals(this.values, other.values);
    }
    @Override public int hashCode() {
        return java.util.Arrays.deepHashCode(new Object[] { EventChoices.class, this.values });
    }
}
