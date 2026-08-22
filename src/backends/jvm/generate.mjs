/**
 * Implements the generate module in the JVM backend.
 *
 * @file
 */

import { compileManagedAlphaModel, managedBindingManifest } from "../managed/alpha-model.mjs";
import { auditManagedBindingPackage } from "../managed/package-audit.mjs";

const publicSources = model => ({
	"src/main/java/org/leanbridge/alpha/Payload.java": `package org.leanbridge.alpha;

import java.util.Objects;

/** A copied Lean value with explicit primitive mappings. */
public record Payload(boolean enabled, long count, String label, byte[] bytes, long[] values) {
    public Payload {
        if (count < 0 || count > 0xffff_ffffL) throw new IllegalArgumentException("count must be uint32");
        Objects.requireNonNull(label, "label");
        bytes = Objects.requireNonNull(bytes, "bytes").clone();
        values = Objects.requireNonNull(values, "values").clone();
        for (long value : values) if (value < 0 || value > 0xffff_ffffL) throw new IllegalArgumentException("values must contain uint32 values");
    }
    @Override public byte[] bytes() { return bytes.clone(); }
    @Override public long[] values() { return values.clone(); }
}
`
	, "src/main/java/org/leanbridge/alpha/Transform.java": `package org.leanbridge.alpha;

/** A synchronous host or Lean transform. */
@FunctionalInterface
public interface Transform {
    long apply(long value);
}
`
	, "src/main/java/org/leanbridge/alpha/LeanBridgeException.java": `package org.leanbridge.alpha;

public class LeanBridgeException extends RuntimeException {
    LeanBridgeException(String message) { super(message); }
    LeanBridgeException(String message, Throwable cause) { super(message, cause); }
}
`
	, "src/main/java/org/leanbridge/alpha/DisposedResourceException.java": `package org.leanbridge.alpha;

public final class DisposedResourceException extends LeanBridgeException {
    DisposedResourceException(String message) { super(message); }
}
`
	, "src/main/java/org/leanbridge/alpha/CallbackThrewException.java": `package org.leanbridge.alpha;

public final class CallbackThrewException extends LeanBridgeException {
    CallbackThrewException(String message, Throwable cause) { super(message, cause); }
}
`
	, "src/main/java/org/leanbridge/alpha/Box.java": `package org.leanbridge.alpha;

/** An identity-bearing Lean Box owned by this wrapper. */
public final class Box implements AutoCloseable {
    private final Runtime.BoxState state;
    public Box(long value) { state = new Runtime.BoxState(this, Runtime.createBox(value)); }
    public long read() { return Runtime.readBox(state); }
    public Box identity() { Runtime.verifyIdentity(state); return this; }
    Runtime.BoxState compositionState() { return state; }
    @Override public void close() { state.close(); }
}
`
	, "src/main/java/org/leanbridge/alpha/OwnedTransform.java": `package org.leanbridge.alpha;

/** An owned callable returned by Lean. */
public final class OwnedTransform implements AutoCloseable {
    private final Runtime.TransformState state;
    OwnedTransform(Runtime.TransformAddress address) { state = new Runtime.TransformState(this, address); }
    public long apply(long value) { return Runtime.callTransform(state, value); }
    @Override public void close() { state.close(); }
}
`
	, "src/main/java/org/leanbridge/alpha/Alpha.java": `package org.leanbridge.alpha;

/** Direct functions exported by ${model.component.name}. */
public final class Alpha {
    private Alpha() { }
    public static Payload roundTrip(Payload payload) { return Runtime.roundTrip(payload); }
    public static long withCallback(long value, Transform transform) { return Runtime.withCallback(value, transform); }
    public static OwnedTransform makeAdder(long base) { return new OwnedTransform(Runtime.makeAdder(base)); }
}
`
});

