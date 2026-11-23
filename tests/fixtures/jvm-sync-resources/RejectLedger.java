import java.lang.reflect.InvocationTargetException;
import java.net.*;
import java.nio.file.*;
import java.util.jar.*;

class RejectLedger {
    public static void main(String[] args) throws Exception {
        try (var first = org.leanbridge.counter.Api.issue(7)) {
            if (first.isClosed()) throw new AssertionError();
        }
        Path overlay = Path.of(args[2]);
        try (var z = new JarOutputStream(Files.newOutputStream(overlay, StandardOpenOption.CREATE_NEW))) {
            z.putNextEntry(new JarEntry("META-INF/lean-bridge/native/linux-x64/" + args[1]));
            z.write(1); z.closeEntry();
        }
        try (var loader = new URLClassLoader(new URL[]{overlay.toUri().toURL(), Path.of(args[0]).toUri().toURL()}, ClassLoader.getPlatformClassLoader())) {
            try { Class.forName("org.leanbridge.desk.Api", true, loader).getMethod("issue", long.class).invoke(null, 1L); }
            catch (InvocationTargetException e) {
                for (Throwable t = e; t != null; t = t.getCause()) {
                    if (String.valueOf(t.getMessage()).contains("Packaged native library differs from compiled evidence: " + args[1])) {
                        if (Observe.snapshot()[3] != 0) throw new AssertionError("leaked lease");
                        System.out.println("changed ledger rejected after a compatible peer loaded"); return;
                    }
                }
                throw e;
            }
        }
        throw new AssertionError("accepted an unauthenticated native ledger");
    }
}
