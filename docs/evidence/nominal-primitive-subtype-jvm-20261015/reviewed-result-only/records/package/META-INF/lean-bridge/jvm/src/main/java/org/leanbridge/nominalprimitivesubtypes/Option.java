package org.leanbridge.nominalprimitivesubtypes;
/** A copied Lean Option. None and Some(Unit) are distinct. */
public sealed interface Option<T> permits Option.None, Option.Some {
    boolean isSome();
    T value();
    static <T> Option<T> none() { return new None<>(); }
    static <T> Option<T> some(T value) { return new Some<>(value); }
    record None<T>() implements Option<T> {
        public boolean isSome() { return false; }
        public T value() { throw new IllegalStateException("None has no value"); }
    }
    record Some<T>(T value) implements Option<T> {
        public Some { java.util.Objects.requireNonNull(value); }
        public boolean isSome() { return true; }
    @Override public boolean equals(Object candidate) {
        if (this == candidate) return true;
        return candidate instanceof Some<?> other
            && java.util.Objects.deepEquals(this.value, other.value);
    }
    @Override public int hashCode() {
        return java.util.Arrays.deepHashCode(new Object[] { Some.class, this.value });
    }
    }
}
