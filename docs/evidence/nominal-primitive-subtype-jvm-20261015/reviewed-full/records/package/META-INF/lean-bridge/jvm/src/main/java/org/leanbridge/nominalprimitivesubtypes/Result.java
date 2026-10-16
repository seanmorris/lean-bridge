package org.leanbridge.nominalprimitivesubtypes;
/** A copied Lean Except. Domain errors are values; bridge failures throw. */
public sealed interface Result<T, E> permits Result.Ok, Result.Err {
    boolean isOk();
    T value();
    E error();
    static <T, E> Result<T, E> ok(T value) { return new Ok<>(value); }
    static <T, E> Result<T, E> err(E error) { return new Err<>(error); }
    record Ok<T, E>(T value) implements Result<T, E> {
        public Ok { java.util.Objects.requireNonNull(value); }
        public boolean isOk() { return true; }
        public E error() { throw new IllegalStateException("Ok has no error"); }
    @Override public boolean equals(Object candidate) {
        if (this == candidate) return true;
        return candidate instanceof Ok<?, ?> other
            && java.util.Objects.deepEquals(this.value, other.value);
    }
    @Override public int hashCode() {
        return java.util.Arrays.deepHashCode(new Object[] { Ok.class, this.value });
    }
    }
    record Err<T, E>(E error) implements Result<T, E> {
        public Err { java.util.Objects.requireNonNull(error); }
        public boolean isOk() { return false; }
        public T value() { throw new IllegalStateException("Err has no success value"); }
    @Override public boolean equals(Object candidate) {
        if (this == candidate) return true;
        return candidate instanceof Err<?, ?> other
            && java.util.Objects.deepEquals(this.error, other.error);
    }
    @Override public int hashCode() {
        return java.util.Arrays.deepHashCode(new Object[] { Err.class, this.error });
    }
    }
}
