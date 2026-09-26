/**
 * Own JVM callback frames and thread-bound closure leases across native calls.
 *
 * @file
 */
export const state = `
    static final class ProcessGuard {
        private static final java.lang.invoke.MethodHandle PID = java.lang.foreign.Linker.nativeLinker().downcallHandle(
            java.lang.foreign.Linker.nativeLinker().defaultLookup().find("getpid").orElseThrow(), java.lang.foreign.FunctionDescriptor.of(java.lang.foreign.ValueLayout.JAVA_INT));
        private static int pid() {
            try { return (int)PID.invokeExact(); } catch (Throwable error) { throw new java.lang.ExceptionInInitializerError(error); }
        }
        private static final int PROCESS = pid();
        static boolean isCurrent() { return PROCESS == pid(); }
        static void ensure() {
            if (!isCurrent()) throw new IllegalStateException("Start a fresh process after fork to use Lean");
        }
        static void platformThread() {
            ensure();
            if (java.lang.Thread.currentThread().isVirtual()) throw new IllegalStateException("Lean callables require a platform thread");
        }
    }
    @SuppressWarnings("unchecked")
    static <E extends Throwable> RuntimeException rethrow(Throwable failure) throws E { throw (E)failure; }
    private static final java.lang.ThreadLocal<Integer> DEPTH = java.lang.ThreadLocal.withInitial(() -> 0);
    static void enterCall() {
        ProcessGuard.platformThread();
        int depth = DEPTH.get();
        if (depth == 64) throw new _GraphRuntime.Limit("Lean callable reentry limit exceeded");
        DEPTH.set(depth + 1);
    }
    static void leaveCall() { int depth = DEPTH.get() - 1; if (depth == 0) DEPTH.remove(); else DEPTH.set(depth); }
    static final class CallbackFrame implements java.lang.AutoCloseable {
        private volatile Throwable failure;
        private final java.lang.Thread thread = java.lang.Thread.currentThread();
        final _GraphTypes.Catalog catalog;
        final _GraphRuntime.Scope replies;
        final _GraphRuntime.Lifecycle lifecycle;
        private final java.util.ArrayList<Object> roots = new java.util.ArrayList<>();
        CallbackFrame(_GraphTypes.Catalog catalog, _GraphRuntime.Scope replies, _GraphRuntime.Lifecycle lifecycle) {
            this.catalog = catalog; this.replies = replies; this.lifecycle = lifecycle;
        }
        void keep(Object callback) { roots.add(callback); }
        void before() {
            ProcessGuard.platformThread();
            if (java.lang.Thread.currentThread() != thread) throw new IllegalStateException("A callback must run on its initiating thread");
            lifecycle.after();
        }
        synchronized void fail(Throwable error) { if (failure == null) failure = error; }
        void finish(int status) {
            if (failure != null) throw rethrow(failure);
            if (status == 6) throw new LeanBridgeException(6, "Host callback failed", null);
            _GraphRuntime.status(status);
        }
        @Override public void close() { java.lang.ref.Reference.reachabilityFence(roots); roots.clear(); }
    }
    private static final java.lang.ref.Cleaner CLEANER = java.lang.ref.Cleaner.create();
    static final class ClosureLease implements Runnable {
        private final java.lang.invoke.MethodHandle release;
        private final java.lang.Thread thread = java.lang.Thread.currentThread();
        private long token;
        private int active;
        private boolean closed;
        ClosureLease(java.lang.invoke.MethodHandle release) { ProcessGuard.platformThread(); this.release = release; }
        void adopt(java.lang.foreign.MemorySegment output) {
            long value = output.get(java.lang.foreign.ValueLayout.JAVA_LONG, 0);
            if (value == 0) throw new _GraphRuntime.InvalidNative("Missing returned Lean closure");
            token = value; output.set(java.lang.foreign.ValueLayout.JAVA_LONG, 0, 0L);
        }
        boolean isClosed() { ProcessGuard.ensure(); synchronized (this) { return closed; } }
        long enter() {
            ProcessGuard.platformThread();
            synchronized (this) {
                if (closed || token == 0) throw new IllegalStateException("Lean closure is closed");
                if (thread != java.lang.Thread.currentThread()) throw new IllegalStateException("Lean closure must be invoked on its creating thread");
                if (active == 64) throw new _GraphRuntime.Limit("Lean closure reentry limit exceeded");
                ++active; return token;
            }
        }
        synchronized void leave() { --active; if (closed && active == 0) drop(); }
        void close() {
            ProcessGuard.ensure();
            synchronized (this) { closed = true; if (active == 0) drop(); }
        }
        private void drop() {
            if (token == 0) return;
            long value = token; token = 0;
            try { release.invokeExact(value); } catch (Throwable error) { throw rethrow(error); }
        }
        @Override public void run() {
            try { if (ProcessGuard.isCurrent()) close(); } catch (Throwable ignored) { }
        }
    }
    static java.lang.ref.Cleaner.Cleanable register(Object owner, ClosureLease lease) { return CLEANER.register(owner, lease); }
`;
