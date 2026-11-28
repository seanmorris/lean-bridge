import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.leanbridge.feedback.Api;

/** A language-boundary error should not execute arbitrary user formatting again
 * just because the caller selected get() instead of join(). */
class Formatter {
    static final class Broken extends RuntimeException {
        final AtomicInteger calls = new AtomicInteger();
        @Override public String getMessage() { calls.incrementAndGet(); throw new IllegalStateException("formatter ran"); }
    }
    public static void main(String[] args) throws Exception {
        var e = new Broken(); var pending = Api.once(7, n -> { throw e; });
        try { pending.join(); throw new AssertionError(); } catch (CompletionException x) { if (x.getCause() != e) throw new AssertionError(); }
        try { pending.get(); throw new AssertionError(); } catch (ExecutionException x) { if (x.getCause() != e) throw new AssertionError(); }
        try { pending.get(1, TimeUnit.SECONDS); throw new AssertionError(); } catch (ExecutionException x) { if (x.getCause() != e) throw new AssertionError(); }
        if (e.calls.get() != 1) throw new AssertionError("unexpected formatting count " + e.calls.get());
        var entered = new CompletableFuture<Void>(); var release = new CompletableFuture<Void>();
        var value = Api.once(4, n -> { entered.complete(null); release.join(); return n; });
        entered.join(); int before = value.getNumberOfDependents();
        for (int i = 0; i < 50; i++) try { value.get(0, TimeUnit.NANOSECONDS); throw new AssertionError(); }
        catch (TimeoutException expected) { }
        if (value.getNumberOfDependents() != before + 1) throw new AssertionError("timed reads accumulated");
        var interrupted = new CompletableFuture<Boolean>();
        var thread = Thread.ofVirtual().start(() -> {
            try { value.get(); interrupted.complete(false); }
            catch (InterruptedException ok) { interrupted.complete(true); }
            catch (ExecutionException unexpected) { interrupted.completeExceptionally(unexpected); }
        });
        thread.interrupt(); if (!interrupted.get(10, TimeUnit.SECONDS)) throw new AssertionError();
        release.complete(null); if (value.get(10, TimeUnit.SECONDS) != 4) throw new AssertionError();
        value.obtrudeValue(7L); if (value.get() != 7) throw new AssertionError("stale outcome");
        System.out.println("join, get and timed get preserve the same exception without formatting it again");
    }
}
