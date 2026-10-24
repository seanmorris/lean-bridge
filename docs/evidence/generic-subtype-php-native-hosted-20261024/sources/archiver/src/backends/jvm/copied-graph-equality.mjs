/**
 * Stack-independent value operations for recursive Java declarations.
 *
 * @file
 */

/**
 * Render private traversal without adding public numeric-tag accessors.
 *
 * @param records - Nominal records and constructor classes.
 * @param namespace - Package-qualified names cannot collide with private helpers.
 * @param options - Alternate copied host values using the same traversal.
 * @param options.className - Private generated helper name.
 * @param options.compoundsNamespace - Qualified Kotlin wrappers, or Java's local wrappers.
 * @param options.accessors - Read named Kotlin fields without a public indexed accessor.
 */
export const jvmGraphEquality = (records, namespace, { className = "GraphValues", compoundsNamespace = null, accessors = false } = {}) => {
	const compound = name => compoundsNamespace ? `${compoundsNamespace}.${name}` : name;
	const field = record => accessors
		? `switch (index) { ${record.fields.map((field, index) => `case ${index} -> item.${field.publicName}();`).join(" ")} default -> throw new IndexOutOfBoundsException(index); }`
		: "item.bridgeField(index)";
	return `final class ${className} {
    private ${className}() { }
    private record Entry(Object value, Class<?> type, int count) { }
    private record Frame(Object value, int depth, int index, int count) { }

    private static int count(Object value) {
${records.map(record => `        if (value instanceof ${namespace}.${record.name}) return ${record.fields.length};`).join("\n")}
        if (value instanceof ${compound("Option")}.None<?>) return 0;
        if (value instanceof ${compound("Option")}.Some<?> || value instanceof ${compound("Result")}.Ok<?, ?> || value instanceof ${compound("Result")}.Err<?, ?>) return 1;
        if (value instanceof ${compound("Pair")}<?, ?>) return 2;
        if (value != null && value.getClass().isArray() && !(value instanceof byte[]))
            return java.lang.reflect.Array.getLength(value);
        if (value == null || value instanceof Unit || value instanceof Boolean || value instanceof Byte
            || value instanceof Short || value instanceof Integer || value instanceof Long || value instanceof Float
            || value instanceof Double || value instanceof String || value instanceof byte[] || value.getClass() == java.math.BigInteger.class)
            return -1;
        throw new IllegalArgumentException("Unsupported copied value in structural comparison");
    }

    private static Object field(Object value, int index) {
${records.filter(record => record.fields.length).map(record => `        if (value instanceof ${namespace}.${record.name} item) return ${field(record)};`).join("\n")}
        if (value instanceof ${compound("Option")}.Some<?> item) return item.value();
        if (value instanceof ${compound("Result")}.Ok<?, ?> item) return item.value();
        if (value instanceof ${compound("Result")}.Err<?, ?> item) return item.error();
        if (value instanceof ${compound("Pair")}<?, ?> item) return index == 0 ? item.first() : item.second();
        if (value.getClass().isArray()) return java.lang.reflect.Array.get(value, index);
        throw new IllegalStateException("Invalid copied value traversal frame");
    }

    private static final class Cursor {
        private final java.util.ArrayDeque<Frame> pending = new java.util.ArrayDeque<>();
        private final java.util.IdentityHashMap<Object, Boolean> active = new java.util.IdentityHashMap<>();
        private int remaining = 262144;
        private long bytes = 16 * 1024 * 1024;
        Cursor(Object root) { pending.push(new Frame(root, 0, -1, 0)); }
        Entry take() {
            while (!pending.isEmpty()) {
                Frame frame = pending.pop(); Object value = frame.value();
                if (frame.index() >= 0) {
                    if (frame.index() == frame.count()) { active.remove(value); continue; }
                    pending.push(new Frame(value, frame.depth(), frame.index() + 1, frame.count()));
                    pending.push(new Frame(field(value, frame.index()), frame.depth() + 1, -1, 0));
                    continue;
                }
                if (frame.depth() > 128 || --remaining < 0)
                    throw new IllegalArgumentException("Lean Bridge comparison exceeds 128 levels or 262144 node visits");
                int count = count(value);
                if (count > remaining) throw new IllegalArgumentException("Lean Bridge comparison exceeds 262144 node visits");
                if (count >= 0) {
                    if (active.put(value, Boolean.TRUE) != null) throw new IllegalArgumentException("Cyclic copied values cannot be compared");
                    pending.push(new Frame(value, frame.depth(), 0, count));
                } else {
                    if (value instanceof byte[] data) bytes -= data.length;
                    else if (value instanceof String text) bytes -= (long)text.length() * 2;
                    else if (value instanceof java.math.BigInteger integer) bytes -= ((long)integer.bitLength() + 8) / 8;
                    if (bytes < 0) throw new IllegalArgumentException("Lean Bridge comparison exceeds 16 MiB of scalar data");
                }
                // Reference-array covariance preserves payload identity. Primitive
                // arrays retain their distinct JVM scalar representation.
                Class<?> type = value instanceof Object[] ? Object[].class : value == null ? null : value.getClass();
                return new Entry(value, type, count);
            }
            return null;
        }
    }

    static boolean equal(Object left, Object right) {
        Cursor a = new Cursor(left), b = new Cursor(right); boolean equal = true;
        while (true) {
            Entry x = a.take(), y = b.take();
            if (x == null && y == null) return equal;
            // Do not hide a later cycle or budget failure behind an unequal prefix.
            if (x == null || y == null || x.type() != y.type() || x.count() != y.count()) { equal = false; continue; }
            if (x.count() >= 0) continue;
            if (x.value() instanceof byte[] data) equal &= java.util.Arrays.equals(data, (byte[])y.value());
            else equal &= java.util.Objects.equals(x.value(), y.value());
        }
    }

    static int hash(Object value) {
        Cursor cursor = new Cursor(value); int hash = 1;
        for (Entry entry; (entry = cursor.take()) != null;) {
            hash = 31 * hash + java.util.Objects.hashCode(entry.type());
            hash = 31 * hash + entry.count();
            if (entry.count() < 0) hash = 31 * hash + (entry.value() instanceof byte[] data
                ? java.util.Arrays.hashCode(data) : java.util.Objects.hashCode(entry.value()));
        }
        return hash;
    }

    static String format(Object value) {
        Cursor cursor = new Cursor(value); StringBuilder text = new StringBuilder(); boolean truncated = false;
        for (Entry entry; (entry = cursor.take()) != null;) {
            if (text.length() >= 4096) { truncated = true; continue; }
            if (!text.isEmpty()) text.append(' ');
            if (entry.count() >= 0) text.append(entry.type().getSimpleName()).append('[').append(entry.count()).append(']');
            else if (entry.value() instanceof byte[] data) text.append("bytes[").append(data.length).append(']');
            else if (entry.value() instanceof String content) {
                int length = java.lang.Math.min(content.length(), 4096 - text.length());
                text.append(content, 0, length); truncated |= length != content.length();
            } else if (entry.value() instanceof java.math.BigInteger integer && integer.bitLength() > 2048)
                text.append("BigInteger[").append(integer.bitLength()).append(" bits]");
            else text.append(entry.value());
            if (text.length() > 4096) { text.setLength(4096); truncated = true; }
        }
        if (truncated) text.append("...");
        return text.toString();
    }
}
`;
};

