package __PACKAGE__;

import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.lang.ref.Cleaner;
import java.lang.ref.Reference;
import java.util.*;
import java.util.function.*;
import static java.lang.foreign.ValueLayout.*;

/** Single-pass, demand-driven iterator. Close it when leaving a loop early. */
public final class LeanCursor<T> implements Iterator<T>, Iterable<T>, AutoCloseable {
    private static final Cleaner CLEANER = Cleaner.create();
    private static final Set<State<?>> LIVE = new HashSet<>();
    private static Thread hook;
    private static boolean ending;
    private static void drain() {
        State<?>[] open;
        synchronized (LIVE) { ending = true; open = LIVE.toArray(State<?>[]::new); }
        Throwable failure = null;
        for (var s : open) {
            try { s.run(); } catch (RuntimeException | Error e) {
                if (failure == null) failure = e; else failure.addSuppressed(e);
            }
        }
        if (failure instanceof RuntimeException e) throw e;
        if (failure instanceof Error e) throw e;
    }
    private static void track(State<?> state) {
        synchronized (LIVE) {
            if (ending) throw new IllegalStateException("Lean cursors are shutting down");
            if (hook == null) {
                Thread thread = Thread.ofPlatform().inheritInheritableThreadLocals(false)
                    .name("Lean cursor shutdown").unstarted(LeanCursor::drain);
                Runtime.getRuntime().addShutdownHook(thread);
                hook = thread;
            }
            LIVE.add(state);
        }
    }
    private static void untrack(State<?> state) {
        synchronized (LIVE) {
            if (LIVE.remove(state) && LIVE.isEmpty() && !ending) {
                try { Runtime.getRuntime().removeShutdownHook(hook); hook = null; }
                catch (IllegalStateException shutdownAlreadyStarted) { ending = true; }
            }
        }
    }
    private static final class State<T> implements Runnable {
        private static final MethodHandle CALL = Linker.nativeLinker().downcallHandle(
            NativeAssets.lookup().find("__CURSOR__").orElseThrow(),
            FunctionDescriptor.of(JAVA_INT, JAVA_INT, JAVA_INT, ADDRESS, ADDRESS, ADDRESS, ADDRESS));
        private final int method, depth;
        private final BiFunction<Wire,Integer,T> decode;
        private final Consumer<T> discard;
        private final Arena arena;
        private final MemorySegment h;
        private boolean closed;
        private T cached;
        State(int method, int depth, BiFunction<Wire,Integer,T> decode, Consumer<T> discard) {
            this.method = method; this.depth = depth; this.decode = decode; this.discard = discard;
            arena = Arena.ofShared();
            try { h = arena.allocate(16, 8); } catch (Throwable e) { arena.close(); throw e; }
        }
        int call(int op, MemorySegment args, MemorySegment out, MemorySegment tags) {
            NativeAssets.ensureProcess();
            try { return (int)CALL.invokeExact(method, op, args, h, out, tags); }
            catch (RuntimeException | Error e) { throw e; }
            catch (Throwable e) { throw new IllegalStateException("Cannot call the Lean cursor", e); }
        }
        int call(Wire f, int op) { return call(op, f.cursorArgs(), f.cursorOut(), f.cursorTags()); }
        void fail(Throwable e) { try { run(); } catch (Throwable cleanup) { e.addSuppressed(cleanup); } }
        synchronized void open(int slots, Consumer<Wire> input, BiConsumer<Wire,Integer> factory) {
            try (var f = new Wire(slots, depth)) {
                track(this);
                input.accept(f);
                factory.accept(f, call(f, 0));
                if (h.get(JAVA_LONG, 0) == 0) throw new IllegalStateException("Missing Lean cursor handle");
            } catch (RuntimeException | Error e) { fail(e); throw e; }
        }
        synchronized boolean ready() {
            if (closed || cached != null) return !closed;
            try (var f = new Wire(0, depth)) {
                int status = call(f, 1);
                if (status == 2) { run(); return false; }
                cached = Objects.requireNonNull(decode.apply(f, status));
                return true;
            } catch (RuntimeException | Error e) { fail(e); throw e; }
        }
        synchronized T take() {
            if (!ready()) throw new NoSuchElementException();
            T value = cached; cached = null; return value;
        }
        @Override public synchronized void run() {
            if (closed) return;
            if (h.get(JAVA_LONG, 0) != 0) {
                int s = call(2, MemorySegment.NULL, MemorySegment.NULL, MemorySegment.NULL);
                if (s != 6) Wire.success(s);
            }
            closed = true;
            try { if (cached != null) discard.accept(cached); }
            finally { cached = null; arena.close(); untrack(this); }
        }
    }
    private final State<T> state;
    private final Cleaner.Cleanable cleanup;
    LeanCursor(int method, int slots, int depth, Consumer<Wire> input, BiConsumer<Wire,Integer> factory,
               BiFunction<Wire,Integer,T> decode, Consumer<T> discard) {
        state = new State<>(method, depth, decode, discard);
        try {
            cleanup = CLEANER.register(this, state);
            state.open(slots, input, factory);
        } catch (RuntimeException | Error e) { state.fail(e); throw e; }
    }
    @Override public Iterator<T> iterator() { return this; }
    @Override public boolean hasNext() {
        try { return state.ready(); } finally { Reference.reachabilityFence(this); }
    }
    @Override public T next() {
        try { return state.take(); } finally { Reference.reachabilityFence(this); }
    }
    @Override public void close() { state.run(); cleanup.clean(); }
    @Override public void forEachRemaining(Consumer<? super T> action) {
        Objects.requireNonNull(action);
        try (var cursor = this) { while (cursor.hasNext()) action.accept(cursor.next()); }
    }
    @Override public void forEach(Consumer<? super T> action) { forEachRemaining(action); }
}
