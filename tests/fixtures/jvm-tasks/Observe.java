import java.lang.foreign.*;
import java.nio.file.*;
import java.util.function.BooleanSupplier;
import static java.lang.foreign.ValueLayout.*;

class Observe {
    static void check(boolean ok) { if (!ok) throw new AssertionError(); }
    static void until(BooleanSupplier test) {
        long deadline = System.nanoTime() + 20_000_000_000L;
        while (!test.getAsBoolean()) {
            if (System.nanoTime() >= deadline) throw new AssertionError("timed out waiting for native state");
            try { Thread.sleep(8); } catch (InterruptedException e) { throw new AssertionError(e); }
        }
    }
    static int[] snapshot() {
        try (var a = Arena.ofConfined()) {
            var lib = SymbolLookup.libraryLookup(Path.of(System.getProperty("lean.bridge.jvm.native-library-v1.library.liblean_bridge_native.so.path")), a);
            var s = a.allocate(40, 8);
            Linker.nativeLinker().downcallHandle(lib.find("lean_bridge_native_snapshot_read").orElseThrow(), FunctionDescriptor.ofVoid(ADDRESS)).invokeExact(s);
            return new int[]{s.get(JAVA_INT, 8), s.get(JAVA_INT, 12), s.get(JAVA_INT, 16), s.get(JAVA_INT, 20)};
        } catch (Throwable e) { throw new AssertionError(e); }
    }
    static void retire() {
        try (var a = Arena.ofConfined()) {
            var lib = SymbolLookup.libraryLookup(Path.of(System.getProperty("lean.bridge.jvm.native-library-v1.library.liblean_bridge_native.so.path")), a);
            Linker.nativeLinker().downcallHandle(lib.find("lean_bridge_native_runtime_retire").orElseThrow(), FunctionDescriptor.ofVoid()).invokeExact();
        } catch (Throwable e) { throw new AssertionError(e); }
    }
    static long descriptors() {
        try (var files = Files.list(Path.of("/proc/self/fd"))) {
            return files.filter(p -> { try {
                String target = Files.readSymbolicLink(p).toString();
                return target.equals("anon_inode:[eventpoll]") || target.equals("anon_inode:[eventfd]");
            } catch (Exception e) { return false; } }).count();
        } catch (Exception e) { throw new AssertionError(e); }
    }
    static long reactors() { return Thread.getAllStackTraces().keySet().stream().filter(t -> t.getName().equals("Lean task readiness")).count(); }
    static void drained() { until(() -> snapshot()[3] == 0 && reactors() == 0); }
}
