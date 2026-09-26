/**
 * Authenticated, lazy native loading for both recursive JVM value projections.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";

/**
 * Use the existing process-wide JVM registry and keep FFM names private.
 *
 * @param model - Validated recursive package model.
 * @param evidence - Verified native asset identities, or null for inspection.
 * @param callable - Resolve graph callback entry points and generation-checked tokens.
 */
export const jvmGraphAssets = (model, evidence, callable = false) => {
	const className = callable ? "_CallableGraphNative" : "_GraphNative";
	const resultType = callable ? "Links" : "_GraphRuntime.Target[]";
	const links = callable ? "    record Links(java.lang.invoke.MethodHandle[] exports, java.lang.invoke.MethodHandle[] invokes,\n        java.lang.invoke.MethodHandle[] drops, java.lang.invoke.MethodHandle clear, _GraphRuntime.Lifecycle lifecycle) { }\n" : "";
	const address = "java.lang.foreign.ValueLayout.ADDRESS", long = "java.lang.foreign.ValueLayout.JAVA_LONG";
	const descriptor = (arity, lease = false) => "java.lang.foreign.FunctionDescriptor.of(java.lang.foreign.ValueLayout.JAVA_INT, " + [...lease ? [long] : [], ...Array(arity + 1).fill(address)].join(", ") + ")";
	const lookup = (symbol, desc) => "downcall(lookup, " + JSON.stringify(symbol) + ", " + desc + ")";
	const array = items => "new java.lang.invoke.MethodHandle[] { " + items.join(", ") + " }";
	const resolved = callable ? "                var resolved = new Links("
		+ array(model.functions.map(fn => lookup(fn.native, descriptor(fn.parameters.length)))) + ", "
		+ array([...model.callbacks.values()].map(cb => lookup(cb.call, descriptor(cb.parameters.length, true)))) + ", "
		+ array([...model.callbacks.values()].map(cb => lookup(cb.dispose, "java.lang.foreign.FunctionDescriptor.ofVoid(" + long + ")")))
		+ ", clear, lifecycle);" : `                var resolved = new _GraphRuntime.Target[${model.functions.length}];
${model.functions.map((fn, index) => `                resolved[${index}] = new _GraphRuntime.Target(downcall(lookup, "${fn.name}_graph", java.lang.foreign.FunctionDescriptor.of(java.lang.foreign.ValueLayout.JAVA_INT, ${Array.from({ length: fn.parameters.length + 1 }, () => "java.lang.foreign.ValueLayout.ADDRESS").join(", ")})), clear, lifecycle);`).join("\n")}`;
	if(evidence === null) return `package ${model.namespace};
final class ${className} {
${links}    private ${className}() { }
    static boolean loaded() { return false; }
    static ${resultType} resolve() { throw new IllegalStateException("Build a prepared Maven release before calling this API"); }
}
`;
	if(evidence.componentId !== model.ir.component.id || evidence.library !== `lib${model.prefix}.so`
		|| !/^[a-f0-9]{64}$/.test(evidence.runtimeIdentity) || !/^[a-f0-9]{64}$/.test(evidence.componentReceiptSha256)
		|| !evidence.libraries || typeof evidence.libraries !== "object" || Array.isArray(evidence.libraries))
		throw new TypeError("JVM graph loading evidence differs from the component");
	const libraries = Object.entries(evidence.libraries).sort(([a], [b]) => a.localeCompare(b));
	if(libraries.length < 4 || libraries.some(([name, hash]) => !/^lib[A-Za-z0-9_.-]+\.so(?:\.\d+)*$/.test(name) || !/^[a-f0-9]{64}$/.test(hash))
		|| [evidence.library, "libleanshared.so", "liblean_bridge_native.so"].some(name => !Object.hasOwn(evidence.libraries, name)))
		throw new TypeError("JVM graph loading requires exact native asset identities");
	return `package ${model.namespace};

final class ${className} {
${links}    private ${className}() { }
    private static volatile ${resultType} targets;
    static boolean loaded() { return targets != null; }
    static ${resultType} resolve() {
        var ready = targets; if (ready != null) return ready;
        if (!System.getProperty("os.name").equals("Linux") || !java.util.Set.of("amd64", "x86_64").contains(System.getProperty("os.arch"))
            || java.nio.ByteOrder.nativeOrder() != java.nio.ByteOrder.LITTLE_ENDIAN)
            throw new java.lang.UnsupportedOperationException("This Lean package requires Linux x86-64 with glibc");
        var properties = System.getProperties();
        synchronized (properties) {
            ready = targets; if (ready != null) return ready;
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
                java.nio.file.Path root;
                if (properties.containsKey(component)) {
                    root = java.nio.file.Path.of(properties.getProperty(component + ".path"));
${libraries.map(([name, hash]) => `                    verifyResource(${JSON.stringify(name)}, ${JSON.stringify(hash)});`).join("\n")}
                } else {
                    root = java.nio.file.Files.createTempDirectory("lean-bridge-jvm-"); root.toFile().deleteOnExit();
${libraries.map(([name, hash]) => `                    extract(root, ${JSON.stringify(name)}, ${JSON.stringify(hash)});`).join("\n")}
                }
${libraries.map(([name, hash]) => `                verify(root.resolve(${JSON.stringify(name)}), ${JSON.stringify(hash)});`).join("\n")}
                if (!properties.containsKey(key + "runtime")) {
                    java.lang.foreign.SymbolLookup.libraryLookup(root.resolve("libleanshared.so"), java.lang.foreign.Arena.global());
                    java.lang.foreign.SymbolLookup.libraryLookup(root.resolve("liblean_bridge_native.so"), java.lang.foreign.Arena.global());
                    properties.setProperty(key + "runtime", identity);
                }
                var lookup = java.lang.foreign.SymbolLookup.libraryLookup(root.resolve(${JSON.stringify(evidence.library)}), java.lang.foreign.Arena.global());
                var clear = downcall(lookup, ${JSON.stringify(model.nativeReleaseSymbol)}, java.lang.foreign.FunctionDescriptor.ofVoid(java.lang.foreign.ValueLayout.ADDRESS));
                var initialize = downcall(lookup, "${model.prefix}_graph_initialize", java.lang.foreign.FunctionDescriptor.of(java.lang.foreign.ValueLayout.JAVA_INT));
                var available = downcall(lookup, "${model.prefix}_graph_ready", java.lang.foreign.FunctionDescriptor.of(java.lang.foreign.ValueLayout.JAVA_INT));
                var retire = downcall(lookup, "${model.prefix}_graph_retire", java.lang.foreign.FunctionDescriptor.ofVoid());
                var lifecycle = new _GraphRuntime.Lifecycle() {
                    public void before() { try { _GraphRuntime.status((int)initialize.invokeExact()); } catch (Throwable error) { throw propagate(error); } }
                    public void after() { try { if ((int)available.invokeExact() != 1) _GraphRuntime.status(5); } catch (Throwable error) { throw propagate(error); } }
                    public void poison() { try { retire.invokeExact(); } catch (Throwable error) { throw propagate(error); } }
                };
${resolved}
                properties.setProperty(component, receipt); properties.setProperty(component + ".path", root.toString());
                targets = resolved; return resolved;
            } catch (Throwable error) {
                properties.setProperty(key + "failed", "true"); throw propagate(error);
            }
        }
    }
    private static java.lang.invoke.MethodHandle downcall(java.lang.foreign.SymbolLookup lookup, String name, java.lang.foreign.FunctionDescriptor descriptor) {
        return java.lang.foreign.Linker.nativeLinker().downcallHandle(lookup.find(name).orElseThrow(), descriptor);
    }
    private static RuntimeException propagate(Throwable error) {
        if (error instanceof RuntimeException runtime) return runtime;
        if (error instanceof Error fatal) throw fatal;
        return new LeanBridgeException(4, "Cannot load or call the prepared Lean component", error);
    }
    private static java.io.InputStream resource(String name) throws java.io.IOException {
        var input = ${className}.class.getResourceAsStream("/META-INF/lean-bridge/native/linux-x64/" + name);
        if (input == null) throw new java.io.IOException("Missing packaged native asset " + name);
        return input;
    }
    private static String digest(java.io.InputStream input) throws java.io.IOException {
        try {
            var hash = java.security.MessageDigest.getInstance("SHA-256"); byte[] buffer = new byte[65536];
            for (int count; (count = input.read(buffer)) != -1;) hash.update(buffer, 0, count);
            return java.util.HexFormat.of().formatHex(hash.digest());
        } catch (java.security.NoSuchAlgorithmException error) { throw new java.lang.AssertionError(error); }
    }
    private static void verifyResource(String name, String expected) throws java.io.IOException {
        try (var input = resource(name)) { if (!digest(input).equals(expected)) throw new java.io.IOException("Packaged native library differs from compiled evidence: " + name); }
    }
    private static void verify(java.nio.file.Path path, String expected) throws java.io.IOException {
        if (java.nio.file.Files.isSymbolicLink(path)) throw new java.io.IOException("Native asset must not be a symbolic link");
        try (var input = java.nio.file.Files.newInputStream(path)) {
            if (!digest(input).equals(expected)) throw new java.io.IOException("Native library differs from compiled evidence: " + path.getFileName());
        }
    }
    private static void extract(java.nio.file.Path root, String name, String expected) throws java.io.IOException {
        var target = root.resolve(name); target.toFile().deleteOnExit();
        try (var input = resource(name); var output = java.nio.file.Files.newOutputStream(target, java.nio.file.StandardOpenOption.CREATE_NEW)) { input.transferTo(output); }
        verify(target, expected);
    }
}
`;
};
