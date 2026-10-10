/**
 * Creator-thread Java leases for resource-containing Lean values.
 *
 * @file
 */

import { ownedJvmWholeGuard } from "./owned-borrows.mjs";

export const ownedJvmException = `public final class LeanBridgeException extends RuntimeException {
    private static final long serialVersionUID = 1L;
    private final int status;
    LeanBridgeException(int status, String message) { super(message); this.status = status; }
    public int status() { return status; }
}
`;

/**
 * Emit private lifetime support. Cleaner actions queue releases; only the
 * creating platform thread can enter a native session. Native TLS destruction
 * reclaims abandoned sessions even if Java Thread objects remain reachable.
 *
 * @param prefix - Checked public C package identifier.
 * @param options - Explicit transport capabilities.
 * @param options.transferredInputs - Enable native handoff signals.
 * @param options.anchoredResults - Preserve original-owner borrowed results.
 * @param options.wholeOwners - Keep complete owners without requiring result anchors.
 */
export const ownedJvmRuntime = (prefix, { transferredInputs = false, anchoredResults = false, wholeOwners = anchoredResults } = {}) => {
	if(!/^[a-z][a-z0-9_]*$/u.test(prefix) || prefix.includes("__")) throw new TypeError("Invalid owned JVM prefix");
	return `import java.lang.foreign.Arena;
import java.lang.foreign.FunctionDescriptor;
import java.lang.foreign.Linker;
import java.lang.foreign.MemorySegment;
import java.lang.foreign.SymbolLookup;
import java.lang.invoke.MethodHandle;
import java.lang.ref.Cleaner;
import java.util.HashSet;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import static java.lang.foreign.ValueLayout.*;

final class _OwnedRuntime {
    private static final Cleaner CLEANER = Cleaner.create();
    final MethodHandle open, close, release;${anchoredResults ? "\n    private final MethodHandle validate;" : ""}
    private final MethodHandle processValid;
    private final Runnable before;
    private final ThreadLocal<State> states = new ThreadLocal<>();
    _OwnedRuntime(SymbolLookup symbols) { this(symbols, () -> { }); }
    _OwnedRuntime(SymbolLookup symbols, Runnable before) {
        if (!System.getProperty("os.name").equals("Linux") || ADDRESS.byteSize() != 8
            || !java.util.Set.of("amd64", "x86_64").contains(System.getProperty("os.arch"))
            || java.nio.ByteOrder.nativeOrder() != java.nio.ByteOrder.LITTLE_ENDIAN)
            throw new UnsupportedOperationException("This Lean package requires Linux x86-64");
        var linker = Linker.nativeLinker();
        var pointer = FunctionDescriptor.of(JAVA_INT, ADDRESS);
        open = linker.downcallHandle(symbols.find("${prefix}_jvm_session_open").orElseThrow(), pointer);
        close = linker.downcallHandle(symbols.find("${prefix}_session_close").orElseThrow(), pointer);
        release = linker.downcallHandle(symbols.find("${prefix}_result_release").orElseThrow(), pointer);
${anchoredResults ? `        validate = linker.downcallHandle(symbols.find("${prefix}_result_validate").orElseThrow(), FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS));\n` : ""}\
        processValid = linker.downcallHandle(symbols.find("lean_bridge_native_process_valid").orElseThrow(), FunctionDescriptor.of(JAVA_INT));
        this.before = java.util.Objects.requireNonNull(before);
    }
    @SuppressWarnings("unchecked")
    static <E extends Throwable> RuntimeException rethrow(Throwable error) throws E { throw (E)error; }
    boolean isProcessValid() {
        try { return (int)processValid.invokeExact() != 0; } catch (Throwable error) { throw rethrow(error); }
    }
    void ensureProcess() { if (!isProcessValid()) check(6); before.run(); }
    void platformThread() {
        ensureProcess();
        if (Thread.currentThread().isVirtual()) throw new IllegalStateException("Lean owned values require a platform thread");
    }
    State current() {
        platformThread(); State state = states.get();
        if (state == null) {
            checkpoint(); state = new State(this);
            // Install the Java root before opening a native session. A failed
            // ThreadLocal allocation must not strand an untracked native owner.
            states.set(state);
            try { checkpoint(); state.initialize(); }
            catch (Throwable error) { states.remove(); throw error; }
        }
        return state;
    }
    static void checkpoint() { }
    static int pointerCall(MethodHandle call, MemorySegment pointer) {
        try { return (int)call.invokeExact(pointer); } catch (Throwable error) { throw rethrow(error); }
    }
    static void check(int status) {
        if (status == 0) return;
        throw new LeanBridgeException(status, switch (status) {
            case 1 -> "Invalid argument"; case 2 -> "Ownership limit exceeded";
            case 3 -> "Native allocation failed"; case 4 -> "Resource is closed";
            case 5 -> "Resource belongs to another thread"; case 6 -> "Start a fresh process after fork";
            case 7 -> "Lean runtime is unavailable"; case 8 -> "Invalid native call order";
            case 9 -> "Malformed native result"; case 10 -> "Host callback failed";
            default -> "Unknown native ownership status";
        });
    }
    static final class Slot {
        volatile long value;
        final AtomicBoolean pending = new AtomicBoolean();
        boolean releasing;
    }
    static final class State implements AutoCloseable {
        final _OwnedRuntime runtime;
        final Thread thread = Thread.currentThread();
        private final HashSet<Slot> slots = new HashSet<>();
        private volatile long session;
        private volatile boolean closed;
        private boolean draining;
        State(_OwnedRuntime runtime) { this.runtime = runtime; }
        void initialize() {
            runtime.platformThread();
            try (var arena = Arena.ofConfined()) {
                var out = arena.allocate(JAVA_LONG); out.set(JAVA_LONG, 0, 0);
                check(pointerCall(runtime.open, out)); session = out.get(JAVA_LONG, 0);
                if (session == 0) check(9);
            }
        }
        boolean isClosed() { return closed || session == 0 || !thread.isAlive() || !runtime.isProcessValid(); }
        void affinity() {
            runtime.platformThread();
            if (!thread.isAlive()) check(4);
            if (thread != Thread.currentThread()) check(5);
        }
        long require() { affinity(); if (closed || session == 0) check(4); drain(); return session; }
        Slot register() {
            require(); checkpoint(); var slot = new Slot();
            checkpoint(); slots.add(slot); return slot;
        }
        void release(Slot slot, boolean cleaning) {
            slot.pending.set(true);
            // A Cleaner never acquires native locks or enters another thread's session.
            if (!cleaning && thread == Thread.currentThread() && runtime.isProcessValid()) drain();
        }
        void drain() {
            affinity(); if (draining) return; draining = true;
            try (var arena = Arena.ofConfined()) {
                var out = arena.allocate(JAVA_LONG);
                while (true) {
                    Slot selected = null;
                    for (var slot : slots) if (slot.pending.get() && !slot.releasing) { selected = slot; break; }
                    if (selected == null) return;
                    out.set(JAVA_LONG, 0, selected.value); selected.releasing = true;
                    int status;
                    try { status = pointerCall(runtime.release, out); }
                    finally {
                        selected.value = out.get(JAVA_LONG, 0); selected.releasing = false;
                        if (selected.value == 0) slots.remove(selected);
                    }
                    check(status); if (selected.value != 0) check(9);
                }
            } finally { draining = false; }
        }
        @Override public void close() {
            affinity();
            if (!closed) {
                try (var arena = Arena.ofConfined()) {
                    var out = arena.allocate(JAVA_LONG); out.set(JAVA_LONG, 0, session);
                    int status = pointerCall(runtime.close, out); session = out.get(JAVA_LONG, 0);
                    check(status); closed = true;
                }
            }
            for (var slot : slots) slot.pending.set(true);
            drain();
        }
    }
${wholeOwners ? ownedJvmWholeGuard : ""}\
    static final class BorrowScope { volatile boolean active = true; }
    static final class Lease {
        final State state;
        final Slot slot;
        final BorrowScope scope;
        private final AtomicInteger references = new AtomicInteger();
        private volatile boolean revoked;${transferredInputs ? "\n        volatile _OwnedInputTransfers.Signal inputMove;" : ""}
${wholeOwners ? `        final boolean borrowedResult, whole;
        Lease(State state, Slot slot, BorrowScope scope) { this(state, slot, scope, false, false); }
        Lease(State state, Slot slot, BorrowScope scope, boolean borrowedResult, boolean whole) {
            this.state = state; this.slot = slot; this.scope = scope;
            this.borrowedResult = borrowedResult; this.whole = whole;
        }
        long owner(State state) {
            require(); if (this.state != state || scope != null || slot == null) check(1);
            return slot.value;
        }` : "        Lease(State state, Slot slot, BorrowScope scope) { this.state = state; this.slot = slot; this.scope = scope; }"}
        boolean isClosed() {${transferredInputs ? "\n            var move = inputMove;" : ""}
            ${anchoredResults ? "boolean closed =" : "return"} state.isClosed() || revoked || (scope != null ? !scope.active
                : slot == null || slot.value == 0 || slot.pending.get() || slot.releasing)${transferredInputs ? "\n                || move != null && move.consumed()" : ""};${anchoredResults ? `
            if (closed || !borrowedResult) return closed;
            var session = MemorySegment.ofAddress(state.require());
            try {
                int status = (int)state.runtime.validate.invokeExact(session, MemorySegment.ofAddress(slot.value));
                if (status == 4) return true; check(status); return false;
            } catch (Throwable error) { throw rethrow(error); }` : ""}
        }
        int references() { return references.get(); }
        void require() { state.require(); if (isClosed()) check(4); }
        void acquire() {
            require();
            while (true) {
                int old = references.get(); if (old == Integer.MAX_VALUE) check(2);
                if (references.compareAndSet(old, old + 1)) return;
            }
        }
        void release(boolean cleaning) { if (references.decrementAndGet() == 0 && slot != null) state.release(slot, cleaning); }
        void revoke() { revoked = true; if (slot != null) state.release(slot, false); }
    }
    static final class Result implements AutoCloseable {
        final State state;
        private final Arena arena;
        private final MemorySegment out;
        private Slot slot;
        private Lease lease;
        private boolean complete, captured;
        ${transferredInputs ? `Result(State state) { this(state, false); }
        Result(State state, boolean shared) {` : "Result(State state) {"}
            this.state = state; state.require(); arena = ${transferredInputs ? "shared ? Arena.ofShared() : " : ""}Arena.ofConfined();
            try { out = arena.allocate(JAVA_LONG); out.set(JAVA_LONG, 0, 0); slot = state.register(); }
            catch (Throwable error) { arena.close(); throw error; }
        }
        MemorySegment output() { state.require(); if (slot == null) check(4); if (captured) check(8); return out; }
${wholeOwners ? "        Lease adopt() { return adopt(false, false); }\n        Lease adopt(boolean borrowedResult, boolean whole) {" : "        Lease adopt() {"}
            state.require(); if (slot == null) check(4);
            if (!captured) { slot.value = out.get(JAVA_LONG, 0); out.set(JAVA_LONG, 0, 0); captured = true; }
            if (slot.value == 0) check(9);
            if (lease == null) { checkpoint(); lease = new Lease(state, slot, null${wholeOwners ? ", borrowedResult, whole" : ""}); }
            return lease;
        }
        void complete() { state.require(); complete = true; }
        @Override public void close() {
            state.affinity(); var saved = slot; if (saved == null) return;
            slot = null; if (!captured) saved.value = out.get(JAVA_LONG, 0); arena.close();
            if (complete && lease != null && lease.references() > 0) { lease = null; return; }
            if (lease != null) lease.revoke(); else state.release(saved, false);
            lease = null;
        }
    }
    static final class BorrowFrame implements AutoCloseable {
        final Lease lease;
        private final BorrowScope scope;
        BorrowFrame(State state) {
            state.require(); checkpoint(); scope = new BorrowScope();
            checkpoint(); lease = new Lease(state, null, scope);
        }
        @Override public void close() { scope.active = false; }
    }
    private static final class Drop implements Runnable {
        final Lease lease;
        final AtomicBoolean closed = new AtomicBoolean();
        Drop(Lease lease) { this.lease = lease; }
        void close(boolean cleaning) { if (closed.compareAndSet(false, true)${wholeOwners ? " && !lease.whole" : ""}) lease.release(cleaning); }
        @Override public void run() { close(true); }
    }
    static final class Handle implements AutoCloseable {
        final Lease lease;
        private final long value;
        private final Drop drop;
        private final Cleaner.Cleanable cleanable;
        Handle(Lease lease, long value) {
            if (value == 0) check(9);
            this.lease = lease; this.value = value; checkpoint(); drop = new Drop(lease);
            ${wholeOwners ? "if (!lease.whole) " : ""}lease.acquire();
            try { checkpoint(); cleanable = CLEANER.register(this, drop); }
            catch (Throwable error) { drop.close(false); throw error; }
        }
        boolean isClosed() { return drop.closed.get() || lease.isClosed(); }
        long raw(State state) {
            lease.require(); if (isClosed()) check(4);
            if (lease.state != state) check(1); return value;
        }
        @Override public void close() {
            lease.state.runtime.ensureProcess(); drop.close(false); cleanable.clean();
        }
    }
}
`;
};