const runtimeSource = () => `package org.leanbridge.alpha;

import static java.lang.foreign.ValueLayout.ADDRESS;
import static java.lang.foreign.ValueLayout.JAVA_BYTE;
import static java.lang.foreign.ValueLayout.JAVA_INT;
import static java.lang.foreign.ValueLayout.JAVA_LONG;

import java.io.IOException;
import java.io.InputStream;
import java.lang.foreign.Arena;
import java.lang.foreign.FunctionDescriptor;
import java.lang.foreign.Linker;
import java.lang.foreign.MemorySegment;
import java.lang.foreign.SymbolLookup;
import java.lang.invoke.MethodHandle;
import java.lang.invoke.MethodHandles;
import java.lang.invoke.MethodType;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import java.lang.ref.Cleaner;

final class Runtime {
    private static final long ERROR_SIZE = 24;
    private static final long PAYLOAD_SIZE = 104;
    private static final Linker LINKER = Linker.nativeLinker();
    private static final SymbolLookup LOOKUP = NativeAssets.lookup();
    private static final Cleaner CLEANER = Cleaner.create();

    private static final MethodHandle BOX_CREATE = downcall("lean_alpha_box_create", FunctionDescriptor.of(JAVA_INT, JAVA_INT, ADDRESS, ADDRESS));
    private static final MethodHandle SNAPSHOT_READ = downcall("lean_bridge_native_snapshot_read", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle BOX_READ = downcall("lean_alpha_box_read", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle BOX_IDENTITY = downcall("lean_alpha_box_identity", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle COMPOSITION_READ = downcall("lean_beta_composition_read", FunctionDescriptor.of(JAVA_INT, ADDRESS));
    private static final MethodHandle ROUND_TRIP = downcall("lean_alpha_round_trip", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle WITH_CALLBACK = downcall("lean_alpha_with_callback", FunctionDescriptor.of(JAVA_INT, JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
    private static final MethodHandle MAKE_ADDER = downcall("lean_alpha_make_adder", FunctionDescriptor.of(JAVA_INT, JAVA_INT, ADDRESS, ADDRESS));
    private static final MethodHandle TRANSFORM_CALL = downcall("lean_alpha_owned_transform_call", FunctionDescriptor.of(JAVA_INT, ADDRESS, JAVA_INT, ADDRESS, ADDRESS));
    private static final MethodHandle BOX_DISPOSE = downcall("lean_alpha_box_dispose", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle TRANSFORM_DISPOSE = downcall("lean_alpha_owned_transform_dispose", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle PAYLOAD_CLEAR = downcall("lean_alpha_payload_clear", FunctionDescriptor.ofVoid(ADDRESS));
    private static final FunctionDescriptor CALLBACK_DESCRIPTOR = FunctionDescriptor.of(JAVA_INT, ADDRESS, JAVA_INT, ADDRESS, ADDRESS);
    private static final MethodHandle CALLBACK;

    static {
        try {
            CALLBACK = MethodHandles.lookup().findStatic(Runtime.class, "invokeCallback", MethodType.methodType(int.class, CallbackState.class, MemorySegment.class, int.class, MemorySegment.class, MemorySegment.class));
        } catch (ReflectiveOperationException exception) {
            throw new ExceptionInInitializerError(exception);
        }
    }

    private Runtime() { }

    record TransformAddress(MemorySegment value) { }
    record Snapshot(int runtimeInitRuns, int componentInitRuns, int attachedComponents, int liveIdentities, long runtimeInstanceId, long identityDomainId) { }

    static Snapshot snapshot() {
        try (Arena arena = Arena.ofConfined()) {
            MemorySegment value = arena.allocate(40, 8);
            SNAPSHOT_READ.invokeExact(value);
            return new Snapshot(
                value.get(JAVA_INT, 8), value.get(JAVA_INT, 12), value.get(JAVA_INT, 16), value.get(JAVA_INT, 20),
                value.get(JAVA_LONG, 24), value.get(JAVA_LONG, 32));
        } catch (Throwable throwable) { throw propagate(throwable); }
    }

    private static final class ResourceCleanup implements Runnable {
        private MemorySegment value;
        private final MethodHandle dispose;
        ResourceCleanup(MemorySegment value, MethodHandle dispose) { this.value = value; this.dispose = dispose; }
        synchronized MemorySegment require(String name) {
            if (value.equals(MemorySegment.NULL)) throw new DisposedResourceException(name + " is closed");
            return value;
        }
        @Override public synchronized void run() {
            if (value.equals(MemorySegment.NULL)) return;
            try (Arena arena = Arena.ofConfined()) {
                MemorySegment pointer = arena.allocate(ADDRESS);
                pointer.set(ADDRESS, 0, value);
                dispose.invokeExact(pointer);
                value = MemorySegment.NULL;
            } catch (Throwable throwable) {
                throw propagate(throwable);
            }
        }
    }

    static final class BoxState implements AutoCloseable {
        private final ResourceCleanup cleanup;
        private final Cleaner.Cleanable cleanable;
        BoxState(Object owner, MemorySegment value) { cleanup = new ResourceCleanup(value, BOX_DISPOSE); cleanable = CLEANER.register(owner, cleanup); }
        MemorySegment require() { return cleanup.require("Box"); }
        @Override public void close() { cleanable.clean(); }
    }

    static final class TransformState implements AutoCloseable {
        private final ResourceCleanup cleanup;
        private final Cleaner.Cleanable cleanable;
        TransformState(Object owner, TransformAddress address) { cleanup = new ResourceCleanup(address.value(), TRANSFORM_DISPOSE); cleanable = CLEANER.register(owner, cleanup); }
        MemorySegment require() { return cleanup.require("Transform"); }
        @Override public void close() { cleanable.clean(); }
    }

    private static final class CallbackState {
        final Transform transform;
        final Arena arena;
        Throwable failure;
        CallbackState(Transform transform, Arena arena) { this.transform = transform; this.arena = arena; }
    }

    static MemorySegment createBox(long value) {
        int nativeValue = uint32(value, "value");
        try (Arena arena = Arena.ofConfined()) {
            MemorySegment output = arena.allocate(ADDRESS);
            MemorySegment error = error(arena);
            int status = (int) BOX_CREATE.invokeExact(nativeValue, output, error);
            check(status, error, null);
            return output.get(ADDRESS, 0);
        } catch (Throwable throwable) { throw propagate(throwable); }
    }

    static long readBox(BoxState box) {
        try (Arena arena = Arena.ofConfined()) {
            MemorySegment output = arena.allocate(JAVA_INT);
            MemorySegment error = error(arena);
            int status = (int) BOX_READ.invokeExact(box.require(), output, error);
            check(status, error, null);
            return Integer.toUnsignedLong(output.get(JAVA_INT, 0));
        } catch (Throwable throwable) { throw propagate(throwable); }
    }

    static void verifyIdentity(BoxState box) {
        MemorySegment expected = box.require();
        try (Arena arena = Arena.ofConfined()) {
            MemorySegment output = arena.allocate(ADDRESS);
            MemorySegment error = error(arena);
            int status = (int) BOX_IDENTITY.invokeExact(expected, output, error);
            check(status, error, null);
            if (output.get(ADDRESS, 0).address() != expected.address()) throw new LeanBridgeException("Lean returned a different Box identity");
        } catch (Throwable throwable) { throw propagate(throwable); }
    }

    static long compositionRead(Box box) {
        try {
            int value = (int) COMPOSITION_READ.invokeExact(box.compositionState().require());
            return Integer.toUnsignedLong(value);
        } catch (Throwable throwable) { throw propagate(throwable); }
    }

    static Payload roundTrip(Payload payload) {
        Objects.requireNonNull(payload, "payload");
        try (Arena arena = Arena.ofConfined()) {
            MemorySegment input = arena.allocate(PAYLOAD_SIZE, 8);
            MemorySegment label = arena.allocateFrom(payload.label());
            byte[] bytesValue = payload.bytes();
            MemorySegment bytes = bytesValue.length == 0 ? MemorySegment.NULL : arena.allocateFrom(JAVA_BYTE, bytesValue);
            long[] valuesValue = payload.values();
            MemorySegment values = valuesValue.length == 0 ? MemorySegment.NULL : arena.allocate(JAVA_INT, valuesValue.length);
            for (int index = 0; index < valuesValue.length; index++) values.setAtIndex(JAVA_INT, index, uint32(valuesValue[index], "values[" + index + "]"));
            input.set(JAVA_BYTE, 0, payload.enabled() ? (byte) 1 : (byte) 0);
            input.set(JAVA_INT, 4, uint32(payload.count(), "count"));
            writeSlice(input, 8, label, payload.label().getBytes(StandardCharsets.UTF_8).length);
            writeSlice(input, 40, bytes, bytesValue.length);
            writeSlice(input, 72, values, valuesValue.length);
            MemorySegment output = arena.allocate(PAYLOAD_SIZE, 8);
            MemorySegment error = error(arena);
            int status = (int) ROUND_TRIP.invokeExact(input, output, error);
            check(status, error, null);
            try {
                String outputLabel = new String(readBytes(output, 8), StandardCharsets.UTF_8);
                byte[] outputBytes = readBytes(output, 40);
                long[] outputValues = readUInt32s(output, 72);
                return new Payload(output.get(JAVA_BYTE, 0) != 0, Integer.toUnsignedLong(output.get(JAVA_INT, 4)), outputLabel, outputBytes, outputValues);
            } finally {
                PAYLOAD_CLEAR.invokeExact(output);
            }
        } catch (Throwable throwable) { throw propagate(throwable); }
    }

    static long withCallback(long value, Transform transform) {
        Objects.requireNonNull(transform, "transform");
        try (Arena arena = Arena.ofConfined()) {
            CallbackState callback = new CallbackState(transform, arena);
            MethodHandle target = MethodHandles.insertArguments(CALLBACK, 0, callback);
            MemorySegment stub = LINKER.upcallStub(target, CALLBACK_DESCRIPTOR, arena);
            MemorySegment descriptor = arena.allocate(16, 8);
            descriptor.set(ADDRESS, 0, stub);
            descriptor.set(ADDRESS, 8, MemorySegment.NULL);
            MemorySegment output = arena.allocate(JAVA_INT);
            MemorySegment error = error(arena);
            int status = (int) WITH_CALLBACK.invokeExact(uint32(value, "value"), descriptor, output, error);
            check(status, error, callback.failure);
            return Integer.toUnsignedLong(output.get(JAVA_INT, 0));
        } catch (Throwable throwable) { throw propagate(throwable); }
    }

    private static int invokeCallback(CallbackState state, MemorySegment context, int value, MemorySegment output, MemorySegment error) {
        try {
            long result = state.transform.apply(Integer.toUnsignedLong(value));
            output.reinterpret(4).set(JAVA_INT, 0, uint32(result, "callback result"));
            return 0;
        } catch (Throwable throwable) {
            state.failure = throwable;
            MemorySegment message = state.arena.allocateFrom(throwable.getMessage() == null ? throwable.getClass().getName() : throwable.getMessage());
            MemorySegment writable = error.reinterpret(ERROR_SIZE);
            writable.set(JAVA_INT, 0, 101);
            writable.set(ADDRESS, 8, message);
            writable.set(JAVA_LONG, 16, message.byteSize() - 1);
            return 4;
        }
    }

    static TransformAddress makeAdder(long value) {
        try (Arena arena = Arena.ofConfined()) {
            MemorySegment output = arena.allocate(ADDRESS);
            MemorySegment error = error(arena);
            int status = (int) MAKE_ADDER.invokeExact(uint32(value, "base"), output, error);
            check(status, error, null);
            return new TransformAddress(output.get(ADDRESS, 0));
        } catch (Throwable throwable) { throw propagate(throwable); }
    }

    static long callTransform(TransformState transform, long value) {
        try (Arena arena = Arena.ofConfined()) {
            MemorySegment output = arena.allocate(JAVA_INT);
            MemorySegment error = error(arena);
            int status = (int) TRANSFORM_CALL.invokeExact(transform.require(), uint32(value, "value"), output, error);
            check(status, error, null);
            return Integer.toUnsignedLong(output.get(JAVA_INT, 0));
        } catch (Throwable throwable) { throw propagate(throwable); }
    }

    private static MethodHandle downcall(String name, FunctionDescriptor descriptor) {
        return LINKER.downcallHandle(LOOKUP.find(name).orElseThrow(() -> new ExceptionInInitializerError("missing native symbol " + name)), descriptor);
    }

    private static MemorySegment error(Arena arena) { return arena.allocate(ERROR_SIZE, 8); }
    private static int uint32(long value, String name) {
        if (value < 0 || value > 0xffff_ffffL) throw new IllegalArgumentException(name + " must be uint32");
        return (int) value;
    }
    private static void writeSlice(MemorySegment target, long offset, MemorySegment data, long length) {
        target.set(ADDRESS, offset, data); target.set(JAVA_LONG, offset + 8, length);
        target.set(ADDRESS, offset + 16, MemorySegment.NULL); target.set(ADDRESS, offset + 24, MemorySegment.NULL);
    }
    private static byte[] readBytes(MemorySegment payload, long offset) {
        MemorySegment address = payload.get(ADDRESS, offset); long length = payload.get(JAVA_LONG, offset + 8);
        return length == 0 ? new byte[0] : address.reinterpret(length).toArray(JAVA_BYTE);
    }
    private static long[] readUInt32s(MemorySegment payload, long offset) {
        MemorySegment address = payload.get(ADDRESS, offset); int length = Math.toIntExact(payload.get(JAVA_LONG, offset + 8));
        MemorySegment values = address.reinterpret((long) length * JAVA_INT.byteSize()); long[] result = new long[length];
        for (int index = 0; index < length; index++) result[index] = Integer.toUnsignedLong(values.getAtIndex(JAVA_INT, index));
        return result;
    }
    private static void check(int status, MemorySegment error, Throwable callback) {
        if (status == 0) return;
        if (callback != null) throw new CallbackThrewException(callback.getMessage(), callback);
        int code = error.get(JAVA_INT, 0); MemorySegment address = error.get(ADDRESS, 8); long length = error.get(JAVA_LONG, 16);
        String message = address.equals(MemorySegment.NULL) ? "Lean call failed with status " + status : new String(address.reinterpret(length).toArray(JAVA_BYTE), StandardCharsets.UTF_8);
        if (code == 100) throw new DisposedResourceException(message);
        if (code == 101) throw new CallbackThrewException(message, null);
        throw new LeanBridgeException(message);
    }
    private static RuntimeException propagate(Throwable throwable) {
        if (throwable instanceof RuntimeException runtime) return runtime;
        if (throwable instanceof Error error) throw error;
        return new LeanBridgeException("native call failed", throwable);
    }

    private static final class NativeAssets {
        private static final String ROOT = "/META-INF/lean-bridge/native/linux-x64/";
        static SymbolLookup lookup() {
            try {
                Path configured = configuredRoot();
                Path runtime = configured == null ? extract("liblean_bridge_native.so") : configured.resolve("liblean_bridge_native.so");
                Path component = configured == null ? extract("liblean_alpha_component.so") : configured.resolve("liblean_alpha_component.so");
                Path composition = configured == null ? extract("liblean_beta_component.so") : configured.resolve("liblean_beta_component.so");
                SymbolLookup runtimeLookup = SymbolLookup.libraryLookup(runtime, Arena.global());
                SymbolLookup componentLookup = SymbolLookup.libraryLookup(component, Arena.global());
                SymbolLookup compositionLookup = SymbolLookup.libraryLookup(composition, Arena.global());
                return runtimeLookup.or(componentLookup).or(compositionLookup);
            } catch (IOException exception) { throw new ExceptionInInitializerError(exception); }
        }
        private static Path configuredRoot() {
            String value = System.getenv("LEAN_BRIDGE_NATIVE_ROOT");
            return value == null || value.isBlank() ? null : Path.of(value).toAbsolutePath();
        }
        private static Path extract(String name) throws IOException {
            try (InputStream input = Runtime.class.getResourceAsStream(ROOT + name)) {
                if (input == null) throw new IOException("missing packaged native asset " + name);
                byte[] bytes = input.readAllBytes();
                String hash;
                try { hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
                catch (NoSuchAlgorithmException exception) { throw new AssertionError(exception); }
                Path root = Path.of(System.getProperty("java.io.tmpdir"), "lean-bridge", hash);
                Files.createDirectories(root);
                Path target = root.resolve(name);
                if (!Files.exists(target)) {
                    Path temporary = Files.createTempFile(root, name, ".tmp");
                    Files.write(temporary, bytes);
                    try { Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE); }
                    catch (java.nio.file.FileAlreadyExistsException ignored) { Files.deleteIfExists(temporary); }
                }
                return target;
            }
        }
    }
}
`;

