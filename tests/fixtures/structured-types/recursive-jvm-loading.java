import java.lang.foreign.Arena;
import java.lang.foreign.FunctionDescriptor;
import java.lang.foreign.Linker;
import java.lang.foreign.SymbolLookup;
import java.lang.foreign.ValueLayout;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.TreeMap;
import java.util.TreeSet;

final class Loading {
    private Loading() { }
    private static Path root(String component) {
        String path = System.getProperty("lean.bridge.jvm.native-library-v1." + component + "@1.0.0.path");
        if (path == null) throw new AssertionError("Component is not registered: " + component);
        return Path.of(path);
    }
    static void snapshot(String component, int components) throws Throwable {
        root(component); // The caller's component must already be attached.
        // Probe the broker actually mapped by the first package. Opening the
        // unused copy in another package would itself create a second runtime.
        mappings(); // Require a single mapping of each native library first.
        var broker = nativePaths().stream().map(Path::of).filter(path -> path.getFileName().toString().equals("liblean_bridge_native.so")).findFirst().orElseThrow();
        var lookup = SymbolLookup.libraryLookup(broker, Arena.global());
        var read = Linker.nativeLinker().downcallHandle(lookup.find("lean_bridge_native_snapshot_read").orElseThrow(), FunctionDescriptor.ofVoid(ValueLayout.ADDRESS));
        try (var arena = Arena.ofConfined()) {
            var memory = arena.allocate(40, 8); read.invokeExact(memory);
            if (memory.get(ValueLayout.JAVA_INT, 8) != 1 || memory.get(ValueLayout.JAVA_INT, 12) != components
                || memory.get(ValueLayout.JAVA_INT, 16) != components || memory.get(ValueLayout.JAVA_INT, 20) != 0)
                throw new AssertionError("Runtime snapshot: " + memory.get(ValueLayout.JAVA_INT, 8) + ","
                    + memory.get(ValueLayout.JAVA_INT, 12) + "," + memory.get(ValueLayout.JAVA_INT, 16) + "," + memory.get(ValueLayout.JAVA_INT, 20));
        }
    }
    static void retire(String component) throws Throwable {
        var lookup = SymbolLookup.libraryLookup(root(component).resolve("lib" + component + ".so"), Arena.global());
        Linker.nativeLinker().downcallHandle(lookup.find(component + "_graph_retire").orElseThrow(), FunctionDescriptor.ofVoid()).invokeExact();
    }
    static void unavailable(Runnable action) {
        try { action.run(); }
        catch (RuntimeException error) {
            if (error.getClass().getSimpleName().equals("LeanBridgeException")
                && (error.getMessage().equals("Lean runtime is unavailable")
                    || error.getMessage().equals("Lean runtime is not ready or has been retired"))) return;
            throw error;
        }
        throw new AssertionError("Call succeeded after shared retirement");
    }
    private static TreeSet<String> nativePaths() throws Exception {
        var paths = new TreeSet<String>();
        for (String line : Files.readAllLines(Path.of("/proc/self/maps"))) {
            String[] fields = line.trim().split("\\s+", 6);
            if (fields.length == 6 && fields[5].startsWith(System.getProperty("java.io.tmpdir") + "/lean-bridge-jvm-")) paths.add(fields[5]);
        }
        return paths;
    }
    static TreeMap<String, String> mappings() throws Exception {
        var result = new TreeMap<String, String>();
        for (String path : nativePaths()) {
            String name = Path.of(path).getFileName().toString();
            if (result.put(name, HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(Path.of(path))))) != null)
                throw new AssertionError("Multiple mappings of the same native library: " + name);
        }
        if (!result.containsKey("libleanshared.so") || !result.containsKey("liblean_bridge_native.so")) throw new AssertionError("Missing shared runtime mappings");
        return result;
    }
    static void finish(String status) throws Exception {
        for (var entry : mappings().entrySet()) System.out.println("mapped:" + entry.getKey() + ":" + entry.getValue());
        System.out.println(status + "-ok");
    }
}
