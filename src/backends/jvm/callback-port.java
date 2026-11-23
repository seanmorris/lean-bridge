package __PACKAGE__;

import java.lang.foreign.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.*;

/** One serial callback consumer per invocation. Completion and retirement remain
 * independently observable even while arbitrary application code is blocked. */
final class CallbackPort<T> extends TaskPort<T> {
    interface Slot { Request read(Wire f); }
    interface Request { Reply invoke() throws Throwable; }
    interface Reply { void write(Wire f); }
    interface Decode<T> { T read(Wire f, int status, State state); }
    static <A,B> Slot bind(Function<Wire,A> read, Function<A,B> call, BiConsumer<Wire,B> write) {
        return f -> { A arg = read.apply(f); return () -> { B reply = call.apply(arg); return out -> write.accept(out, reply); }; };
    }
    static final class State {
        Slot[] slots; final ArrayList<Throwable> errors = new ArrayList<>();
        State(Slot[] slots) { this.slots = slots; }
        RuntimeException original(long id) {
            if (id <= 0 || id > errors.size()) throw Wire.corrupt("Invalid Lean callback failure identity");
            return propagate(errors.get((int)id - 1));
        }
    }
    // Delivery unwraps the private completion envelope once. An exception thrown
    // by the user isn't cancellation of the future, even if its type says cancel.
    private static CompletionException propagate(Throwable e) {
        // The one-argument constructor calls the user's Throwable.toString().
        // Supply the message explicitly, including for the envelope seen by join.
        return new CompletionException(null, new CompletionException(null, e));
    }
    private static final ThreadLocal<CallbackPort<?>> invoking = new ThreadLocal<>();
    static void checkWait(TaskPort<?> port) {
        if (invoking.get() == port) throw new IllegalStateException("Cannot wait on a task from its own active callback");
    }
    private record Outcome<V>(V value, Throwable error) {}
    private final Object readLock = new Object();
    private CompletableFuture<Void> doneSignal;
    private CompletableFuture<Void> signal(CompletableFuture<?> f) {
        // A timed-out get must not leave a new dependent attached on every try.
        synchronized (readLock) {
            if (doneSignal == null) doneSignal = f.handle((v,e) -> null);
            return doneSignal;
        }
    }
    private static <V> V checkedValue(CompletableFuture<V> f) throws ExecutionException {
        // Read the current outcome (including obtrudeValue/obtrudeException), not a
        // cached result. Stock Future.get calls Throwable.toString() in its wrapper.
        Outcome<V> result = f.handle(Outcome<V>::new).join(); Throwable error = result.error();
        if (error == null) return result.value();
        if (error instanceof CancellationException cancelled) throw cancelled;
        if (error instanceof CompletionException completion) {
            Throwable cause = completion.getCause(); if (cause != null) error = cause;
        }
        throw new ExecutionException(null, error);
    }
    <V> V checkedGet(CompletableFuture<V> f) throws InterruptedException, ExecutionException {
        if (!f.isDone()) signal(f).get(); return checkedValue(f);
    }
    <V> V checkedGet(CompletableFuture<V> f, long timeout, TimeUnit unit) throws InterruptedException, ExecutionException, TimeoutException {
        Objects.requireNonNull(unit);
        if (!f.isDone()) signal(f).get(timeout, unit); return checkedValue(f);
    }
    private final State state;
    private TaskReactor.Watch incoming;
    private boolean ended;
    private Throwable failure;
    CallbackPort(int method, int slots, int tags, Consumer<Wire> input, Decode<T> read, Slot[] bindings) {
        this(method, slots, tags, input, read, new State(bindings));
    }
    private CallbackPort(int method, int slots, int tags, Consumer<Wire> input, Decode<T> read, State state) {
        super(method, slots, tags, input, (f,s) -> Wire.success(s), (f,s) -> read.read(f, s, state));
        this.state = state;
    }
    @Override synchronized void start() { super.start(); Thread.startVirtualThread(this::serve); }
    private void unlisten() { if (incoming != null) { incoming.close(); incoming = null; } }
    @Override int call(int op, Arena a, MemorySegment args, MemorySegment out, MemorySegment tags) {
        // take can destroy the port/file descriptor. Deregister before the
        // kernel can reuse its number, not after the Java future completes.
        if (op == 2) { ended = true; unlisten(); }
        return super.call(op, a, args, out, tags);
    }
    @Override public synchronized void close() {
        ended = true; unlisten(); state.slots = null; state.errors.clear(); super.close();
    }
    @Override T await() {
        try { return super.await(); }
        catch (Throwable e) { synchronized (this) { if (failure != null) throw propagate(failure); } throw e; }
    }
    @SuppressWarnings("removal")
    private static boolean fatal(Throwable e) { return e instanceof VirtualMachineError || e instanceof LinkageError || e instanceof ThreadDeath; }
    private void fail(Throwable e, boolean retire) {
        synchronized (this) {
            if (!ended) failure = e;
            try { if (retire) Wire.retireCallbackRuntime(); }
            finally { close(); }
        }
    }
    private void record(Throwable error) {
        synchronized (this) { if (ended) return; }
        // getMessage may itself throw, block, cancel, or reenter another package.
        String text;
        try { text = error.getMessage(); }
        catch (Throwable message) { if (fatal(message)) throw message; text = null; }
        try (var frame = new Wire(1, 1)) {
            try { frame.text(0, text == null ? "JVM callback failed" : text); }
            catch (IllegalArgumentException invalidText) { frame.text(0, "JVM callback failed"); }
            synchronized (this) {
                if (ended) return;
                state.errors.add(error); Wire.success(frame.task(this, 9));
                if (frame.scalar() != state.errors.size()) throw Wire.corrupt("Inconsistent Lean callback failure identity");
            }
        }
    }
    private void serve() {
        invoking.set(this);
        try {
            for (;;) {
                Request request = null; int slot = -1; TaskReactor.Watch watch = null;
                synchronized (this) {
                    if (ended) return;
                    try (var frame = new Wire(1, 1)) {
                        int status = frame.task(this, 6);
                        if (status == 1) {
                            Wire.success(frame.task(this, 5)); long fd = frame.scalar();
                            if (fd < 0 || fd > Integer.MAX_VALUE) throw Wire.corrupt("Invalid callback descriptor");
                            incoming = watch = TaskReactor.listen((int)fd);
                        } else {
                            Wire.success(status); long index = frame.scalar();
                            if (index < 0 || index >= state.slots.length || state.slots[(int)index] == null)
                                throw Wire.corrupt("Unknown retained callback slot");
                            slot = (int)index; frame.word(0, slot); Wire.success(frame.task(this, 7));
                            request = state.slots[slot].read(frame);
                        }
                    }
                }
                if (watch != null) {
                    try { watch.ready.join(); } finally { synchronized (this) { if (watch == incoming) unlisten(); } }
                    continue;
                }
                Reply reply;
                // No bridge lock, confined frame or native stack crosses a user invocation.
                try { reply = request.invoke(); }
                catch (Throwable e) { if (fatal(e)) throw e; record(e); continue; }
                synchronized (this) { if (ended) return; }
                try (var frame = new Wire(2, 1)) {
                    reply.write(frame); frame.word(1, slot);
                    synchronized (this) { if (ended) return; Wire.success(frame.task(this, 8)); }
                }
            }
        } catch (Throwable e) { fail(e, fatal(e)); }
        finally { invoking.remove(); }
    }
}
