import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.*;
import java.lang.reflect.InvocationTargetException;
import java.util.jar.*;
import org.leanbridge.clock.kotlin.Api;

class RejectTamper {
    public static void main(String[] args) throws Exception {
        if (Api.read() != 71) throw new AssertionError();
        String journal = args[0], shadow = "META-INF/lean-bridge/native/linux-x64/" + args[1];
        Path overlay = Path.of(args[2]);
        boolean alternate = args.length == 4 && args[3].equals("alternate");
        if (!alternate) {
            try (var z = new JarOutputStream(Files.newOutputStream(overlay, StandardOpenOption.CREATE_NEW))) {
                z.putNextEntry(new JarEntry(shadow)); z.write(1); z.closeEntry();
            }
        }
        try (var cl = new URLClassLoader(new URL[]{overlay.toUri().toURL(), Path.of(journal).toUri().toURL()}, ClassLoader.getPlatformClassLoader())) {
            try { Class.forName("org.leanbridge.journal.Api", true, cl).getMethod("count").invoke(null); }
            catch (InvocationTargetException e) {
                for (Throwable t = e; t != null; t = t.getCause()) {
                    String expected = alternate ? "Conflicting or incomplete native library registration: " + args[1]
                        : "Packaged native library differs from compiled evidence: " + args[1];
                    if (String.valueOf(t.getMessage()).contains(expected)) {
                        System.out.println(alternate ? "independently verified but incompatible owner refused" : "changed owner rejected after a compatible peer loaded"); return;
                    }
                }
                throw e;
            }
        }
        throw new AssertionError("Loaded changed owner bytes");
    }
}
