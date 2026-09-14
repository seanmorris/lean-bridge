/**
 * Render process-wide, verified native library loading for ordinary JARs.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";

/**
 * Render verified, process-wide native loading for a generated Java package.
 *
 * @param model - Closed Java model.
 * @param evidence - Compiled library identities.
 */
export const copiedJvmAssets = (model, evidence) => `package ${model.namespace};
import java.lang.foreign.*;
import java.nio.file.*;
import java.io.*;
import java.security.*;
import java.util.*;

final class NativeAssets {
    private NativeAssets() { }
    static SymbolLookup lookup() {
        ${!evidence ? 'throw new IllegalStateException("Build a compiled Maven release before calling this API");' : `if (!System.getProperty("os.name").equals("Linux") || !Set.of("amd64", "x86_64").contains(System.getProperty("os.arch")) || java.nio.ByteOrder.nativeOrder() != java.nio.ByteOrder.LITTLE_ENDIAN)
            throw new UnsupportedOperationException("This Lean package requires Linux x86-64");
        var properties = System.getProperties();
        synchronized (properties) {
            String key = "lean.bridge.jvm.native-library-v1.";
            String identity = ${JSON.stringify(evidence.runtimeIdentity)};
            String component = key + ${JSON.stringify(evidence.componentId)};
            String receipt = ${JSON.stringify(sha256(canonicalJson(evidence)))};
            if (properties.containsKey(key + "failed")) throw new IllegalStateException("Lean native loading failed earlier");
            if (properties.containsKey(key + "runtime") && !identity.equals(properties.getProperty(key + "runtime")))
                throw new IllegalStateException("Incompatible Lean runtime identities");
            if (properties.containsKey(component) && !receipt.equals(properties.getProperty(component)))
                throw new IllegalStateException("Conflicting builds of the same Lean component");
            try {
                Path root;
                if (properties.containsKey(component)) {
                    root = Path.of(properties.getProperty(component + ".path"));
${Object.entries(evidence.libraries).map(([name, hash]) => `                    verifyResource(${JSON.stringify(name)}, ${JSON.stringify(hash)});`).join("\n")}
                } else {
                    root = Files.createTempDirectory("lean-bridge-jvm-");
                    root.toFile().deleteOnExit();
${Object.entries(evidence.libraries).map(([name, hash]) => `                    extract(root, ${JSON.stringify(name)}, ${JSON.stringify(hash)});`).join("\n")}
                }
${Object.entries(evidence.libraries).map(([name, hash]) => `                verify(root.resolve(${JSON.stringify(name)}), ${JSON.stringify(hash)});`).join("\n")}
                if (!properties.containsKey(key + "runtime")) {
                    SymbolLookup.libraryLookup(root.resolve("libleanshared.so"), Arena.global());
                    SymbolLookup.libraryLookup(root.resolve("liblean_bridge_native.so"), Arena.global());
                    properties.setProperty(key + "runtime", identity);
                }
                var lookup = SymbolLookup.libraryLookup(root.resolve(${JSON.stringify(evidence.library)}), Arena.global());
                properties.setProperty(component, receipt);
                properties.setProperty(component + ".path", root.toString());
                return lookup;
            } catch (Throwable error) {
                properties.setProperty(key + "failed", "true");
                if (error instanceof Error fatal) throw fatal;
                throw new ExceptionInInitializerError(error);
            }
        }`}
    }
    private static InputStream resource(String name) throws IOException {
        var input = NativeAssets.class.getResourceAsStream("/META-INF/lean-bridge/native/linux-x64/" + name);
        if (input == null) throw new IOException("Missing packaged native asset " + name);
        return input;
    }
    private static String digest(InputStream input) throws IOException {
        try {
            var hash = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[65536];
            for (int count; (count = input.read(buffer)) != -1;) hash.update(buffer, 0, count);
            return HexFormat.of().formatHex(hash.digest());
        } catch (NoSuchAlgorithmException error) { throw new AssertionError(error); }
    }
    private static void verifyResource(String name, String expected) throws IOException {
        try (var input = resource(name)) {
            if (!digest(input).equals(expected)) throw new IOException("Packaged native library differs from compiled evidence: " + name);
        }
    }
    private static void verify(Path path, String expected) throws IOException {
        if (Files.isSymbolicLink(path)) throw new IOException("Native asset must not be a symbolic link");
        try (var input = Files.newInputStream(path)) {
            if (!digest(input).equals(expected)) throw new IOException("Native library differs from compiled evidence: " + path.getFileName());
        }
    }
    private static void extract(Path root, String name, String expected) throws IOException {
        Path target = root.resolve(name);
        target.toFile().deleteOnExit();
        try (var input = resource(name); var output = Files.newOutputStream(target, StandardOpenOption.CREATE_NEW)) { input.transferTo(output); }
        verify(target, expected);
    }
}
`;
