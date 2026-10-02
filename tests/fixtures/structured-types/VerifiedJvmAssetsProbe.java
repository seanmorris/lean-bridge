import java.lang.foreign.*;
import java.lang.reflect.InvocationTargetException;
import java.net.URLClassLoader;
import java.nio.file.Path;
import static java.lang.foreign.ValueLayout.*;

public final class VerifiedJvmAssetsProbe {
    private static final String KEY = "lean.bridge.jvm.native-library-v1.";
    private static int checks;
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message); checks++;
    }
    private static Class<?> load(Path root, String name) throws Exception {
        var loader = new URLClassLoader(new java.net.URL[] { root.resolve(name).resolve("classes").toUri().toURL() }, ClassLoader.getPlatformClassLoader());
        return Class.forName("fixture.Api", true, loader);
    }
    private static int call(Class<?> api) throws Throwable {
        try { return (int)api.getMethod("read").invoke(null); }
        catch (InvocationTargetException error) { throw error.getCause(); }
    }
    private interface Action { void run() throws Throwable; }
    private static void rejects(String message, Action action) throws Throwable {
        try { action.run(); }
        catch (Throwable error) {
            if (error instanceof AssertionError) throw error;
            check(String.valueOf(error.getMessage()).contains(message), error.toString()); return;
        }
        throw new AssertionError("Expected " + message);
    }
    private static void preload(Path path) throws Throwable {
        var linker = Linker.nativeLinker();
        var open = linker.downcallHandle(linker.defaultLookup().find("dlopen").orElseThrow(), FunctionDescriptor.of(ADDRESS, ADDRESS, JAVA_INT));
        try (var arena = Arena.ofConfined()) {
            var handle = (MemorySegment)open.invokeExact(arena.allocateFrom(path.toString()), 2 | 256);
            check(handle.address() != 0, "fixture preloaded");
        }
    }
    public static void main(String[] args) throws Throwable {
        var root = Path.of(args[0]); String mode = args[1];
        if (mode.equals("shared") || mode.equals("isolation")) {
            if (mode.equals("isolation")) preload(root.resolve("libpoison.so"));
            check(call(load(root, "one")) == 49, "first private dependency");
            check(call(load(root, "two")) == 50, "second private dependency");
            check(call(load(root, "one")) == 49, "identical component from another classloader");
            long libraries = System.getProperties().keySet().stream().filter(key -> key instanceof String name && name.startsWith(KEY + "library.") && name.endsWith(".path")).count();
            check(libraries == 5, "exactly one copy of shared libraries");
            var registry = new java.util.Properties();
            for (var entry : System.getProperties().entrySet()) {
                if (!(entry.getKey() instanceof String name) || !name.startsWith(KEY)) continue;
                check(entry.getValue() instanceof String, "native registry preserves string properties");
                registry.setProperty(name, (String)entry.getValue());
            }
            registry.store(new java.io.ByteArrayOutputStream(), "native registry");
            checks++;
        } else if (mode.equals("preload")) {
            preload(root.resolve("libleanshared.so"));
            rejects("Unverified native library", () -> call(load(root, "one")));
        } else if (mode.equals("runtime") || mode.equals("component") || mode.equals("hash")) {
            var first = load(root, "one"); check(call(first) == 49, "original package works");
            String message = mode.equals("runtime") ? "Incompatible Lean runtime" : mode.equals("component") ? "Conflicting builds" : "Conflicting or incomplete native library";
            rejects(message, () -> call(load(root, mode)));
            check(call(first) == 49, "existing verified component remains usable");
        } else if (mode.equals("missing") || mode.equals("tampered")) {
            rejects(mode.equals("missing") ? "Missing packaged native" : "differs from compiled evidence", () -> call(load(root, mode)));
            check(!System.getProperties().containsKey(KEY + "runtime"), "no native runtime loaded from invalid resources");
        } else if (mode.equals("broken")) {
            rejects("Cannot load verified Lean native library", () -> call(load(root, "broken")));
            rejects("failed earlier", () -> call(load(root, "one")));
        } else if (mode.equals("warm-origin") || mode.equals("cold-origin")) {
            var first = load(root, "one"); check(call(first) == 49, "original process");
            String origin = System.getProperties().getProperty(KEY + "process");
            System.getProperties().setProperty(KEY + "process", Integer.toString(Integer.parseInt(origin) + 1));
            if (mode.equals("warm-origin")) rejects("process", () -> call(first));
            else {
                // Model a cold peer while the registry monitor is unavailable.
                // This does not execute Java in a forked JVM.
                var failure = new Throwable[1]; var cold = load(root, "two");
                Thread worker = new Thread(() -> {
                    try { call(cold); failure[0] = new AssertionError("cold process origin adopted"); }
                    catch (Throwable error) { failure[0] = error; }
                });
                synchronized (System.getProperties()) {
                    worker.start(); worker.join(5000);
                    check(!worker.isAlive(), "process guard runs before registry monitor");
                }
                check(failure[0] instanceof IllegalStateException && failure[0].getMessage().contains("fresh process"), "cold origin rejected");
            }
            System.getProperties().setProperty(KEY + "process", origin);
            check(call(first) == 49, "original registry remains usable");
        } else throw new AssertionError(mode);
        System.out.println("{\"mode\":\"" + mode + "\",\"checks\":" + checks + "}");
    }
}
