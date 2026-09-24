import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;

public final class Conflicts {
    private static Method value(ClassLoader loader, String profile) throws Exception {
        return Class.forName("org.leanbridge.graph_collision." + (profile.equals("kotlin") ? "kotlin." : "") + "Api", true, loader).getMethod("value");
    }
    private static long call(Method method) throws Exception { return (long)method.invoke(null); }
    public static void main(String[] args) throws Throwable {
        String mode = args[0], profile = args[1]; long expected = Long.parseLong(args[4]);
        // Kotlin's standard library is in the parent, but neither component is.
        // Each URL loader therefore defines independent generated class state.
        try (var firstLoader = new URLClassLoader(new URL[] {Path.of(args[2]).toUri().toURL()}, Conflicts.class.getClassLoader());
             var secondLoader = new URLClassLoader(new URL[] {Path.of(args[3]).toUri().toURL()}, Conflicts.class.getClassLoader())) {
            Method first = value(firstLoader, profile);
            if (first.getDeclaringClass().getClassLoader() != firstLoader || call(first) != expected) throw new AssertionError("First component did not load independently");
            Loading.snapshot("graph_collision", 1);
            var before = Loading.mappings();
            var temp = Path.of(System.getProperty("java.io.tmpdir"));
            long directories; try (var list = Files.list(temp)) { directories = list.count(); }
            Method second = value(secondLoader, profile);
            if (second.getDeclaringClass().getClassLoader() != secondLoader) throw new AssertionError("Second component did not load independently");
            if (mode.equals("duplicate")) {
                if (call(second) != expected) throw new AssertionError("An identical package changed its result");
            } else {
                for (int index = 0; index < 2; index++) {
                    try { call(second); throw new AssertionError("A conflicting component was admitted"); }
                    catch (InvocationTargetException error) {
                        if (!(error.getCause() instanceof IllegalStateException cause)
                            || !cause.getMessage().equals("Conflicting builds of the same Lean component")) throw error;
                    }
                }
            }
            if (!before.equals(Loading.mappings())) throw new AssertionError("The second loader mapped different native code");
            try (var list = Files.list(temp)) { if (list.count() != directories) throw new AssertionError("Duplicate/conflict extracted more native assets"); }
            if (call(first) != expected) throw new AssertionError("Existing component was poisoned");
            Loading.snapshot("graph_collision", 1);
            Loading.finish(profile + "-" + mode);
        }
    }
}
