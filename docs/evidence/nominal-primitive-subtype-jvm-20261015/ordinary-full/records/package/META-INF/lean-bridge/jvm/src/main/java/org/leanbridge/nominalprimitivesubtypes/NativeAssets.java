package org.leanbridge.nominalprimitivesubtypes;

final class NativeAssets {
    private NativeAssets() { }
    static void ensureProcess() { _Assets.ensureProcess(); }
    static java.lang.foreign.SymbolLookup lookup() { return _Assets.lookup(); }
    private static final class _Assets {
    private _Assets() { }
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
        if (name.indexOf('\0') >= 0) throw new java.lang.IllegalArgumentException("Invalid native symbol");
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
            java.lang.String identity = "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf";
            java.lang.String policy = "linux-x64-deepbind-v1";
            java.lang.String component = KEY + "component:nominalprimitivesubtypes@1.0.0";
            java.lang.String receipt = "bba06dea1eecfd4ff27b5a78f9c477d69eb487b8cc26000351d078d68cd653d9";
            if (properties.containsKey(KEY + "failed")) throw new java.lang.IllegalStateException("Lean native loading failed earlier");
            if (properties.containsKey(KEY + "runtime") && !identity.equals(properties.getProperty(KEY + "runtime")))
                throw new java.lang.IllegalStateException("Incompatible Lean runtime identities");
            if (properties.containsKey(KEY + "runtime") && !policy.equals(properties.getProperty(KEY + "policy")))
                throw new java.lang.IllegalStateException("Incompatible Lean native loading policy");
            if (properties.containsKey(component) && !receipt.equals(properties.getProperty(component)))
                throw new java.lang.IllegalStateException("Conflicting builds of the same Lean component");
            properties.setProperty(KEY + "process", java.lang.Integer.toString(PROCESS));
            var hashes = new java.util.LinkedHashMap<java.lang.String, java.lang.String>();
            hashes.put("libcomponent_19ad06f04a0c2d39db76.so", "bef129b9b4fcd3c777a0e001b4e281d03a5b50a37a3f81c47107dfb325a7b0e4");
            hashes.put("liblean_bridge_native.so", "25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7");
            hashes.put("libleanshared.so", "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4");
            hashes.put("libnominalprimitivesubtypes.so", "5a7340edfa2de22cf2f97bdb3378bf2220497c22f9e7740a2ac8f4c8a34cf2fe");
            try {
                // Every package authenticates its own resources, including
                // when an identical component was loaded by another classloader.
                for (var entry : hashes.entrySet()) verifyResource(entry.getKey(), entry.getValue());
                if (properties.containsKey(component)) {
                    var handle = knownHandle(properties, "libnominalprimitivesubtypes.so", hashes.get("libnominalprimitivesubtypes.so"));
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
                for (java.lang.String name : new java.lang.String[] { "libleanshared.so", "liblean_bridge_native.so", "libcomponent_19ad06f04a0c2d39db76.so", "libnominalprimitivesubtypes.so" }) {
                    if (knownHandle(properties, name, hashes.get(name)) != null) continue;
                    verify(root.resolve(name), hashes.get(name));
                    // RTLD_NOW | RTLD_GLOBAL | RTLD_DEEPBIND. Lean and private
                    // GMP must not bind to incompatible earlier host symbols.
                    var handle = open(root.resolve(name).toString(), 2 | 256 | 8);
                    if (handle.address() == 0) throw new java.lang.UnsatisfiedLinkError("Cannot load verified Lean native library: " + name);
                    properties.setProperty(KEY + "library." + name + ".sha256", hashes.get(name));
                    properties.setProperty(KEY + "library." + name + ".path", root.resolve(name).toString());
                }
                var handle = knownHandle(properties, "libnominalprimitivesubtypes.so", hashes.get("libnominalprimitivesubtypes.so"));
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
        return new java.lang.IllegalStateException("Cannot load the prepared Lean component: " + error.getMessage(), error);
    }
    private static java.io.InputStream resource(java.lang.String name) throws java.io.IOException {
        var input = _Assets.class.getResourceAsStream("/META-INF/lean-bridge/native/linux-x64/" + name);
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

    }
}