/** Public methods use one bounded traversal, including self-comparisons. */
export const jvmGraphValueMethods = `    @Override public boolean equals(Object candidate) {
        return candidate != null && candidate.getClass() == getClass() && GraphValues.equal(this, candidate);
    }
    @Override public int hashCode() { return GraphValues.hash(this); }
    @Override public String toString() { return GraphValues.format(this); }`;

/** Generic wrappers preserve active branches, Unit and binary product nesting. */
export const jvmGraphCompoundTypes = {
	Option: `public sealed interface Option<T> permits Option.None, Option.Some {
    boolean isSome();
    T value();
    static <T> Option<T> none() { return new None<>(); }
    static <T> Option<T> some(T value) { return new Some<>(value); }
    record None<T>() implements Option<T> {
        public boolean isSome() { return false; }
        public T value() { throw new IllegalStateException("None has no value"); }
${jvmGraphValueMethods}
    }
    record Some<T>(T value) implements Option<T> {
        public Some { java.util.Objects.requireNonNull(value); }
        public boolean isSome() { return true; }
${jvmGraphValueMethods}
    }
}
`
	, Result: `public sealed interface Result<T, E> permits Result.Ok, Result.Err {
    boolean isOk();
    T value();
    E error();
    static <T, E> Result<T, E> ok(T value) { return new Ok<>(value); }
    static <T, E> Result<T, E> err(E error) { return new Err<>(error); }
    record Ok<T, E>(T value) implements Result<T, E> {
        public Ok { java.util.Objects.requireNonNull(value); }
        public boolean isOk() { return true; }
        public E error() { throw new IllegalStateException("Ok has no error"); }
${jvmGraphValueMethods}
    }
    record Err<T, E>(E error) implements Result<T, E> {
        public Err { java.util.Objects.requireNonNull(error); }
        public boolean isOk() { return false; }
        public T value() { throw new IllegalStateException("Err has no success value"); }
${jvmGraphValueMethods}
    }
}
`
	, Pair: `public record Pair<A, B>(A first, B second) {
    public Pair { java.util.Objects.requireNonNull(first); java.util.Objects.requireNonNull(second); }
${jvmGraphValueMethods}
}
`
};