const pomSource = model => `<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>org.leanbridge</groupId>
  <artifactId>lean-alpha</artifactId>
  <version>${model.component.version}</version>
  <properties>
    <maven.compiler.release>22</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>
</project>
`;

/**
 * Generates JVM binding package from validated semantic input without introducing behavior outside the generated native-language binding pipeline.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 */
export const compileJvmPackageModel = ir => Object.freeze({
	ir
	, model: compileManagedAlphaModel(ir, "jvm")
});

/**
 * Renders a deterministic JVM package layout from its compiled model.
 *
 * @param root0 - Compiled JVM package model.
 * @param root0.model - Managed projection model.
 */
export const renderJvmPackageLayout = ({ model }) => {
	const publicEntries = publicSources(model);
	const publicFiles = Object.keys(publicEntries).sort();
	const internalFiles = ["src/main/java/org/leanbridge/alpha/Runtime.java"];
	const packageFiles = ["pom.xml"];
	const files = {
		...publicEntries,
		[internalFiles[0]]: runtimeSource()
		, [packageFiles[0]]: pomSource(model)
		, "README.md": `# ${model.component.name} JVM binding\n\nGenerated direct Java APIs over one process-wide Lean runtime.\n\nBinding IR SHA-256: \`${model.bindingIrSha256}\`\n`
	};
	const manifest = managedBindingManifest({
		model
		, generator: "jvm"
		, files: [...publicFiles, ...internalFiles, ...packageFiles, "README.md"]
		, publicFiles
		, internalFiles
		, packageFiles
	});
	files["binding-manifest.json"] = `${JSON.stringify(manifest, null, 2)}\n`;
	return Object.freeze(files);
};

/**
 * Validates, compiles, renders, and audits one JVM binding package.
 *
 * @param ir - Binding IR document.
 */
export const generateJvmBindingPackage = ir => {
	const packageModel = compileJvmPackageModel(ir);
	const files = renderJvmPackageLayout(packageModel);
	auditManagedBindingPackage(packageModel.ir, files, "jvm");
	return files;
};
