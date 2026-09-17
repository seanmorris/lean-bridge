// Public-value observations only. Expected results remain with the Lean oracle.
import java.lang.reflect.Modifier;
import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.*;
import java.util.function.Function;

public final class Wire {
    private Wire() { }
    static final List<Object> results = new ArrayList<>();
    static final List<Object> errors = new ArrayList<>();
    public static void check(boolean condition) { if (!condition) throw new AssertionError("Corpus assertion failed"); }
    public static void consume(Object value) { Objects.requireNonNull(value); }
    public static Object map(Object... entries) {
        var result = new LinkedHashMap<String,Object>();
        for (int i = 0; i < entries.length; i += 2) result.put((String)entries[i], entries[i + 1]);
        return result;
    }
    public static Object integer(Object value) { check(value instanceof Number); return map("integer", value.toString()); }
    public static Object text(String value) { return map("string", value); }
    public static Object bool(boolean value) { return map("bool", value); }
    public static Object unit() { return map("unit", true); }
    public static Object bytes(byte[] value) {
        var result = new ArrayList<Integer>();
        for (byte item : value) result.add(Byte.toUnsignedInt(item));
        return map("bytes", result);
    }
    public static Object array(Object value, Function<Object,Object> encode) {
        var result = new ArrayList<Object>();
        for (int i = 0; i < java.lang.reflect.Array.getLength(value); ++i) result.add(encode.apply(java.lang.reflect.Array.get(value, i)));
        return map("array", result);
    }
    public static Object f32(float value) { return map("float32", Float.isNaN(value) ? "nan" : Integer.toUnsignedString(Float.floatToRawIntBits(value))); }
    public static Object f64(double value) { return map("float64", Double.isNaN(value) ? "nan" : Long.toUnsignedString(Double.doubleToRawLongBits(value))); }
    public static void result(String id, Object observed, boolean copy) { results.add(map("id", id, "status", "matched", "observed", observed, "independentCopy", copy)); }
    public static Throwable reject(Class<?> expected, Runnable call) {
        try { call.run(); } catch (RuntimeException error) {
            if (error.getClass() != expected) throw new AssertionError("Expected " + expected.getName() + ", got " + error, error);
            return error;
        }
        throw new AssertionError("Invalid public input was accepted");
    }
    public static void rejected(String id, Throwable error, Object recovery) { results.add(map("id", id, "status", "rejected-as-expected", "exception", error.getClass().getSimpleName(), "message", error.getMessage(), "recovered", true, "recovery", recovery)); }
    public static void error(String id, int iteration, Throwable error, Object recovery) { errors.add(map("id", id, "iteration", iteration, "exception", error.getClass().getSimpleName(), "recovery", recovery)); }
    public static void method(Class<?> api, String name, Class<?> result, Class<?>... parameters) throws Exception {
        var method = api.getDeclaredMethod(name, parameters);
        check(Modifier.isPublic(method.getModifiers()) && Modifier.isStatic(method.getModifiers()));
        check(method.getReturnType() == result && method.getTypeParameters().length == 0);
    }
    public static void record(Class<?> type, String[] names, Class<?>[] types) throws Exception {
        check(type.isRecord() && Modifier.isFinal(type.getModifiers()));
        var components = type.getRecordComponents();
        check(components.length == names.length && type.getConstructors().length == 1);
        check(Arrays.equals(type.getConstructors()[0].getParameterTypes(), types));
        for (int i = 0; i < names.length; ++i) {
            check(components[i].getName().equals(names[i]) && components[i].getType() == types[i]);
            check(Modifier.isPublic(components[i].getAccessor().getModifiers()));
        }
    }
    static String quote(String value) {
        var out = new StringBuilder("\"");
        for (char c : value.toCharArray()) {
            if (c == '"' || c == '\\') out.append('\\').append(c);
            // Keep observations independent of the process stdout encoding.
            else if (c < 32 || c > 126) out.append(String.format(Locale.ROOT, "\\u%04x", (int)c));
            else out.append(c);
        }
        return out.append('"').toString();
    }
    public static String json(Object value) {
        if (value == null) return "null";
        if (value instanceof String text) return quote(text);
        if (value instanceof Boolean || value instanceof Number) return value.toString();
        if (value instanceof Map<?,?> map) return "{" + String.join(",", map.entrySet().stream().map(e -> quote((String)e.getKey()) + ":" + json(e.getValue())).toList()) + "}";
        if (value instanceof List<?> list) return "[" + String.join(",", list.stream().map(Wire::json).toList()) + "]";
        throw new AssertionError("Unsupported observation type: " + value.getClass());
    }
    public static void finish(String profile, String module, String hostVersion, Class<?> api) throws Exception {
        var libraries = new TreeMap<String,String>();
        var roots = new HashSet<Path>();
        var paths = new TreeSet<String>();
        String prefix = System.getProperty("java.io.tmpdir") + "/lean-bridge-jvm-";
        for (String line : Files.readAllLines(Path.of("/proc/self/maps"))) {
            String path = line.substring(line.lastIndexOf(' ') + 1);
            if (path.startsWith(prefix) && path.endsWith(".so")) paths.add(path);
        }
        for (String name : paths) {
            var path = Path.of(name); roots.add(path.getParent());
            var digest = MessageDigest.getInstance("SHA-256");
            try (var stream = Files.newInputStream(path)) {
                byte[] buffer = new byte[65536];
                for (int count; (count = stream.read(buffer)) != -1;) digest.update(buffer, 0, count);
            }
            check(libraries.put(path.getFileName().toString(), HexFormat.of().formatHex(digest.digest())) == null);
        }
        check(roots.size() == 1 && !libraries.isEmpty());
        System.out.println(json(map("schemaVersion", 1, "profile", profile, "module", module, "hostVersion", hostVersion, "jvmVersion", System.getProperty("java.version"), "results", results, "errors", errors, "nativeLibraries", libraries, "nativeRootCount", roots.size(), "apiLocation", Path.of(api.getProtectionDomain().getCodeSource().getLocation().toURI()).toString())));
    }
}
