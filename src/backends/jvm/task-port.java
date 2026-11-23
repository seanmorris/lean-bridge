package __PACKAGE__;

import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.util.concurrent.*;
import java.util.function.*;
import static java.lang.foreign.ValueLayout.*;

/** A handle never crosses the public API. No confined segment or thread-affine Java object escapes a call. */
final class TaskPort<T> implements AutoCloseable {
    private static final class Native {
        static final MethodHandle CONTROL = Linker.nativeLinker().downcallHandle(NativeAssets.lookup().find("__TASK__").orElseThrow(),
            FunctionDescriptor.of(JAVA_INT, JAVA_INT, JAVA_INT, ADDRESS, ADDRESS, ADDRESS, ADDRESS, ADDRESS));
    }
    private final int method, slots, tags;
    private Consumer<Wire> input;
    private final BiConsumer<Wire,Integer> factory;
    private final BiFunction<Wire,Integer,T> result;
    private long id, domain; private int fd;
    private TaskReactor.Watch watch; private boolean closed;
    TaskPort(int method, int slots, int tags, Consumer<Wire> input, BiConsumer<Wire,Integer> factory, BiFunction<Wire,Integer,T> result) {
        this.method=method; this.slots=slots; this.tags=tags; this.input=input; this.factory=factory; this.result=result;
    }
    int call(int op, Arena arena, MemorySegment args, MemorySegment out, MemorySegment tags) {
        NativeAssets.ensureProcess();
        var h = arena.allocate(16, 8); h.set(JAVA_LONG, 0, id); h.set(JAVA_LONG, 8, domain);
        var dest = arena.allocate(JAVA_INT); dest.set(JAVA_INT, 0, -1);
        try {
            int s = (int)Native.CONTROL.invokeExact(method, op, args, h, out, tags, dest);
            id = h.get(JAVA_LONG, 0); domain = h.get(JAVA_LONG, 8); fd = dest.get(JAVA_INT, 0);
            return s;
        } catch (RuntimeException | Error e) { throw e; }
        catch (Throwable e) { throw new IllegalStateException("Lean task downcall failed", e); }
    }
    synchronized void start() {
        check();
        try (var f = new Wire(slots, tags)) {
            var args = input; input = null;
            args.accept(f); factory.accept(f, f.task(this, 0));
            if (id == 0) throw new IllegalStateException("Lean factory returned no owner");
        }
    }
    private void check() { if (closed) throw new CancellationException(); }
    synchronized void pull() { check(); try (var f = new Wire(0, 1)) { Wire.success(f.task(this, 4)); } }
    private synchronized void unwatch(TaskReactor.Watch w) { if (watch == w) { w.close(); watch = null; } }
    void idle(CompletableFuture<Void> demand) {
        TaskReactor.Watch w;
        synchronized (this) { check(); watch = w = TaskReactor.listen(-1); }
        try { CompletableFuture.anyOf(w.ready, demand).join(); }
        finally { unwatch(w); }
    }
    T await() {
        for (;;) {
            TaskReactor.Watch w;
            synchronized (this) {
                check();
                try (var f = new Wire(0, tags)) {
                    int state = f.task(this, 1);
                    if (state == 0) return result.apply(f, f.task(this, 2));
                    if (state != 1) Wire.success(state);
                    if (fd < 0) throw new IllegalStateException("Missing Lean completion descriptor");
                    watch = w = TaskReactor.listen(fd);
                }
            }
            try { w.ready.join(); } finally { unwatch(w); }
        }
    }
    @Override public synchronized void close() {
        if (closed) return; closed = true; input = null;
        if (watch != null) unwatch(watch);
        if (id != 0) try (var f = new Wire(0, 1)) {
            int status = f.task(this, 3);
            // A failed native pull may already have discarded its cursor.
            if (status != 6) Wire.success(status);
            id = 0;
        }
    }
}
