package __PACKAGE__;

import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import static java.lang.foreign.ValueLayout.*;

/** No timers and no user callbacks on the waiter. Idle components own no thread or fd. */
final class TaskReactor {
    private static final MethodHandle WATCH = Linker.nativeLinker().downcallHandle(
        NativeAssets.lookup().find("__WATCH__").orElseThrow(), FunctionDescriptor.of(JAVA_LONG, JAVA_INT, JAVA_INT, JAVA_INT, JAVA_LONG));
    private static long control(int op, int ep, int fd, long token) {
        NativeAssets.ensureProcess();
        try { return (long) WATCH.invokeExact(op, ep, fd, token); }
        catch (RuntimeException | Error e) { throw e; }
        catch (Throwable e) { throw new IllegalStateException("Native task readiness failed", e); }
    }
    private static final Object lock = new Object();
    private static TaskReactor active;
    private long serial;
    private final int ep, wake;
    private final HashMap<Long, Watch> members = new HashMap<>();
    private TaskReactor() {
        long pair = control(0, -1, -1, 0);
        if (pair < 0) throw new IllegalStateException("Lean runtime is unavailable for task readiness");
        ep = (int)(pair >>> 32); wake = (int)pair;
    }
    static final class Watch implements AutoCloseable {
        final TaskReactor group; final int fd; final long token;
        final CompletableFuture<Void> ready = new CompletableFuture<>();
        Watch(TaskReactor group, int fd, long token) { this.group = group; this.fd = fd; this.token = token; }
        @Override public void close() {
            synchronized (lock) {
                if (group.remove(token) != null && group.members.isEmpty()) control(4, group.ep, group.wake, 0);
            }
            ready.complete(null); // Only bridge workers can be waiting on this future.
        }
    }
    private Watch remove(long token) {
        Watch w = members.remove(token);
        if (w != null && w.fd >= 0) control(2, ep, w.fd, token);
        return w;
    }
    static Watch listen(int fd) {
        synchronized (lock) {
            boolean first = active == null;
            TaskReactor g = first ? new TaskReactor() : active;
            Watch w = null;
            try {
                long token = Math.incrementExact(g.serial); g.serial = token;
                w = new Watch(g, fd, token);
                if (fd >= 0 && control(1, g.ep, fd, token) != 0) throw new IllegalStateException("Cannot subscribe to Lean task readiness");
                g.members.put(token, w);
                if (first) {
                    Thread.ofPlatform().daemon().name("Lean task readiness").start(g::run); active = g;
                }
                return w;
            } catch (Throwable e) {
                if (w != null) g.remove(w.token);
                if (first) control(5, g.ep, g.wake, 0);
                throw e;
            }
        }
    }
    private void run() {
        Throwable failure = null; List<Watch> abandoned;
        try {
            for (;;) {
                synchronized (lock) {
                    if (members.isEmpty()) { active = null; control(5, ep, wake, 0); return; }
                }
                long token = control(3, ep, wake, 0);
                if (token == -2) throw new IllegalStateException("Lean runtime is unavailable (retired)");
                if (token < 0) throw new IllegalStateException("Cannot wait for Lean task readiness");
                Watch w;
                synchronized (lock) { w = remove(token); }
                if (w != null) w.ready.complete(null);
            }
        } catch (Throwable e) { failure = e; }
        synchronized (lock) {
            abandoned = new ArrayList<>(members.values()); members.clear();
            active = null; control(5, ep, wake, 0);
        }
        for (Watch w : abandoned) w.ready.completeExceptionally(failure);
    }
}
