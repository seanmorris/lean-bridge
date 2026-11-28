package __PACKAGE__;

import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;

/** One registry per application binding, never per Java class or process. */
final class HostTaskScope implements AutoCloseable {
    private HostMembers binding;
    private int synchronous;
    private final Set<Runnable> active = Collections.newSetFromMap(new IdentityHashMap<>());
    // Values must not refer back to the keys. Abandoning a cold publisher drops
    // its factory and arguments even if the binding remains open indefinitely.
    private final Set<Cold<?>> cold = Collections.newSetFromMap(new WeakHashMap<>());
    private final ThreadLocal<Boolean> serving = new ThreadLocal<>();
    private final CompletableFuture<Void> drained = new CompletableFuture<>();
    HostTaskScope(HostMembers b) { binding = Objects.requireNonNull(b); }
    synchronized HostMembers binding() {
        if (binding == null) throw new IllegalStateException("Closed JVM host binding");
        return binding;
    }
    Object[] invoke(int method, Object[] args) throws Exception {
        HostMembers b;
        synchronized (this) { b = binding(); ++synchronous; }
        try { return NativePort.invoke(b,method,args); }
        finally { synchronized (this) { --synchronous; } }
    }
    void serve(Runnable call) {
        serving.set(true);
        try { call.run(); } finally { serving.remove(); }
    }
    synchronized void track(Runnable stop) { binding(); active.add(stop); }
    synchronized void forget(Runnable stop) { active.remove(stop); }
    private static final class Cold<T> implements Supplier<TaskPort<T>> {
        final HostTaskScope owner;
        Supplier<TaskPort<T>> make;
        Cold(HostTaskScope owner, Supplier<TaskPort<T>> make) { this.owner=owner; this.make=make; }
        public TaskPort<T> get() {
            Supplier<TaskPort<T>> factory;
            synchronized (owner) { owner.binding(); factory=make; }
            return factory.get().bound(owner);
        }
    }
    synchronized <T> Flow.Publisher<T> stream(Supplier<TaskPort<T>> make) {
        binding();
        var cell = new Cold<T>(this,make);
        var publisher = Delivery.stream(cell);
        cold.add(cell);
        return publisher;
    }
    @Override public void close() throws Exception {
        HostMembers b; Runnable[] stops;
        synchronized (this) {
            if (Boolean.TRUE.equals(serving.get()) || synchronous != 0)
                throw new IllegalStateException("Cannot close a JVM binding inside its active call");
            b=binding;
            if (b == null) stops=null;
            else {
                stops=active.toArray(Runnable[]::new);
                binding=null; active.clear();
                for (var cell:cold) cell.make=null;
                cold.clear();
            }
        }
        if (stops==null) { drained.join(); return; }
        // No registry lock is held during native disposal or JVM delivery.
        Throwable first=null;
        for (var stop:stops) try { stop.run(); } catch (Throwable error) { if(first==null) first=error; }
        try { NativePort.invoke(b,-1,null); } catch (Throwable error) { if(first==null) first=error; }
        if(first==null) { drained.complete(null); return; }
        drained.completeExceptionally(first);
        if(first instanceof Error e) throw e;
        if(first instanceof Exception e) throw e;
        throw new IllegalStateException(first);
    }
}
