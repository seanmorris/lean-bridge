import java.math.BigInteger;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.TreeMap;
import java.util.TreeSet;

public final class OwnedInstalledAssetsProbe {
    private OwnedInstalledAssetsProbe() { }

    private static TreeMap<String, String> mappings() throws Exception {
        var paths = new TreeSet<String>();
        String prefix = System.getProperty("java.io.tmpdir") + "/lean-bridge-jvm-";
        for (String line : Files.readAllLines(Path.of("/proc/self/maps"))) {
            String path = line.substring(line.lastIndexOf(' ') + 1);
            if (path.startsWith(prefix) && path.matches(".*\\.so(?:\\.[0-9]+)*")) paths.add(path);
        }
        var result = new TreeMap<String, String>();
        for (String name : paths) {
            var path = Path.of(name);
            var digest = MessageDigest.getInstance("SHA-256");
            try (var stream = Files.newInputStream(path)) {
                byte[] buffer = new byte[65536];
                for (int count; (count = stream.read(buffer)) != -1;) digest.update(buffer, 0, count);
            }
            Wire.check(result.put(path.getFileName().toString(), HexFormat.of().formatHex(digest.digest())) == null);
        }
        return result;
    }

    private static URLClassLoader loader(String archive, String stdlib) throws Exception {
        return new URLClassLoader(new URL[] { Path.of(archive).toUri().toURL(), Path.of(stdlib).toUri().toURL() },
            ClassLoader.getPlatformClassLoader());
    }

    private static void call(ClassLoader loader, String namespace) throws Exception {
        var api = Class.forName(namespace + ".Api", true, loader);
        var create = api.getMethod("newTicket", BigInteger.class, String.class);
        var ticketType = create.getReturnType();
        Object ticket = create.invoke(null, BigInteger.valueOf(42), "installed");
        try {
            Wire.check(api.getMethod("serial", ticketType).invoke(null, ticket).equals(BigInteger.valueOf(42)));
        } finally {
            ((AutoCloseable) ticket).close();
        }
    }

    public static void main(String[] args) throws Exception {
        String namespace = args[0], profile = args[1], mode = args[2], expected = args[6];
        boolean warm = mode.equals("warm");
        String family = namespace + (profile.equals("kotlin") ? ".kotlin" : "");
        try (var original = loader(args[3], args[5]); var changed = loader(args[4], args[5])) {
            if (warm) call(original, family);
            var before = mappings();
            Wire.check(warm ? before.size() == 5 : before.isEmpty());
            Throwable rejected = null;
            try { call(changed, family); } catch (Throwable failure) { rejected = failure; }
            Wire.check(rejected != null);
            var chain = new StringBuilder();
            for (Throwable failure = rejected; failure != null; failure = failure.getCause())
                chain.append(failure.getClass().getName()).append(": ").append(failure.getMessage()).append('\n');
            if (!chain.toString().contains(expected))
                throw new AssertionError("Expected " + expected + ", observed " + chain);
            Wire.check(mappings().equals(before));
            if (warm) {
                call(original, family);
                Wire.check(mappings().equals(before));
            }
            System.out.println(Wire.json(Wire.map("profile", profile, "mode", mode,
                "rejected", true, "diagnostic", chain.toString(), "nativeLibraries", before,
                "noAdditionalNativeMappings", true, "existingPackageUsable", warm)));
        }
    }
}
