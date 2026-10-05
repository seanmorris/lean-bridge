// Failure and ownership probes for separately instrumented Java/Kotlin classes.
package org.leanbridge.structured;

import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.lang.reflect.*;
import java.util.*;
import static java.lang.foreign.ValueLayout.*;

public final class StructuredFaults {
    private StructuredFaults() { }
    private static int faults, deferred;
    private static MethodHandle snapshot;
    private static Class<?> api, runtime, factory;
    private static Object receiver;
    private static final class Marker extends Error {
        private static final long serialVersionUID = 1L;
    }
    private static void check(boolean value) { StructuredProbe.check(value); }
    private static long live() {
        try (Arena arena = Arena.ofConfined()) {
            var memory = arena.allocate(40, 8); snapshot.invokeExact(memory);
            return Integer.toUnsignedLong(memory.get(JAVA_INT, 20));
        } catch (Throwable error) { throw StructuredProbe.raise(error); }
    }
    private static Object invoke(Method method, Object target, Object... args) {
        try { return method.invoke(target, args); }
        catch (InvocationTargetException error) { throw StructuredProbe.raise(error.getCause()); }
        catch (ReflectiveOperationException error) { throw new AssertionError(error); }
    }
    private static Method method(String name) {
        return Arrays.stream(api.getDeclaredMethods()).filter(value -> value.getName().equals(name)).findFirst().orElseThrow();
    }
    private static Object value(String shape, int seed) {
        try {
            var method = factory.getDeclaredMethod(shape.equals("alias") ? "record" : shape, int.class);
            method.setAccessible(true); return invoke(method, receiver, seed);
        } catch (ReflectiveOperationException error) { throw new AssertionError(error); }
    }
    private static Object callback(Method call, String shape, int[] count) {
        var type = call.getParameterTypes()[1];
        return Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] { type }, (proxy, method, args) -> {
            if (method.getName().equals("invoke")) {
                check(Objects.deepEquals(value(shape, 1 + count[0]), args[0]));
                return value(shape, 1 + ++count[0]);
            }
            return switch (method.getName()) {
                case "equals" -> proxy == args[0];
                case "hashCode" -> System.identityHashCode(proxy);
                case "toString" -> "structured callback probe";
                default -> throw new AssertionError(method);
            };
        });
    }
    private static Object apply(Object owned, boolean captured, Object argument) {
        var method = Arrays.stream(owned.getClass().getDeclaredMethods()).filter(value -> value.getName().equals("invoke")).findFirst().orElseThrow();
        return invoke(method, owned, captured, argument);
    }
    private static void close(Object owned) {
        try { ((AutoCloseable)owned).close(); }
        catch (Exception error) { throw StructuredProbe.raise(error); }
    }
    private static boolean isClosed(Object owned) {
        try { return (boolean)invoke(owned.getClass().getMethod("isClosed"), owned); }
        catch (ReflectiveOperationException error) { throw new AssertionError(error); }
    }
    private static int exercise(Runnable action, int target, boolean marker) {
        StructuredProbe.reset();
        final Throwable failure = marker ? new Marker() : new OutOfMemoryError("conversion checkpoint");
        final long baseline = live();
        final int calls = StructuredProbe.calls, clears = StructuredProbe.clears;
        StructuredProbe.target = target; StructuredProbe.failure = failure; StructuredProbe.active = true;
        boolean failed = false;
        try { action.run(); }
        catch (Throwable error) {
            if (error != failure) throw StructuredProbe.raise(error);
            failed = true; ++faults;
        } finally { StructuredProbe.active = false; }
        check(failed == (target != 0));
        check(StructuredProbe.openArenas() == 0); check(live() == baseline);
        check(StructuredProbe.calls - calls == StructuredProbe.clears - clears);
        return StructuredProbe.count;
    }
    private static int failures(Runnable action) {
        int count = exercise(action, 0, false); check(count > 0);
        for (int target = 1; target <= count; ++target) {
            exercise(action, target, false); exercise(action, target, true);
            exercise(action, 0, false);
        }
        return count;
    }
    private static Map<String, Object> shape(String shape) {
        String suffix = Character.toUpperCase(shape.charAt(0)) + shape.substring(1);
        Method call = method("call" + suffix), twice = method("twice" + suffix), make = method("make" + suffix);
        var paths = new LinkedHashMap<String, Integer>(); int before = faults;
        paths.put("callback", failures(() -> {
            int[] count = { 0 };
            var result = invoke(call, null, value(shape, 1), callback(call, shape, count));
            check(count[0] == 1); check(Objects.deepEquals(result, value(shape, 2)));
        }));
        paths.put("repeated", failures(() -> {
            int[] count = { 0 };
            var result = invoke(twice, null, value(shape, 1), callback(twice, shape, count));
            check(count[0] == 2); check(Objects.deepEquals(result, value(shape, 3)));
        }));
        paths.put("create", failures(() -> {
            var owned = invoke(make, null, value(shape, 1));
            try { check(!isClosed(owned)); }
            finally { close(owned); }
            check(isClosed(owned));
        }));
        paths.put("create-call", failures(() -> {
            var owned = invoke(make, null, value(shape, 1));
            try { check(Objects.deepEquals(apply(owned, true, value(shape, 2)), value(shape, 1))); }
            finally { close(owned); }
        }));
        var held = invoke(make, null, value(shape, 1));
        try {
            paths.put("held-call", failures(() -> check(Objects.deepEquals(apply(held, false, value(shape, 2)), value(shape, 2)))));
        } finally { close(held); }
        StructuredProbe.reset();
        var pending = invoke(make, null, value(shape, 1));
        final long baseline = live();
        StructuredProbe.deferred = () -> { close(pending); check(isClosed(pending)); check(live() == baseline); ++deferred; };
        StructuredProbe.active = true;
        try { check(Objects.deepEquals(apply(pending, true, value(shape, 2)), value(shape, 1))); }
        finally { StructuredProbe.active = false; close(pending); }
        check(StructuredProbe.deferred == null); check(live() == baseline - 1); check(isClosed(pending));
        var result = new LinkedHashMap<String, Object>();
        result.put("shape", shape); result.put("paths", paths); result.put("faults", faults - before);
        return result;
    }
    private static int malformed(String[] args) throws Exception {
        int count = 0;
        try (Arena arena = Arena.ofConfined()) {
            for (int shape = 0; shape < 5; ++shape) {
                var method = runtime.getDeclaredMethod("from" + args[shape + 1], MemorySegment.class);
                method.setAccessible(true);
                for (int invalid = 0; invalid < 3; ++invalid) {
                    var value = arena.allocate(256, 8);
                    if (shape < 2) value.set(JAVA_BYTE, 0, new byte[] { 2, 127, -1 }[invalid]);
                    else if (shape == 2) value.set(JAVA_INT, 0, new int[] { -1, 99, Integer.MAX_VALUE }[invalid]);
                    else {
                        value.set(JAVA_LONG, 8, invalid == 2 ? Long.MAX_VALUE : 1);
                        value.set(ADDRESS, 0, invalid == 1 ? MemorySegment.ofAddress(1) : MemorySegment.NULL);
                    }
                    try { invoke(method, null, value); throw new AssertionError("malformed native value accepted"); }
                    catch (IllegalArgumentException | IllegalStateException expected) { ++count; }
                }
            }
        }
        return count;
    }
    private static String json(Object value) {
        if (value instanceof String text) return "\"" + text.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        if (value instanceof Map<?, ?> map) {
            var entries = new ArrayList<String>();
            for (var entry : map.entrySet()) entries.add(json(entry.getKey()) + ":" + json(entry.getValue()));
            return "{" + String.join(",", entries) + "}";
        }
        if (value instanceof List<?> values) return "[" + String.join(",", values.stream().map(StructuredFaults::json).toList()) + "]";
        throw new AssertionError(value);
    }
    public static void main(String[] args) throws Exception {
        String profile = args[0], namespace = "org.leanbridge.structured" + (profile.equals("kotlin") ? ".kotlin" : "");
        api = Class.forName(namespace + ".Api");
        runtime = Class.forName("org.leanbridge.structured." + (profile.equals("kotlin") ? "KotlinRuntime" : "Runtime"));
        factory = Class.forName(namespace + ".StructuredValues");
        receiver = profile.equals("kotlin") ? factory.getField("INSTANCE").get(null) : null;
        snapshot = Linker.nativeLinker().downcallHandle(NativeAssets.lookup().find("lean_bridge_native_snapshot_read").orElseThrow(), FunctionDescriptor.ofVoid(ADDRESS));
        check(live() == 0);
        var shapes = new ArrayList<Map<String, Object>>();
        for (String name : new String[] { "array", "list", "option", "result", "tuple", "record", "variant", "alias" }) shapes.add(shape(name));
        int malformed = malformed(args), liveHosts = StructuredProbe.releasedHosts();
        check(liveHosts == 0); check(live() == 0); check(StructuredProbe.openArenas() == 0);
        var result = new LinkedHashMap<String, Object>();
        result.put("profile", profile); result.put("checks", StructuredProbe.checks);
        result.put("faults", faults); result.put("clears", StructuredProbe.clears); result.put("disposals", StructuredProbe.disposals);
        result.put("malformed", malformed); result.put("liveIdentities", live());
        result.put("openArenas", StructuredProbe.openArenas()); result.put("liveHosts", liveHosts);
        result.put("deferredCloseChecks", deferred); result.put("shapes", shapes);
        System.out.println(json(result));
    }
}
