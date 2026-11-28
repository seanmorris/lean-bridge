package __PACKAGE__;

import java.util.Objects;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;

/** Only bridge workers join readiness futures. User continuations never run on the native owner or the epoll thread. */
final class Delivery {
    static Throwable cause(Throwable e) { return e instanceof CompletionException && e.getCause() != null ? e.getCause() : e; }
    private static final class Owned<T> extends CompletableFuture<T> {
        private final TaskPort<T> port;
        private final AtomicBoolean settled = new AtomicBoolean();
        Owned(TaskPort<T> port) { this.port = port; whenComplete((v,e) -> port.close()); }
        @Override public boolean cancel(boolean interrupt) {
            if (!settled.compareAndSet(false, true)) return isCancelled();
            try { port.close(); } catch (Throwable e) { return super.completeExceptionally(e); }
            return super.cancel(interrupt);
        }
        @Override public boolean complete(T value) {
            if (!settled.compareAndSet(false, true)) return false;
            try { port.close(); } catch (Throwable e) { return super.completeExceptionally(e); }
            return super.complete(value);
        }
// @leases
        // Only this path owns a newly decoded native result. Public complete(T)
        // must never dispose a value supplied by the application's own code.
        private void nativeValue(T value) {
            try {
                if (!settled.compareAndSet(false, true)) return;
                try { port.close(); } catch (Throwable e) { super.completeExceptionally(e); return; }
                if (super.complete(value)) value = null;
            } finally { Resources.discardValue(value); }
        }
        private void nativeError(Throwable raw) {
            // A replayed callback error is inside a completion envelope; never
            // dispose an exception (or its payload) that the callback already owned.
            if (!completeExceptionally(cause(raw))) Resources.discardError(raw);
        }
// @end
        @Override public boolean completeExceptionally(Throwable e) {
            Objects.requireNonNull(e);
            if (!settled.compareAndSet(false, true)) return false;
            try { port.close(); } catch (Throwable close) { e.addSuppressed(close); }
            return super.completeExceptionally(e);
        }
    }
    static <T> CompletableFuture<T> task(TaskPort<T> port) {
        var future = new Owned<T>(port);
        try {
            port.start();
            Thread.startVirtualThread(() -> {
// @leases
                try { future.nativeValue(port.await()); } catch (Throwable e) { future.nativeError(e); }
            });
        } catch (Throwable e) { future.nativeError(e); }
// @otherwise
                try { future.complete(port.await()); } catch (Throwable e) { future.completeExceptionally(cause(e)); }
            });
        } catch (Throwable e) { future.completeExceptionally(cause(e)); }
// @end
        return future;
    }
    static <T> Flow.Publisher<T> stream(Supplier<TaskPort<T>> make) {
        return subscriber -> {
            Objects.requireNonNull(subscriber);
            var s = new Pull<T>(make.get(), subscriber);
            try { subscriber.onSubscribe(s); } catch (Throwable e) { s.cancel(); return; }
            s.subscribed();
        };
    }
    private static final class Pull<T> implements Flow.Subscription, Runnable {
        final TaskPort<T> port; final Flow.Subscriber<? super T> sink;
        private long demand; private boolean subscribed, started, done;
        private Throwable invalid; private CompletableFuture<Void> wake;
        Pull(TaskPort<T> port, Flow.Subscriber<? super T> sink) { this.port = port; this.sink = sink; }
        synchronized void subscribed() { subscribed = true; signal(); }
        private void signal() {
            if (wake != null) { wake.complete(null); wake = null; }
            if (!done && subscribed && !started && (invalid != null || demand > 0)) {
                started = true; Thread.startVirtualThread(this);
            }
        }
        @Override public synchronized void request(long n) {
            if (done || invalid != null) return;
            if (n <= 0) { invalid = new IllegalArgumentException("Flow demand must be positive"); port.close(); }
            else demand = n >= Long.MAX_VALUE - demand ? Long.MAX_VALUE : demand + n;
            signal();
        }
        @Override public synchronized void cancel() {
            if (done) return;
            done = true; try { port.close(); } finally { signal(); }
        }
        private synchronized boolean finish() { if (done) return false; done = true; return true; }
        public void run() {
            boolean opened = false; Throwable failure = null;
            try {
                for (;;) {
                    CompletableFuture<Void> hold = null;
                    synchronized (this) {
                        if (done) return;
                        if (invalid != null) throw invalid;
                        if (demand == 0) hold = wake = new CompletableFuture<>();
                        else if (demand != Long.MAX_VALUE) --demand;
                    }
                    if (hold != null) { port.idle(hold); continue; }
                    if (!opened) { port.start(); opened = true; }
                    port.pull(); T value = port.await();
// @leases
                    synchronized (this) {
                        if (done || invalid != null) {
                            Resources.discardValue(value);
                            if (done) return;
                            throw invalid;
                        }
                    }
// @otherwise
                    synchronized (this) { if (done) return; if (invalid != null) throw invalid; }
// @end
                    if (value == null) break; // Native END, never a user item.
                    try { sink.onNext(value); } catch (Throwable subscriberFailure) { cancel(); return; }
                }
            } catch (Throwable e) { failure = cause(e); }
            finally { try { port.close(); } catch (Throwable e) { if (failure == null) failure = e; else failure.addSuppressed(e); } }
// @leases
            synchronized (this) {
                if (!finish()) { Resources.discardError(failure); return; }
                if (invalid != null && invalid != failure) { Resources.discardError(failure); failure = invalid; }
            }
// @otherwise
            synchronized (this) { if (!finish()) return; if (invalid != null) failure = invalid; }
// @end
            if (failure == null) sink.onComplete(); else sink.onError(failure);
        }
    }
}
