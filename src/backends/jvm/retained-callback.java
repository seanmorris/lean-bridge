package __PACKAGE__;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.*;

/** Optional revocable callback. Already-entered calls may finish; later calls
 * fail. The standard JDK callable also works in independently generated APIs. */
public final class RetainedCallback<F> implements AutoCloseable {
    private final AtomicReference<F> current;
    private final F callback;
    private RetainedCallback(F handler, Function<Supplier<F>,F> wrap) {
        current = new AtomicReference<>(Objects.requireNonNull(handler));
        callback = wrap.apply(() -> {
            F fn = current.get();
            if (fn == null) throw new IllegalStateException("Retained Lean callback is closed");
            return fn;
        });
    }
    public F callback() { return callback; }
    public boolean isClosed() { return current.get() == null; }
    @Override public void close() { current.set(null); }
    public static <A,R> RetainedCallback<Function<A,R>> function(Function<A,R> fn) {
        return new RetainedCallback<>(fn, get -> a -> get.get().apply(a));
    }
    public static <A> RetainedCallback<Consumer<A>> consumer(Consumer<A> fn) {
        return new RetainedCallback<>(fn, get -> a -> get.get().accept(a));
    }
    public static <R> RetainedCallback<Supplier<R>> supplier(Supplier<R> fn) {
        return new RetainedCallback<>(fn, get -> () -> get.get().get());
    }
    public static RetainedCallback<Runnable> action(Runnable fn) {
        return new RetainedCallback<>(fn, get -> () -> get.get().run());
    }
}
