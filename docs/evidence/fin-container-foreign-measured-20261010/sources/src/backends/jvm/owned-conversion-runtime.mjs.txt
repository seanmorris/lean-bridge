/**
 * Bounded Java snapshots, identity pins and transactional result conversion.
 *
 * @file
 */
import { componentRecursiveLimits } from "../../abi/component-recursive.mjs";
import { ownedJvmWholeScope } from "./owned-borrows.mjs";

/**
 * Call adapters provide authenticated factories and an owning or borrowed lease.
 *
 * @param options - Explicit transport capabilities.
 * @param options.transferredInputs - Track consuming inputs during conversion.
 * @param options.anchoredResults - Pin whole owners, including empty values.
 */
export const ownedJvmConversionSupport = ({ transferredInputs = false, anchoredResults = false } = {}) => `final class _OwnedConvert {
    private _OwnedConvert() { }
    static void checkpoint() { _OwnedRuntime.checkpoint(); }
    static final class InvalidNative extends RuntimeException {
        private static final long serialVersionUID = 1L;
        InvalidNative(String message) { super(message); }
    }
    static final class Limit extends IllegalArgumentException {
        private static final long serialVersionUID = 1L;
        Limit(String message) { super(message); }
    }
    interface Factory { Object create(int type, _OwnedRuntime.Handle handle); }
    private record Address(int type, long address) { }
    static final class Budget {
        int nodes = ${componentRecursiveLimits.valueNodes};
        long nativeRemaining = 16 * 1024 * 1024;
        long storageRemaining = 16 * 1024 * 1024;
    }
    static final class Scope implements AutoCloseable {
        final _OwnedRuntime.State state;
        final boolean checkOnly;
        final java.lang.foreign.Arena arena;
        final Budget budget;
        private final Factory factories;
        private final java.util.function.Supplier<_OwnedRuntime.Lease> lease;
        private final java.util.ArrayList<_OwnedRuntime.Lease> roots = new java.util.ArrayList<>();
        private final java.util.ArrayList<_OwnedRuntime.Handle> handles = new java.util.ArrayList<>();
        final java.util.IdentityHashMap<Object, Boolean> hosts = new java.util.IdentityHashMap<>();
        final java.util.HashSet<Address> outputs = new java.util.HashSet<>();
        private boolean complete, closed;${transferredInputs ? `
        _OwnedInputTransfers moves;
        int moveGroup = -1;` : ""}
        Scope(_OwnedRuntime.State state, boolean checkOnly, Factory factories,
            java.util.function.Supplier<_OwnedRuntime.Lease> lease) {
            this(state, checkOnly, factories, lease, new Budget());
        }
        Scope(_OwnedRuntime.State state, boolean checkOnly, Factory factories,
            java.util.function.Supplier<_OwnedRuntime.Lease> lease, Budget budget) {
            java.util.Objects.requireNonNull(state).require(); this.state = state;
            this.checkOnly = checkOnly; this.factories = factories; this.lease = lease;
            this.budget = java.util.Objects.requireNonNull(budget);
            arena = checkOnly ? null : java.lang.foreign.Arena.ofConfined();
        }
        void require() {
            if (closed || complete) throw new IllegalStateException("Ownership conversion scope is closed");
            state.require();
        }
        private static long charge(long remaining, long count, long width) {
            if (count < 0 || width < 1 || count > remaining / width)
                throw new Limit("16 MiB ownership conversion budget exceeded");
            return remaining - count * width;
        }
        void nativeBytes(long count, long width) { budget.nativeRemaining = charge(budget.nativeRemaining, count, width); }
        void storage(long count, long width) { budget.storageRemaining = charge(budget.storageRemaining, count, width); }
        void visit(int depth, _OwnedTypes.Node type, boolean storage) {
            if (depth > ${componentRecursiveLimits.valueDepth} || budget.nodes == 0)
                throw new Limit("Ownership value depth or node limit exceeded");
            budget.nodes--; if (storage) nativeBytes(type.size(), 1);
            storage(96, 1);
        }
        java.lang.foreign.MemorySegment allocate(long size, long alignment) {
            storage(size, 1);
            if (size == 0) return java.lang.foreign.MemorySegment.NULL;
            storage(32, 1);
            if (checkOnly) return java.lang.foreign.MemorySegment.NULL;
            checkpoint(); var result = arena.allocate(size, alignment);
            result.fill((byte)0); checkpoint(); return result;
        }
${anchoredResults ? ownedJvmWholeScope : ""}\
        long root(_OwnedRuntime.Handle handle) {
            long raw = handle.raw(state); storage(32, 1);
            if (${anchoredResults ? "true" : "!checkOnly"}) {
                handle.lease.acquire();
                try { checkpoint(); roots.add(handle.lease); }
                catch (Throwable error) { handle.lease.release(false); throw error; }
${transferredInputs && !anchoredResults ? "                if (moves != null && moveGroup >= 0) moves.add(handle.lease, moveGroup, this);\n" : ""}\
            }
            return raw;
        }
        Object identity(_OwnedTypes.Node node, long pointer) {
            if (lease == null || factories == null)
                throw new IllegalStateException("Native identities require an owning result or borrowed callback frame");
            storage(160, 1); checkpoint();
            var owner = lease.get();
            if (owner.state != state) throw new InvalidNative("Foreign native ownership lease");
            var handle = new _OwnedRuntime.Handle(owner, pointer);
            try {
                checkpoint(); handles.add(handle); checkpoint();
                Object result = factories.create(node.id(), handle);
                if (!node.hostType().isInstance(result) || node.identity().apply(result) != handle)
                    throw new InvalidNative("Incorrect native identity factory");
                return result;
            } catch (Throwable error) { handle.close(); throw error; }
        }
        void complete() { require(); complete = true; }
        @Override public void close() {
            if (closed) return;
            closed = true; Throwable failure = null;
            try {
                if (!complete) for (var handle : handles) {
                    try { handle.close(); }
                    catch (Throwable error) { if (failure == null) failure = error; else failure.addSuppressed(error); }
                }
                for (var root : roots) {
                    try { root.release(false); }
                    catch (Throwable error) { if (failure == null) failure = error; else failure.addSuppressed(error); }
                }
            } finally {
                handles.clear(); roots.clear(); hosts.clear(); outputs.clear();${transferredInputs ? " moves = null;" : ""}
                if (arena != null) arena.close();
            }
            if (failure != null) throw _OwnedRuntime.rethrow(failure);
        }
    }
    static java.lang.foreign.MemorySegment checked(java.lang.foreign.MemorySegment pointer, long count, long width, long alignment) {
        if (count == 0) return java.lang.foreign.MemorySegment.NULL;
        long address = pointer.address();
        if (count < 0 || width < 1 || alignment < 1 || count > Long.MAX_VALUE / width
            || address == 0 || Long.remainderUnsigned(address, alignment) != 0
            || Long.compareUnsigned(address, -1L - count * width) > 0)
            throw new InvalidNative("Missing, misaligned or overflowing native span");
        // The authenticated adapter supplies readable memory. Arithmetic checks
        // cannot make an arbitrary foreign address safe to dereference.
        return pointer.reinterpret(count * width);
    }
    private static void require(_OwnedTypes.Node node, Object value) {
        if (value == null || (node.kind() == 0 ? value.getClass() != node.hostType() : !node.hostType().isInstance(value)))
            throw new IllegalArgumentException("Expected ownership value of type " + node.hostType().getTypeName());
        if (!node.inhabited()) throw new IllegalArgumentException("The declared type has no finite value");
    }
    private static final class Input {
        final _OwnedTypes.Node type;
        final Object value;
        final java.lang.foreign.MemorySegment raw;
        final int depth;
        final boolean storage;
        java.lang.foreign.MemorySegment data;
        int next = -1, count, tag;
        Input(_OwnedTypes.Node type, Object value, java.lang.foreign.MemorySegment raw, int depth, boolean storage) {
            this.type = type; this.value = value; this.raw = raw; this.depth = depth; this.storage = storage;
        }
    }
    static java.lang.foreign.MemorySegment write(int id, Object value, Scope scope) {
        return write(_OwnedTypes.CATALOG, id, value, scope);
    }
    static java.lang.foreign.MemorySegment write(_OwnedTypes.Catalog catalog, int id, Object value, Scope scope) {
        scope.require();
        var types = catalog.nodes(); var type = types[id]; var result = scope.allocate(type.size(), type.alignment());
        var stack = new java.util.ArrayDeque<Input>(); stack.push(new Input(type, value, result, 0, true));
        while (!stack.isEmpty()) {
            Input frame = stack.peek(); var node = frame.type;
            if (frame.next < 0) {
                scope.visit(frame.depth, node, frame.storage); require(node, frame.value);
                if (node.kind() == 0) { _OwnedScalars.write(node.scalar(), frame.value, frame.raw, scope); stack.pop(); continue; }
                if (node.kind() == 5) {
                    long pointer = scope.root(node.identity().apply(frame.value));
                    if (!scope.checkOnly) frame.raw.set(java.lang.foreign.ValueLayout.ADDRESS, 0, java.lang.foreign.MemorySegment.ofAddress(pointer));
                    stack.pop(); continue;
                }
                if (scope.hosts.put(frame.value, Boolean.TRUE) != null) throw new IllegalArgumentException("Cyclic ownership input");
                if (node.kind() == 1) {
                    frame.count = java.lang.reflect.Array.getLength(frame.value);
                    if (frame.count > scope.budget.nodes) throw new Limit("Ownership value node limit exceeded");
                    var element = types[node.element()]; scope.nativeBytes(frame.count, element.size());
                    frame.data = scope.allocate(frame.count * element.size(), element.alignment());
                    if (!scope.checkOnly) {
                        frame.raw.set(java.lang.foreign.ValueLayout.ADDRESS, 0, frame.data);
                        frame.raw.set(java.lang.foreign.ValueLayout.JAVA_LONG, 8, (long)frame.count);
                    }
                } else {
                    frame.tag = node.shape().branch(frame.value); frame.count = node.branches()[frame.tag].length;
                    if (!scope.checkOnly) {
                        if (node.kind() == 2) frame.raw.set(java.lang.foreign.ValueLayout.JAVA_INT, 0, frame.tag);
                        else if (node.kind() == 3) frame.raw.set(java.lang.foreign.ValueLayout.JAVA_BYTE, 0, (byte)frame.tag);
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
        final _OwnedTypes.Node type;
        java.lang.foreign.MemorySegment raw, data;
        final int depth;
        final boolean storage;
        Object result;
        Object[] fields;
        Address address;
        int next = -1, count, tag;
        Output(_OwnedTypes.Node type, java.lang.foreign.MemorySegment raw, int depth, boolean storage) {
            this.type = type; this.raw = raw; this.depth = depth; this.storage = storage;
        }
    }
    static Object read(int id, java.lang.foreign.MemorySegment raw, Scope scope) {
        return read(_OwnedTypes.CATALOG, id, raw, scope);
    }
    static Object read(_OwnedTypes.Catalog catalog, int id, java.lang.foreign.MemorySegment raw, Scope scope) {
        scope.require();
        if (scope.checkOnly) throw new IllegalStateException("Validation scopes cannot read native results");
        var types = catalog.nodes();
        var stack = new java.util.ArrayDeque<Output>(); stack.push(new Output(types[id], raw, 0, true));
        while (!stack.isEmpty()) {
            Output frame = stack.peek(); var node = frame.type;
            if (frame.next < 0) {
                scope.visit(frame.depth, node, frame.storage);
                if (!node.inhabited()) throw new InvalidNative("Uninhabited native ownership value");
                frame.raw = checked(frame.raw, 1, node.size(), node.alignment());
                frame.address = new Address(node.id(), frame.raw.address());
                if (!scope.outputs.add(frame.address)) throw new InvalidNative("Cyclic native ownership value");
                if (node.kind() == 0) frame.result = _OwnedScalars.read(node.scalar(), frame.raw, scope);
                else if (node.kind() == 5) frame.result = scope.identity(node, frame.raw.get(java.lang.foreign.ValueLayout.ADDRESS, 0).address());
                else if (node.kind() == 1) {
                    long count = frame.raw.get(java.lang.foreign.ValueLayout.JAVA_LONG, 8);
                    if (count < 0 || count > scope.budget.nodes) throw new Limit("Ownership value node limit exceeded");
                    var element = types[node.element()]; scope.nativeBytes(count, element.size());
                    scope.storage(count, 8); scope.storage(32, 1);
                    frame.data = checked(frame.raw.get(java.lang.foreign.ValueLayout.ADDRESS, 0), count, element.size(), element.alignment());
                    frame.count = (int)count; checkpoint();
                    frame.result = java.lang.reflect.Array.newInstance(node.hostType().componentType(), frame.count);
                } else {
                    frame.tag = node.kind() == 2 ? frame.raw.get(java.lang.foreign.ValueLayout.JAVA_INT, 0)
                        : node.kind() == 3 ? frame.raw.get(java.lang.foreign.ValueLayout.JAVA_BYTE, 0) : 0;
                    if (frame.tag < 0 || frame.tag >= node.branches().length) throw new InvalidNative("Invalid native ownership constructor or flag");
                    frame.count = node.branches()[frame.tag].length;
                    scope.storage(64L + frame.count * 16L, 1); checkpoint(); frame.fields = new Object[frame.count];
                }
                frame.next = 0;
            }
            if (frame.next == frame.count) {
                if (node.kind() > 1 && node.kind() < 5) { checkpoint(); frame.result = node.shape().create(frame.tag, frame.fields); }
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
        throw new IllegalStateException("Missing ownership result");
    }
}
`;

/** Preserve the borrow-only conversion runtime for existing consumers. */
export const ownedJvmConversionRuntime = ownedJvmConversionSupport();
