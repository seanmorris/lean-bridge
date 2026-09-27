import java.util.*;
import java.util.function.Supplier;

/** Independent consumer cleanup through public values and AutoCloseable only. */
public final class OwnedInstalledSupport {
    private OwnedInstalledSupport() { }
    private static int checks;
    public static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message); checks++;
    }
    public static Throwable reject(Class<? extends Throwable> expected, Runnable call) {
        try { call.run(); }
        catch (Throwable error) {
            if (!expected.isInstance(error)) throw new AssertionError("Unexpected exception", error);
            checks++; return error;
        }
        throw new AssertionError("Expected " + expected.getName());
    }
    public static void drop(Object root) {
        var pending = new ArrayDeque<Object>(); pending.push(root);
        var seen = new IdentityHashMap<Object, Boolean>();
        while (!pending.isEmpty()) {
            Object value = pending.pop();
            if (seen.put(value, Boolean.TRUE) != null) continue;
            try {
                if (value instanceof AutoCloseable owned) owned.close();
                else if (value instanceof Object[] array) Collections.addAll(pending, array);
                else if (value.getClass().isRecord()) {
                    for (var field : value.getClass().getRecordComponents()) pending.push(field.getAccessor().invoke(value));
                } else if (value.getClass().getPackageName().endsWith(".kotlin")) {
                    for (var field : value.getClass().getFields())
                        if (!java.lang.reflect.Modifier.isStatic(field.getModifiers())) pending.push(field.get(value));
                }
            } catch (ReflectiveOperationException error) { throw new AssertionError("Cannot inspect public value", error); }
            catch (Exception error) { throw new AssertionError("Cannot close public owner", error); }
        }
    }
    public static void repeat(Supplier<Object> call) {
        for (int index = 0; index < 3; index++) drop(call.get());
        checks++;
    }
    @SuppressWarnings("unchecked")
    public static <T> T with(T value, String name, Object replacement) {
        try {
            var fields = value.getClass().getRecordComponents();
            if (fields == null) throw new AssertionError("Expected a public record");
            var arguments = new Object[fields.length];
            var types = new Class<?>[fields.length];
            boolean found = false;
            for (int i = 0; i < fields.length; i++) {
                types[i] = fields[i].getType();
                arguments[i] = fields[i].getAccessor().invoke(value);
                if (fields[i].getName().equals(name)) { arguments[i] = replacement; found = true; }
            }
            if (!found) throw new AssertionError("Missing public record component: " + name);
            return (T)value.getClass().getConstructor(types).newInstance(arguments);
        } catch (ReflectiveOperationException error) { throw new AssertionError("Cannot construct public record", error); }
    }
    public static int checks() { return checks; }
}
