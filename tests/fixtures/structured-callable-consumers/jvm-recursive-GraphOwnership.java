package org.leanbridge.structured;

import java.lang.foreign.*;
import java.lang.reflect.*;
import java.util.*;
import static java.lang.foreign.ValueLayout.*;

public final class GraphOwnership {
    private GraphOwnership() { }
    private static int checks;
    private static boolean span(MemorySegment pointer, long count, long width) {
        if (count == 0) return true;
        if (count < 0 || width < 1 || count > Long.MAX_VALUE / width) return false;
        long start = pointer.address(), bytes = count * width;
        for (var allocation : GraphFaultProbe.storage) {
            if (!allocation.scope().isAlive()) continue;
            long offset = start - allocation.address();
            if (offset >= 0 && bytes <= allocation.byteSize() && offset <= allocation.byteSize() - bytes) return true;
        }
        return false;
    }
    private static boolean owned(_GraphTypes.Catalog catalog, int id, MemorySegment raw, int depth) {
        if (depth > 128) return false;
        var node = catalog.nodes()[id];
        if (!span(raw, 1, node.size())) return false;
        raw = raw.reinterpret(node.size());
        if (node.kind() == 0) {
            return node.scalar() < 15 || span(raw.get(ADDRESS, 16), raw.get(JAVA_LONG, 24), 1);
        }
        if (node.kind() == 1) {
            long count = raw.get(JAVA_LONG, 24); var child = catalog.nodes()[node.element()];
            var data = raw.get(ADDRESS, 16);
            if (!span(data, count, child.size())) return false;
            if (count == 0) return true;
            data = data.reinterpret(count * child.size());
            for (long i = 0; i < count; ++i) if (!owned(catalog, child.id(), data.asSlice(i * child.size(), child.size()), depth + 1)) return false;
            return true;
        }
        int tag = node.kind() == 2 ? raw.get(JAVA_INT, 16) : node.kind() == 3 ? raw.get(JAVA_BYTE, 16) : 0;
        if (tag < 0 || tag >= node.branches().length) return false;
        for (var field : node.branches()[tag]) {
            var child = catalog.nodes()[field.type()];
            var value = field.pointer() ? raw.get(ADDRESS, field.offset()) : raw.asSlice(field.offset(), child.size());
            if (!owned(catalog, child.id(), value, depth + 1)) return false;
        }
        return true;
    }
    public static void main(String[] args) throws Throwable {
        boolean kotlin = args[0].equals("kotlin"), mutant = args[1].equals("reply-scope");
        var catalog = kotlin ? _KotlinGraphTypes.CATALOG : _GraphTypes.CATALOG;
        String namespace = "org.leanbridge.structured" + (kotlin ? ".kotlin" : "");
        var api = Class.forName(namespace + ".Api"); var factory = Class.forName(namespace + ".StructuredValues");
        var receiver = kotlin ? factory.getField("INSTANCE").get(null) : null;
        GraphProbeSetup.initialize(); var links = _CallableGraphNative.resolve(); links.lifecycle().before();
        var errors = new ArrayList<String>();
        for (int index = 0; index < OwnershipSetup.SHAPES.length; ++index) {
            var shape = OwnershipSetup.SHAPES[index];
            var valueMethod = factory.getDeclaredMethod(shape.equals("Alias") ? "record" : shape.toLowerCase(), int.class); valueMethod.setAccessible(true);
            var value = valueMethod.invoke(receiver, shape.equals("Option") || shape.equals("Result") ? 2 : 1);
            var call = Arrays.stream(api.getDeclaredMethods()).filter(method -> method.getName().equals("call" + shape)).findFirst().orElseThrow();
            var type = call.getParameterTypes()[1];
            var callback = Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] {type}, (proxy, method, values) -> {
                if (method.getName().equals("invoke")) return values[0];
                throw new AssertionError(method);
            });
            int node = OwnershipSetup.NODES[index];
            try (var inputScope = new _GraphRuntime.Scope(false); var replyScope = new _GraphRuntime.Scope(false);
                 var outputScope = new _GraphRuntime.Scope(false); var frame = new _CallableGraphRuntime.CallbackFrame(catalog, replyScope, links.lifecycle())) {
                var input = _GraphRuntime.write(catalog, node, value, inputScope);
                var output = outputScope.allocate(catalog.nodes()[node].size(), catalog.nodes()[node].alignment());
                var borrow = _CallableGraphRuntime.class.getDeclaredMethod((kotlin ? "borrowKotlin" : "borrowJava") + OwnershipSetup.CALLBACKS[index], type, _CallableGraphRuntime.CallbackFrame.class);
                borrow.setAccessible(true);
                var descriptor = (MemorySegment)borrow.invoke(null, callback, frame);
                var invoke = Linker.nativeLinker().downcallHandle(descriptor.get(ADDRESS, 0), FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
                int status = (int)invoke.invokeExact(MemorySegment.NULL, input, output); frame.finish(status);
                // Every pointer is checked against live arenas before reading it.
                if (!owned(catalog, node, output, 0)) {
                    if (!mutant) throw new AssertionError("Reply owner expired: " + shape);
                    errors.add(shape);
                } else {
                    var result = _GraphRuntime.read(catalog, node, output, outputScope);
                    if (!Objects.deepEquals(result, value)) throw new AssertionError(shape);
                    ++checks;
                }
            }
            GraphFaultProbe.clean(); GraphFaultProbe.storage.clear();
        }
        if (mutant ? checks != 1 || !errors.equals(List.of("Array", "List", "Result", "Tuple", "Record", "Variant", "Alias", "Recursive")) : checks != 9 || !errors.isEmpty())
            throw new AssertionError("Ownership coverage: " + checks + " " + errors);
        if (GraphFaultProbe.identities() != 0 || GraphFaultProbe.remainingHosts() != 0) throw new AssertionError("Ownership leaks");
        System.out.println("{\"checks\":" + checks + ",\"errors\":[" + String.join(",", errors.stream().map(value -> "\"" + value + "\"").toList()) + "],\"checkedBeforeDecode\":true}");
    }
}
