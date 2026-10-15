/**
 * Iterative private FFM transport, budgets and root-owned cleanup for Java.
 *
 * @file
 */
import { componentRecursiveLimits } from "../../abi/component-recursive.mjs";

/** Native lifecycle remains supplied by the authenticated package loader. */
export const jvmGraphRuntime = `final class _GraphRuntime {
    private _GraphRuntime() { }
    static void checkpoint() { }
    static final class InvalidNative extends RuntimeException {
        private static final long serialVersionUID = 1L;
        InvalidNative(String message) { super(message); }
    }
    static final class Limit extends IllegalArgumentException {
        private static final long serialVersionUID = 1L;
        Limit(String message) { super(message); }
    }
    interface Lifecycle { void before(); void after(); void poison(); }
    record Target(java.lang.invoke.MethodHandle invoke, java.lang.invoke.MethodHandle clear, Lifecycle lifecycle) { }
    private record Address(int type, long address) { }

    static final class Scope implements java.lang.AutoCloseable {
        final boolean checkOnly;
        final java.lang.foreign.Arena arena;
        private long nativeRemaining = 16 * 1024 * 1024;
        private long storageRemaining = 16 * 1024 * 1024;
        int nodes = ${componentRecursiveLimits.valueNodes};
        final java.util.IdentityHashMap<Object, Boolean> hosts = new java.util.IdentityHashMap<>();
        final java.util.HashSet<Address> outputs = new java.util.HashSet<>();
        Scope(boolean checkOnly) {
            if (java.lang.foreign.ValueLayout.ADDRESS.byteSize() != 8 || java.nio.ByteOrder.nativeOrder() != java.nio.ByteOrder.LITTLE_ENDIAN)
                throw new java.lang.UnsupportedOperationException("Native graphs require little-endian 64-bit storage");
            this.checkOnly = checkOnly; arena = checkOnly ? null : java.lang.foreign.Arena.ofConfined();
        }
        private static long charge(long remaining, long count, long width) {
            if (count < 0 || width < 1 || count > remaining / width) throw new Limit("16 MiB copied graph conversion budget exceeded");
            return remaining - count * width;
        }
        void nativeBytes(long count, long width) { nativeRemaining = charge(nativeRemaining, count, width); }
        void storage(long count, long width) { storageRemaining = charge(storageRemaining, count, width); }
        void visit(int depth, _GraphTypes.Node type, boolean storage) {
            if (depth > ${componentRecursiveLimits.valueDepth} || nodes == 0) throw new Limit("Copied graph depth or node limit exceeded");
            nodes--; if (storage) nativeBytes(type.size(), 1);
        }
        java.lang.foreign.MemorySegment allocate(long size, long alignment) {
            storage(size, 1);
            if (size == 0) return java.lang.foreign.MemorySegment.NULL;
            storage(32, 1);
            if (checkOnly) return java.lang.foreign.MemorySegment.NULL;
            checkpoint(); var result = arena.allocate(size, alignment); result.fill((byte)0); checkpoint(); return result;
        }
        @Override public void close() { if (arena != null) arena.close(); hosts.clear(); outputs.clear(); }
    }

    static java.lang.foreign.MemorySegment checked(java.lang.foreign.MemorySegment pointer, long count, long width, long alignment) {
        if (count == 0) return java.lang.foreign.MemorySegment.NULL;
        long address = pointer.address();
        if (count < 0 || width < 1 || count > Long.MAX_VALUE / width || address == 0 || Long.remainderUnsigned(address, alignment) != 0
            || Long.compareUnsigned(address, -1L - count * width) > 0)
            throw new InvalidNative("Missing, misaligned or overflowing native span");
        // The authenticated native adapter supplies readable memory. Bounds and
        // alignment cannot make arbitrary foreign pointers safe to dereference.
        return pointer.reinterpret(count * width);
    }
    static void status(int status) {
        switch (status) {
            case 0: return;
            case 1: throw new IllegalArgumentException("Invalid native copied input");
            case 2: throw new Limit("Native copied graph limit exceeded");
            case 3: throw new java.lang.OutOfMemoryError("Native copied graph allocation failed");
            case 5: throw new LeanBridgeException(5, "Lean runtime is unavailable", null);
            default: throw new InvalidNative("Invalid native copied result or status");
        }
    }
    private static RuntimeException propagate(Throwable failure) {
        if (failure instanceof RuntimeException runtime) return runtime;
        if (failure instanceof Error error) throw error;
        return new LeanBridgeException(4, "Native copied call failed", failure);
    }
    private static void require(_GraphTypes.Node node, Object value) {
        if (value == null || (node.kind() == 0 ? value.getClass() != node.hostType() : !node.hostType().isInstance(value)))
            throw new IllegalArgumentException("Expected copied value of type " + node.hostType().getTypeName());
        if (!node.inhabited()) throw new IllegalArgumentException("The declared type has no finite copied value");
    }

    private static final class Input {
        final _GraphTypes.Node type;
        final Object value;
        final java.lang.foreign.MemorySegment raw;
        final int depth;
        final boolean storage;
        java.lang.foreign.MemorySegment data;
        int next = -1, count, tag;
        Input(_GraphTypes.Node type, Object value, java.lang.foreign.MemorySegment raw, int depth, boolean storage) {
            this.type = type; this.value = value; this.raw = raw; this.depth = depth; this.storage = storage;
        }
    }
    static java.lang.foreign.MemorySegment write(int id, Object value, Scope scope) {
        return write(_GraphTypes.CATALOG, id, value, scope);
    }
    static java.lang.foreign.MemorySegment write(_GraphTypes.Catalog catalog, int id, Object value, Scope scope) {
        var types = catalog.nodes(); var type = types[id]; var result = scope.allocate(type.size(), type.alignment());
        var stack = new java.util.ArrayDeque<Input>(); stack.push(new Input(type, value, result, 0, true));
        while (!stack.isEmpty()) {
            Input frame = stack.peek(); var node = frame.type;
            if (frame.next < 0) {
                scope.visit(frame.depth, node, frame.storage); require(node, frame.value);
                if (node.kind() == 0) { _GraphScalars.write(node.scalar(), frame.value, frame.raw, scope); stack.pop(); continue; }
                if (scope.hosts.put(frame.value, Boolean.TRUE) != null) throw new IllegalArgumentException("Cyclic copied input");
                if (node.kind() == 1) {
                    frame.count = java.lang.reflect.Array.getLength(frame.value);
                    if (frame.count > scope.nodes) throw new Limit("Copied graph node limit exceeded");
                    var element = types[node.element()]; scope.nativeBytes(frame.count, element.size());
                    frame.data = scope.allocate(frame.count * element.size(), element.alignment());
                    if (!scope.checkOnly) {
                        frame.raw.set(java.lang.foreign.ValueLayout.ADDRESS, 16, frame.data);
                        frame.raw.set(java.lang.foreign.ValueLayout.JAVA_LONG, 24, (long)frame.count);
                    }
                } else {
                    frame.tag = node.shape().branch(frame.value); frame.count = node.branches()[frame.tag].length;
                    if (!scope.checkOnly) {
                        if (node.kind() == 2) frame.raw.set(java.lang.foreign.ValueLayout.JAVA_INT, 16, frame.tag);
                        else if (node.kind() == 3) frame.raw.set(java.lang.foreign.ValueLayout.JAVA_BYTE, 16, (byte)frame.tag);
                    }
                }
                frame.next = 0;
            }
            if (frame.next == frame.count) { scope.hosts.remove(frame.value); stack.pop(); continue; }
            int index = frame.next++, child; Object payload; boolean storage = false;
            var raw = java.lang.foreign.MemorySegment.NULL;
            if (node.kind() == 1) {
                child = node.element(); var element = types[child];
                payload = java.lang.reflect.Array.get(frame.value, index);
                if (!scope.checkOnly) raw = frame.data.asSlice(index * element.size(), element.size());
            } else {
                var edge = node.branches()[frame.tag][index]; child = edge.type(); var element = types[child];
                payload = node.shape().get(frame.value, frame.tag, index); storage = edge.pointer();
                if (storage) {
                    raw = scope.allocate(element.size(), element.alignment());
                    if (!scope.checkOnly) frame.raw.set(java.lang.foreign.ValueLayout.ADDRESS, edge.offset(), raw);
                } else if (!scope.checkOnly) raw = frame.raw.asSlice(edge.offset(), element.size());
            }
            stack.push(new Input(types[child], payload, raw, frame.depth + 1, storage));
        }
        return result;
    }

    private static final class Output {
        final _GraphTypes.Node type;
        java.lang.foreign.MemorySegment raw, data;
        final int depth;
        final boolean storage;
        Object result;
        Object[] fields;
        Address address;
        int next = -1, count, tag;
        Output(_GraphTypes.Node type, java.lang.foreign.MemorySegment raw, int depth, boolean storage) {
            this.type = type; this.raw = raw; this.depth = depth; this.storage = storage;
        }
    }
    static Object read(int id, java.lang.foreign.MemorySegment raw, Scope scope) {
        return read(_GraphTypes.CATALOG, id, raw, scope);
    }
    static Object read(_GraphTypes.Catalog catalog, int id, java.lang.foreign.MemorySegment raw, Scope scope) {
        var types = catalog.nodes();
        var stack = new java.util.ArrayDeque<Output>(); stack.push(new Output(types[id], raw, 0, true));
        while (!stack.isEmpty()) {
            Output frame = stack.peek(); var node = frame.type;
            if (frame.next < 0) {
                scope.visit(frame.depth, node, frame.storage);
                if (!node.inhabited()) throw new InvalidNative("Uninhabited native copied value");
                frame.raw = checked(frame.raw, 1, node.size(), node.alignment());
                frame.address = new Address(node.id(), frame.raw.address());
                if (!scope.outputs.add(frame.address)) throw new InvalidNative("Cyclic native copied value");
                if (node.kind() == 0) frame.result = _GraphScalars.read(node.scalar(), frame.raw, scope);
                else if (node.kind() == 1) {
                    long count = frame.raw.get(java.lang.foreign.ValueLayout.JAVA_LONG, 24);
                    if (count < 0 || count > scope.nodes) throw new Limit("Copied graph node limit exceeded");
                    var element = types[node.element()]; scope.nativeBytes(count, element.size());
                    scope.storage(count, 8); scope.storage(32, 1);
                    frame.data = checked(frame.raw.get(java.lang.foreign.ValueLayout.ADDRESS, 16), count, element.size(), element.alignment());
                    frame.count = (int)count; checkpoint();
                    frame.result = java.lang.reflect.Array.newInstance(node.hostType().componentType(), frame.count);
                } else {
                    frame.tag = node.kind() == 2 ? frame.raw.get(java.lang.foreign.ValueLayout.JAVA_INT, 16)
                        : node.kind() == 3 ? frame.raw.get(java.lang.foreign.ValueLayout.JAVA_BYTE, 16) : 0;
                    if (frame.tag < 0 || frame.tag >= node.branches().length) throw new InvalidNative("Invalid native copied constructor or flag");
                    frame.count = node.branches()[frame.tag].length;
                    scope.storage(64L + frame.count * 16L, 1); checkpoint(); frame.fields = new Object[frame.count];
                }
                frame.next = 0;
            }
            if (frame.next == frame.count) {
                if (node.kind() > 1) { checkpoint(); frame.result = node.shape().create(frame.tag, frame.fields); }
                scope.outputs.remove(frame.address); stack.pop();
                if (stack.isEmpty()) return frame.result;
                var parent = stack.peek();
                if (parent.type.kind() == 1) java.lang.reflect.Array.set(parent.result, parent.next - 1, frame.result);
                else parent.fields[parent.next - 1] = frame.result;
                continue;
            }
            int index = frame.next++, child; boolean storage = false; java.lang.foreign.MemorySegment pointer;
            if (node.kind() == 1) {
                child = node.element(); var element = types[child];
                pointer = frame.data.asSlice(index * element.size(), element.size());
            } else {
                var edge = node.branches()[frame.tag][index]; child = edge.type(); storage = edge.pointer();
                pointer = storage ? frame.raw.get(java.lang.foreign.ValueLayout.ADDRESS, edge.offset())
                    : frame.raw.asSlice(edge.offset(), types[child].size());
            }
            stack.push(new Output(types[child], pointer, frame.depth + 1, storage));
        }
        throw new IllegalStateException("Missing copied result");
    }

    static void validate(int function, Object[] arguments) {
        validate(_GraphTypes.CATALOG, function, arguments);
    }
    static void validate(_GraphTypes.Catalog catalog, int function, Object[] arguments) {
        int[] parameters = catalog.parameters()[function];
        if (arguments.length != parameters.length) throw new IllegalArgumentException("Wrong argument count");
        try (var check = new Scope(true)) {
            for (int index = 0; index < parameters.length; index++) write(catalog, parameters[index], arguments[index], check);
        }
    }
    static Object call(int function, Target target, Object... arguments) {
        return call(_GraphTypes.CATALOG, function, target, arguments);
    }
    static Object call(_GraphTypes.Catalog catalog, int function, Target target, Object... arguments) {
        validate(catalog, function, arguments);
        java.util.Objects.requireNonNull(target); java.util.Objects.requireNonNull(target.invoke());
        var resultType = catalog.nodes()[catalog.results()[function]];
        if (resultType.aggregate()) java.util.Objects.requireNonNull(target.clear());
        try (var scope = new Scope(false)) {
            var output = scope.allocate(resultType.size(), resultType.alignment());
            if (resultType.kind() == 2) output.set(java.lang.foreign.ValueLayout.JAVA_INT, 16, -1);
            try {
                var nativeArguments = new Object[arguments.length + 1];
                for (int index = 0; index < arguments.length; index++) nativeArguments[index] = write(catalog, catalog.parameters()[function][index], arguments[index], scope);
                nativeArguments[arguments.length] = output;
                target.lifecycle().before(); status((int)target.invoke().invokeWithArguments(nativeArguments));
                Object result = read(catalog, resultType.id(), output, scope); checkpoint(); target.lifecycle().after(); return result;
            } catch (InvalidNative failure) {
                target.lifecycle().poison(); throw new LeanBridgeException(4, failure.getMessage(), failure);
            } catch (Throwable failure) { throw propagate(failure); }
            finally {
                if (resultType.aggregate()) {
                    try { target.clear().invokeExact(output); }
                    catch (Throwable failure) { throw propagate(failure); }
                }
            }
        }
    }
}
`;
