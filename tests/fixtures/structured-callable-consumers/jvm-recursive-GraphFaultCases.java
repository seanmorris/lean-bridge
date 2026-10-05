package org.leanbridge.structured;

import java.lang.foreign.*;
import java.lang.reflect.*;
import java.util.*;
import static java.lang.foreign.ValueLayout.*;

public final class GraphFaultCases {
    private GraphFaultCases() { }
    private static Class<?> api, factory;
    private static Object receiver;
    private static int deferred;
    private static final class Marker extends Error { private static final long serialVersionUID = 1L; }
    private static void check(boolean condition) { GraphFaultProbe.check(condition); }
    private static Object invoke(Method method, Object target, Object... args) {
        try { return method.invoke(target, args); }
        catch (InvocationTargetException error) { throw GraphFaultProbe.raise(error.getCause()); }
        catch (ReflectiveOperationException error) { throw new AssertionError(error); }
    }
    private static Method method(String name) {
        return Arrays.stream(api.getDeclaredMethods()).filter(item -> item.getName().equals(name)).findFirst().orElseThrow();
    }
    private static Object value(String shape, int seed) {
        try { var method = factory.getDeclaredMethod(shape.equals("alias") ? "record" : shape, int.class); method.setAccessible(true); return invoke(method, receiver, seed); }
        catch (ReflectiveOperationException error) { throw new AssertionError(error); }
    }
    private static Object callback(Method call, String shape, int seed, int[] calls) {
        var type = call.getParameterTypes()[1];
        return Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] {type}, (proxy, method, args) -> {
            if (method.getName().equals("invoke")) {
                check(Objects.deepEquals(args[0], value(shape, seed + calls[0])));
                return value(shape, seed + ++calls[0]);
            }
            return switch (method.getName()) {
                case "equals" -> proxy == args[0]; case "hashCode" -> System.identityHashCode(proxy);
                case "toString" -> "recursive fault callback"; default -> throw new AssertionError(method);
            };
        });
    }
    private static Object apply(Object owned, boolean captured, Object value) {
        var call = Arrays.stream(owned.getClass().getDeclaredMethods()).filter(item -> item.getName().equals("invoke")).findFirst().orElseThrow();
        return invoke(call, owned, captured, value);
    }
    private static void close(Object owned) {
        try { ((AutoCloseable)owned).close(); }
        catch (Exception error) { throw GraphFaultProbe.raise(error); }
    }
    private static boolean closed(Object owned) {
        try { return (boolean)invoke(owned.getClass().getMethod("isClosed"), owned); }
        catch (ReflectiveOperationException error) { throw new AssertionError(error); }
    }
    private record Counts(int checkpoints, int hostAllocations, long nativeAllocations) { }
    private static Counts exercise(Runnable action, int mode, int target, boolean marker) {
        GraphFaultProbe.clean(); long baseline = GraphFaultProbe.identities();
        GraphFaultProbe.points = GraphFaultProbe.allocations = 0;
        GraphFaultProbe.mode = mode; GraphFaultProbe.target = target;
        GraphFaultProbe.failure = marker ? new Marker() : new OutOfMemoryError("conversion checkpoint");
        GraphFaultProbe.nativeReset(mode == 3 ? target : 0); GraphFaultProbe.active = true;
        boolean failed = false;
        try { action.run(); }
        catch (Throwable error) {
            if (mode == 1 ? error != GraphFaultProbe.failure : !(error instanceof OutOfMemoryError)) throw GraphFaultProbe.raise(error);
            failed = true; ++GraphFaultProbe.faults;
        } finally { GraphFaultProbe.active = false; }
        check(failed == (target != 0)); GraphFaultProbe.clean(); check(GraphFaultProbe.identities() == baseline);
        return new Counts(GraphFaultProbe.points, GraphFaultProbe.allocations, GraphFaultProbe.nativeCount("attempts"));
    }
    private static Map<String, Object> shape(String shape, int seed) {
        String suffix = Character.toUpperCase(shape.charAt(0)) + shape.substring(1);
        var call = method("call" + suffix); var twice = method("twice" + suffix); var make = method("make" + suffix);
        var input = value(shape, seed); var other = value(shape, seed + 1);
        int before = GraphFaultProbe.faults;
        var held = invoke(make, null, input);
        var paths = new LinkedHashMap<String, Object>();
        try {
            var actions = new LinkedHashMap<String, Runnable>();
            actions.put("callback", () -> { int[] calls = {0}; var result = invoke(call, null, input, callback(call, shape, seed, calls)); check(calls[0] == 1); check(Objects.deepEquals(result, other)); });
            actions.put("repeated", () -> { int[] calls = {0}; var result = invoke(twice, null, input, callback(twice, shape, seed, calls)); check(calls[0] == 2); check(Objects.deepEquals(result, value(shape, seed + 2))); });
            actions.put("create", () -> { var owned = invoke(make, null, input); try { check(!closed(owned)); } finally { close(owned); } check(closed(owned)); });
            actions.put("create-call", () -> { var owned = invoke(make, null, input); try { check(Objects.deepEquals(apply(owned, false, other), other)); } finally { close(owned); } });
            actions.put("held-call", () -> check(Objects.deepEquals(apply(held, true, other), input)));
            for (var entry : actions.entrySet()) {
                var action = entry.getValue(); var count = exercise(action, 0, 0, false); check(count.checkpoints() > 0);
                paths.put(entry.getKey(), Map.of("checkpoints", count.checkpoints(), "hostAllocations", count.hostAllocations(), "nativeAllocations", count.nativeAllocations()));
                for (int mode = 1; mode <= 3; ++mode) {
                    long total = mode == 1 ? count.checkpoints() : mode == 2 ? count.hostAllocations() : count.nativeAllocations();
                    for (int marker = 0; marker < (mode == 1 ? 2 : 1); ++marker) for (int target = 1; target <= total; ++target) {
                        exercise(action, mode, target, marker != 0);
                        exercise(actions.get("callback"), 0, 0, false);
                    }
                }
                check(exercise(action, 0, 0, false).equals(count));
            }
        } finally { close(held); }
        long baseline = GraphFaultProbe.identities(); var pending = invoke(make, null, input);
        GraphFaultProbe.during = () -> { close(pending); check(closed(pending)); check(GraphFaultProbe.identities() == baseline + 1); };
        try { check(Objects.deepEquals(apply(pending, false, other), other)); }
        finally { close(pending); }
        check(GraphFaultProbe.during == null); check(GraphFaultProbe.identities() == baseline); ++deferred;
        return Map.of("shape", shape, "seed", seed, "paths", paths, "faults", GraphFaultProbe.faults - before);
    }
    private static String json(Object value) {
        if (value instanceof String text) return "\"" + text.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        if (value instanceof Map<?, ?> map) {
            var entries = new ArrayList<String>(); for (var entry : map.entrySet()) entries.add(json(entry.getKey()) + ":" + json(entry.getValue()));
            return "{" + String.join(",", entries) + "}";
        }
        if (value instanceof List<?> list) return "[" + String.join(",", list.stream().map(GraphFaultCases::json).toList()) + "]";
        throw new AssertionError(value);
    }
    private static void poison() {
        var call = method("callRecursive"); var input = value("recursive", 1);
        invoke(call, null, input, callback(call, "recursive", 1, new int[1]));
        int clears = GraphFaultProbe.clears;
        GraphFaultProbe.poison(); boolean failed = false;
        try { invoke(call, null, input, callback(call, "recursive", 1, new int[1])); }
        catch (LeanBridgeException expected) { check(expected.status() == 4); failed = true; }
        check(failed); check(GraphFaultProbe.clears == clears + 1);
        check(GraphFaultProbe.nativeCount("retired") == 1); check(GraphFaultProbe.nativeCount("poisoned") == 1); GraphFaultProbe.clean();
        failed = false; int[] calls = {0};
        try { invoke(call, null, input, callback(call, "recursive", 1, calls)); }
        catch (LeanBridgeException expected) { check(expected.status() == 5); failed = true; }
        check(failed && calls[0] == 0); check(GraphFaultProbe.clears == clears + 1); GraphFaultProbe.clean();
        System.out.println(json(Map.of("checks", GraphFaultProbe.checks, "retired", GraphFaultProbe.nativeCount("retired"), "malformed", GraphFaultProbe.nativeCount("poisoned"), "clears", GraphFaultProbe.clears - clears)));
    }
    public static void main(String[] args) throws Throwable {
        String profile = args[0], namespace = "org.leanbridge.structured" + (profile.equals("kotlin") ? ".kotlin" : "");
        api = Class.forName(namespace + ".Api"); factory = Class.forName(namespace + ".StructuredValues");
        receiver = profile.equals("kotlin") ? factory.getField("INSTANCE").get(null) : null;
        GraphProbeSetup.initialize();
        check(GraphFaultProbe.identities() == 0); GraphFaultProbe.clean();
        if (args.length > 1 && args[1].equals("poison")) { poison(); return; }
        var rows = new ArrayList<Map<String, Object>>();
        for (int seed = 0; seed < 4; ++seed) for (String shape : new String[] {"array", "list", "option", "result", "tuple", "record", "variant", "alias", "recursive"}) rows.add(shape(shape, seed));
        GraphFaultProbe.clean(); check(GraphFaultProbe.identities() == 0); int hosts = GraphFaultProbe.remainingHosts(); check(hosts == 0);
        var result = new LinkedHashMap<String, Object>();
        result.put("profile", profile); result.put("checks", GraphFaultProbe.checks); result.put("faults", GraphFaultProbe.faults); result.put("clears", GraphFaultProbe.clears);
        result.put("deferred", deferred); result.put("identities", GraphFaultProbe.identities()); result.put("hosts", hosts); result.put("shapes", rows);
        System.out.println(json(result));
    }
}
