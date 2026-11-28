package example;

public final class FrameCheck {
    static final Exception FIRST = new Exception("same text"), SECOND = new Exception("same text");
    static final HostMembers PORT = HostContract.bind(Void.class, FrameCheck.class);
    static final ThreadLocal<Boolean> NESTED = new ThreadLocal<>();
    static volatile Thread owner;
    static volatile Error injected;
    static int callsAfterFailure;
    private static native Object call(HostMembers port, int operation, long arg) throws Exception;
    public static long observe(long arg) throws Exception {
        if (owner != null && owner != Thread.currentThread() && NESTED.get() != null)
            throw new AssertionError("reentry changed Java thread");
        if (arg == 11) throw FIRST;
        if (arg == 12) throw SECOND;
        if (arg == 21) throw injected;
        if (arg == 22) ++callsAfterFailure;
        if (arg == 13) {
            owner = Thread.currentThread(); NESTED.set(true);
            try { return (Long)call(PORT, 0, 14); }
            finally { NESTED.remove(); }
        }
        if (arg == 14 && (NESTED.get() == null || Thread.currentThread() != owner)) throw new AssertionError("not inline");
        return arg * 2;
    }
    static void check(boolean b) { if (!b) throw new AssertionError(); }
    @SuppressWarnings("removal")
    public static void main(String[] args) throws Exception {
        System.load(args[0]);
        check((Long)call(PORT, 0, 5) == 11);
        check((Long)call(PORT, 0, 13) == 30);
        try { call(PORT, 0, 11); throw new AssertionError(); } catch (Exception e) { check(e == FIRST); }
        try { call(PORT, 3, 11); throw new AssertionError(); } catch (Exception e) { check(e == FIRST); }
        check("mapped in Lean".equals(call(PORT, 1, 11)));
        try { call(PORT, 2, 11); throw new AssertionError(); } catch (IllegalStateException e) {
            check("replacement Lean IO error".equals(e.getMessage()));
        }
        for (int i = 0; i < 64; i++) {
            try { call(PORT, 0, 12); throw new AssertionError(); } catch (Exception e) { check(e == SECOND); }
        }
        var task = new java.util.concurrent.FutureTask<>(() -> call(PORT, 0, 7));
        Thread.startVirtualThread(task); check((Long)task.get() == 15);
        // Lean's firstError tries another host call after catching the first
        // IO error. It must not run Java code once the failure is terminal.
        injected = new AssertionError("ordinary application error");
        check("mapped in Lean".equals(call(PORT, 1, 21)));
        for (Error fault : new Error[]{new LinkageError("link"),new OutOfMemoryError("injected"),new ThreadDeath()}) {
            injected = fault;
            try { call(PORT, 3, 21); throw new AssertionError("fatal swallowed"); }
            catch (Error seen) { check(seen == fault); }
            if (callsAfterFailure != 0) throw new AssertionError("host effect after fatal: "+callsAfterFailure);
        }
        System.out.println("compiled Lean: inline reentry, exact throwable, replacement IO, typed EIO, virtual thread");
    }
}
