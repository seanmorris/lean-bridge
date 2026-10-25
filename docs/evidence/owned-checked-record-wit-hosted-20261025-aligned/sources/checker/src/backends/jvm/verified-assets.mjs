/**
 * Authenticated process-wide JVM loading with isolated native dependencies.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";

/**
 * Emit members of a private loader shared by owned and copied JVM packages.
 * Keep every verified library loaded while native TLS destructors may reference it.
 *
 * @param evidence - Compiler-authenticated library names and content hashes.
 * @param className - Private Java class used to locate its packaged resources.
 * @param graph - Preserve the recursive API's checked loading error contract.
 */
export const verifiedJvmAssets = (evidence, className, graph = false) => {
	if(!/^_[A-Za-z0-9_]+$/u.test(className)) throw new TypeError("Invalid private JVM asset class");
	if(evidence === null) return `    private ${className}() { }
    static void ensureProcess() { }
    static boolean loaded() { return false; }
    static java.lang.foreign.SymbolLookup lookup() {
        throw new java.lang.IllegalStateException("Build a prepared Maven release before calling this API");
    }
`;
	const libraries = Object.entries(evidence?.libraries ?? {}).sort(([a], [b]) => a.localeCompare(b));
	if(!/^[a-f0-9]{64}$/u.test(evidence?.runtimeIdentity) || !/^[a-f0-9]{64}$/u.test(evidence?.componentReceiptSha256)
		|| typeof evidence?.componentId !== "string" || !evidence.componentId || evidence.componentId.includes("\0")
		|| libraries.length < 3 || libraries.length > 256
		|| ["libleanshared.so", "liblean_bridge_native.so", "libgmp-lean-bridge.so.10"].includes(evidence.library)
		|| !["libleanshared.so", "liblean_bridge_native.so", evidence.library].every(name => libraries.some(([file]) => file === name))
		|| libraries.some(([name, hash]) => !/^lib[A-Za-z0-9_-]+\.so(?:\.\d+)*$/u.test(name) || !/^[a-f0-9]{64}$/u.test(hash))
		|| libraries.some(([name]) => name === "libgmp.so.10"))
		throw new TypeError("Invalid authenticated JVM native library evidence");
	const order = ["libleanshared.so", "liblean_bridge_native.so"];
	if(libraries.some(([name]) => name === "libgmp-lean-bridge.so.10")) order.push("libgmp-lean-bridge.so.10");
	order.push(...libraries.map(([name]) => name).filter(name => !order.includes(name) && name !== evidence.library), evidence.library);
	return `    private ${className}() { }
    private static final java.lang.String KEY = "lean.bridge.jvm.native-library-v1.";
    private static final java.lang.invoke.MethodHandle GETPID = libc("getpid",
        java.lang.foreign.FunctionDescriptor.of(java.lang.foreign.ValueLayout.JAVA_INT));
    private static final java.lang.invoke.MethodHandle OPEN = libc("dlopen",
        java.lang.foreign.FunctionDescriptor.of(java.lang.foreign.ValueLayout.ADDRESS,
            java.lang.foreign.ValueLayout.ADDRESS, java.lang.foreign.ValueLayout.JAVA_INT));
    private static final java.lang.invoke.MethodHandle CLOSE = libc("dlclose",
        java.lang.foreign.FunctionDescriptor.of(java.lang.foreign.ValueLayout.JAVA_INT, java.lang.foreign.ValueLayout.ADDRESS));
    private static final java.lang.invoke.MethodHandle SYMBOL = libc("dlsym",
        java.lang.foreign.FunctionDescriptor.of(java.lang.foreign.ValueLayout.ADDRESS,
            java.lang.foreign.ValueLayout.ADDRESS, java.lang.foreign.ValueLayout.ADDRESS));
    // A cold package inherits the origin of an already loaded peer.
    private static final int PROCESS = origin();
    private static volatile java.lang.foreign.SymbolLookup symbols;
    private static java.lang.invoke.MethodHandle libc(java.lang.String name, java.lang.foreign.FunctionDescriptor descriptor) {
        platform();
        var linker = java.lang.foreign.Linker.nativeLinker();
        return linker.downcallHandle(linker.defaultLookup().find(name).orElseThrow(), descriptor);
    }
    private static void platform() {
        if (!java.lang.System.getProperty("os.name").equals("Linux")
            || !java.util.Set.of("amd64", "x86_64").contains(java.lang.System.getProperty("os.arch"))
            || java.lang.foreign.ValueLayout.ADDRESS.byteSize() != 8
            || java.nio.ByteOrder.nativeOrder() != java.nio.ByteOrder.LITTLE_ENDIAN)
            throw new java.lang.UnsupportedOperationException("This Lean package requires Linux x86-64 with glibc");
    }
    private static int currentProcess() {
        try { return (int)GETPID.invokeExact(); } catch (java.lang.Throwable error) { throw propagate(error); }
    }
    private static int origin() {
        java.lang.String previous = java.lang.System.getProperties().getProperty(KEY + "process");
        return previous == null ? currentProcess() : java.lang.Integer.parseInt(previous);
    }
    static void ensureProcess() {
        if (PROCESS != currentProcess())
            throw new java.lang.IllegalStateException("Lean calls after fork require a fresh process");
        java.lang.String origin = java.lang.System.getProperties().getProperty(KEY + "process");
        if (origin != null && !origin.equals(java.lang.Integer.toString(PROCESS)))
            throw new java.lang.IllegalStateException("Lean runtime process origin differs; start a fresh process");
    }
    static boolean loaded() { ensureProcess(); return symbols != null; }
    private static java.lang.foreign.MemorySegment open(java.lang.String path, int flags) {
        try (var arena = java.lang.foreign.Arena.ofConfined()) {
            return (java.lang.foreign.MemorySegment)OPEN.invokeExact(arena.allocateFrom(path), flags);
        } catch (java.lang.Throwable error) { throw propagate(error); }
    }
    private static void closeProbe(java.lang.foreign.MemorySegment handle) {
        try { int ignored = (int)CLOSE.invokeExact(handle); }
        catch (java.lang.Throwable error) { throw propagate(error); }
    }
    private static java.util.Optional<java.lang.foreign.MemorySegment> find(java.lang.foreign.MemorySegment handle, java.lang.String name) {
        if (name.indexOf('\\0') >= 0) throw new java.lang.IllegalArgumentException("Invalid native symbol");
        try (var arena = java.lang.foreign.Arena.ofConfined()) {
            var pointer = (java.lang.foreign.MemorySegment)SYMBOL.invokeExact(handle, arena.allocateFrom(name));
            return pointer.address() == 0 ? java.util.Optional.empty() : java.util.Optional.of(pointer);
        } catch (java.lang.Throwable error) { throw propagate(error); }
    }
    static java.lang.foreign.SymbolLookup lookup() {
        ensureProcess(); var ready = symbols; if (ready != null) return ready;
        var properties = java.lang.System.getProperties();
        synchronized (properties) {
            ensureProcess(); ready = symbols; if (ready != null) return ready;
            java.lang.String identity = ${JSON.stringify(evidence.runtimeIdentity)};
            java.lang.String policy = "linux-x64-deepbind-v1";
            java.lang.String component = KEY + ${JSON.stringify("component:" + evidence.componentId)};
            java.lang.String receipt = ${JSON.stringify(sha256(canonicalJson(evidence)))};
            if (properties.containsKey(KEY + "failed")) throw new java.lang.IllegalStateException("Lean native loading failed earlier");
            if (properties.containsKey(KEY + "runtime") && !identity.equals(properties.getProperty(KEY + "runtime")))
                throw new java.lang.IllegalStateException("Incompatible Lean runtime identities");
            if (properties.containsKey(KEY + "runtime") && !policy.equals(properties.getProperty(KEY + "policy")))
                throw new java.lang.IllegalStateException("Incompatible Lean native loading policy");
            if (properties.containsKey(component) && !receipt.equals(properties.getProperty(component)))
                throw new java.lang.IllegalStateException("Conflicting builds of the same Lean component");
            properties.setProperty(KEY + "process", java.lang.Integer.toString(PROCESS));
            var hashes = new java.util.LinkedHashMap<java.lang.String, java.lang.String>();
${libraries.map(([name, hash]) => `            hashes.put(${JSON.stringify(name)}, ${JSON.stringify(hash)});`).join("\n")}
            try {
                // Every package authenticates its own resources, including
                // when an identical component was loaded by another classloader.
                for (var entry : hashes.entrySet()) verifyResource(entry.getKey(), entry.getValue());
                if (properties.containsKey(component)) {
                    var handle = knownHandle(properties, ${JSON.stringify(evidence.library)}, hashes.get(${JSON.stringify(evidence.library)}));
                    if (handle == null) throw new java.lang.IllegalStateException("Incomplete native component registration");
                    ready = name -> find(handle, name); symbols = ready; return ready;
                }
                var root = java.nio.file.Files.createTempDirectory("lean-bridge-jvm-");
                root.toFile().deleteOnExit();
                if (!java.nio.file.Files.isDirectory(root, java.nio.file.LinkOption.NOFOLLOW_LINKS))
                    throw new java.io.IOException("Native asset root must be a regular directory");
                for (var entry : hashes.entrySet()) extract(root, entry.getKey(), entry.getValue());
                for (var entry : hashes.entrySet()) {
                    if (knownHandle(properties, entry.getKey(), entry.getValue()) != null) continue;
                    for (var candidate : new java.lang.String[] { entry.getKey(), root.resolve(entry.getKey()).toString() }) {
                        var prior = open(candidate, 2 | 4); // RTLD_NOW | RTLD_NOLOAD
                        if (prior.address() == 0) continue;
                        closeProbe(prior);
                        throw new java.lang.IllegalStateException("Unverified native library is already loaded: " + entry.getKey());
                    }
                }
                for (java.lang.String name : new java.lang.String[] { ${order.map(name => JSON.stringify(name)).join(", ")} }) {
                    if (knownHandle(properties, name, hashes.get(name)) != null) continue;
                    verify(root.resolve(name), hashes.get(name));
                    // RTLD_NOW | RTLD_GLOBAL | RTLD_DEEPBIND. Lean and private
                    // GMP must not bind to incompatible earlier host symbols.
                    var handle = open(root.resolve(name).toString(), 2 | 256 | 8);
                    if (handle.address() == 0) throw new java.lang.UnsatisfiedLinkError("Cannot load verified Lean native library: " + name);
                    properties.setProperty(KEY + "library." + name + ".sha256", hashes.get(name));
                    properties.setProperty(KEY + "library." + name + ".path", root.resolve(name).toString());
                }
                var handle = knownHandle(properties, ${JSON.stringify(evidence.library)}, hashes.get(${JSON.stringify(evidence.library)}));
                if (handle == null) throw new java.lang.IllegalStateException("Native component was not loaded");
                ready = name -> find(handle, name);
                properties.setProperty(KEY + "runtime", identity); properties.setProperty(KEY + "policy", policy);
                properties.setProperty(component, receipt); properties.setProperty(component + ".path", root.toString());
                symbols = ready; return ready;
            } catch (java.lang.Throwable error) {
                properties.setProperty(KEY + "failed", "true"); throw propagate(error);
            }
        }
    }
    private static java.lang.foreign.MemorySegment knownHandle(java.util.Properties properties, java.lang.String name, java.lang.String hash) {
        java.lang.String key = KEY + "library." + name;
        java.lang.Object oldHash = properties.get(key + ".sha256"), oldPath = properties.get(key + ".path");
        if (oldHash == null && oldPath == null) return null;
        if (!hash.equals(oldHash) || !(oldPath instanceof java.lang.String path) || !java.nio.file.Path.of(path).isAbsolute())
            throw new java.lang.IllegalStateException("Conflicting or incomplete native library registration: " + name);
        var handle = open(path, 2 | 4); // RTLD_NOW | RTLD_NOLOAD
        if (handle.address() == 0)
            throw new java.lang.IllegalStateException("Registered native library is no longer loaded: " + name);
        // Balance this probe. The original dlopen reference stays pinned.
        // Store only strings in system properties, never native Java objects.
        closeProbe(handle);
        return handle;
    }
    private static java.lang.RuntimeException propagate(java.lang.Throwable error) {
        if (error instanceof java.lang.RuntimeException failure) return failure;
        if (error instanceof java.lang.Error fatal) throw fatal;
        return ${graph ? 'new LeanBridgeException(4, "Cannot load or call the prepared Lean component", error)' : 'new java.lang.IllegalStateException("Cannot load the prepared Lean component: " + error.getMessage(), error)'};
    }
    private static java.io.InputStream resource(java.lang.String name) throws java.io.IOException {
        var input = ${className}.class.getResourceAsStream("/META-INF/lean-bridge/native/linux-x64/" + name);
        if (input == null) throw new java.io.IOException("Missing packaged native asset " + name);
        return input;
    }
    private static java.lang.String digest(java.io.InputStream input) throws java.io.IOException {
        try {
            var hash = java.security.MessageDigest.getInstance("SHA-256"); byte[] buffer = new byte[65536];
            for (int count; (count = input.read(buffer)) != -1;) hash.update(buffer, 0, count);
            return java.util.HexFormat.of().formatHex(hash.digest());
        } catch (java.security.NoSuchAlgorithmException error) { throw new java.lang.AssertionError(error); }
    }
    private static void verifyResource(java.lang.String name, java.lang.String expected) throws java.io.IOException {
        try (var input = resource(name)) {
            if (!digest(input).equals(expected)) throw new java.io.IOException("Packaged native library differs from compiled evidence: " + name);
        }
    }
    private static void verify(java.nio.file.Path path, java.lang.String expected) throws java.io.IOException {
        if (!java.nio.file.Files.isRegularFile(path, java.nio.file.LinkOption.NOFOLLOW_LINKS))
            throw new java.io.IOException("Native asset must be a regular file");
        try (var input = java.nio.file.Files.newInputStream(path, java.nio.file.LinkOption.NOFOLLOW_LINKS)) {
            if (!digest(input).equals(expected)) throw new java.io.IOException("Native library differs from compiled evidence: " + path.getFileName());
        }
    }
    private static void extract(java.nio.file.Path root, java.lang.String name, java.lang.String expected) throws java.io.IOException {
        var path = root.resolve(name); path.toFile().deleteOnExit();
        try (var input = resource(name);
             var output = java.nio.file.Files.newOutputStream(path, java.nio.file.StandardOpenOption.CREATE_NEW)) {
            input.transferTo(output);
        }
        verify(path, expected);
    }
`;
};
