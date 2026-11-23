/* Test-only independent observer. Applications never inspect the runtime or use FFM. */
import java.lang.foreign.*;
import java.nio.file.Path;
import static java.lang.foreign.ValueLayout.*;

final class Observer {
    static void verifyAndRetire(boolean injectFault) throws Throwable {
        String path = System.getProperty("lean.bridge.jvm.native-library-v1.library.liblean_bridge_native.so.path");
        try (var arena = Arena.ofConfined()) {
            var lib = SymbolLookup.libraryLookup(Path.of(path), arena);
            var linker = Linker.nativeLinker();
            var read = linker.downcallHandle(lib.find("lean_bridge_native_snapshot_read").orElseThrow(), FunctionDescriptor.ofVoid(ADDRESS));
            var s = arena.allocate(40, 8); read.invokeExact(s);
            if (s.get(JAVA_INT, 8) != 1 || s.get(JAVA_INT, 12) != 2 || s.get(JAVA_INT, 16) != 2 || s.get(JAVA_INT, 20) != 0)
                throw new AssertionError("expected one runtime, two initialized and attached components, zero live identities");
            if (injectFault) {
                // Exercise how the real decoder handles an invalid native result tag.
                // This is deliberately injected, not an application error or an observed Lean bug.
                var decode = Class.forName("org.leanbridge.journal.Wire").getDeclaredMethod("bool", long.class);
                decode.setAccessible(true);
                try { decode.invoke(null, 2L); throw new AssertionError("invalid discriminant accepted"); }
                catch (java.lang.reflect.InvocationTargetException e) {
                    if (!(e.getCause() instanceof IllegalStateException cause) || !cause.getMessage().contains("discriminant")) throw e;
                }
            } else {
                var retire = linker.downcallHandle(lib.find("lean_bridge_native_runtime_retire").orElseThrow(), FunctionDescriptor.ofVoid());
                retire.invokeExact();
            }
        }
    }
}
