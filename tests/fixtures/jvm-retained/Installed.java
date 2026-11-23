import java.math.BigInteger;
import java.lang.ref.*;
import java.util.Arrays;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.leanbridge.feedback.*;

public class Installed extends Observe {
    private static final BigInteger ONE = BigInteger.ONE, ZERO = BigInteger.ZERO;
    static Throwable fault(CompletableFuture<?> f) {
        try { f.join(); throw new AssertionError("expected failure"); }
        catch (CompletionException expected) { return expected.getCause(); }
    }
    static void entered() { check(Thread.currentThread().isVirtual()); }
    static void carriers() {
        var count = new AtomicInteger(); var wide = ONE.shiftLeft(4097).add(ONE);
        String text = "λ\0🌿"; byte[] bytes = {0, -128, -1};
        Api.scalarTour(() -> { entered(); count.incrementAndGet(); return true; },
            b -> { check(b); count.incrementAndGet(); return 0x1f33f; },
            c -> { check(c == 0x1f33f); count.incrementAndGet(); return text; },
            s -> { check(s.equals(text)); count.incrementAndGet(); return bytes; },
            v -> { check(v != bytes && Arrays.equals(v, bytes)); count.incrementAndGet(); return wide; },
            n -> { check(n.equals(wide)); count.incrementAndGet(); return wide.negate(); },
            n -> { check(n.equals(wide.negate())); count.incrementAndGet(); return 255; },
            b -> { check(b == 255); count.incrementAndGet(); return 65535; },
            h -> { check(h == 65535); count.incrementAndGet(); return 0xffffffffL; },
            w -> { check(w == 0xffffffffL); count.incrementAndGet(); return ONE.shiftLeft(64).subtract(ONE); },
            d -> { check(d.bitLength() == 64); count.incrementAndGet(); return d; },
            u -> { check(u.bitLength() == 64); count.incrementAndGet(); return Byte.MIN_VALUE; },
            b -> { check(b == Byte.MIN_VALUE); count.incrementAndGet(); return Short.MIN_VALUE; },
            h -> { check(h == Short.MIN_VALUE); count.incrementAndGet(); return Integer.MIN_VALUE; },
            w -> { check(w == Integer.MIN_VALUE); count.incrementAndGet(); return Long.MIN_VALUE; },
            d -> { check(d == Long.MIN_VALUE); count.incrementAndGet(); return -2L; },
            n -> { check(n == -2L); count.incrementAndGet(); return -0.0f; },
            f -> { check(1 / f == Float.NEGATIVE_INFINITY); count.incrementAndGet(); return Double.POSITIVE_INFINITY; },
            d -> { check(d == Double.POSITIVE_INFINITY); count.incrementAndGet(); }).join();
        check(count.get() == 19);
        check(fault(Api.recover(n -> ONE.negate(), ZERO)) instanceof IllegalArgumentException);
        check(fault(Api.typedStart(v -> null, false, bytes)) instanceof NullPointerException);
        check(fault(Api.repeatCall("", s -> "\ud800")) instanceof IllegalArgumentException);
        check(fault(Api.once(5, null)) instanceof NullPointerException);
        try (var reg = RetainedCallback.action(() -> { entered(); count.incrementAndGet(); })) {
            Api.action(reg.callback()).join(); check(count.get() == 20);
        }
    }
    static final class BadMessage extends RuntimeException {
        @Override public String getMessage() { throw new IllegalStateException("user formatter"); }
    }
    static void errors() throws Exception {
        var original = new IllegalStateException("identical");
        var first = Api.repeatCall("", s -> { throw original; });
        check(fault(first) == original && fault(first) == original);
        try { first.get(); throw new AssertionError(); } catch (ExecutionException e) { check(e.getCause() == original); }
        check(fault(Api.duringStart(s -> { throw original; }, s -> s, "")) == original);
        check(Api.recover(n -> { throw original; }, ZERO).join().equals(new Result.Err<>("caught in Lean")));
        Throwable replacement = fault(Api.replaceError(n -> { throw original; }));
        check(replacement instanceof TaskIOException e && e.declaration().equals("Retained.replaceError") && e.getMessage().contains("identical"));
        check(fault(Api.early(true, n -> n)) instanceof LeanIOException e && e.declaration().equals("Feedback.early"));
        check(fault(Api.typedStart(b -> b, true, new byte[0])) instanceof TypedStartError e && e.payload().equals("factory refused"));
        var bad = new BadMessage(); check(fault(Api.once(4, n -> { throw bad; })) == bad);
        var cancelled = new CancellationException("user code");
        var f = Api.once(1, n -> { throw cancelled; }); check(fault(f) == cancelled && !f.isCancelled());
        var completion = new CompletionException(original);
        check(fault(Api.once(1, n -> { throw completion; })) == completion);
        check(Api.plain(3) == 4);
    }
    static void reentry() {
        String result = Api.duringStart(s -> { entered(); return org.leanbridge.relay.Api.run(s, x -> x + "!").join(); },
            s -> s + "?", "α\0").join();
        check(result.equals("α\0!!?!!"));
        var own = new CompletableFuture<CompletableFuture<Long>>();
        var f = Api.once(20, n -> {
            var outer = own.join();
            try { outer.join(); throw new AssertionError(); } catch (IllegalStateException e) { check(e.getMessage().contains("own active")); }
            return Api.once(n, x -> 2 * Api.plain(x)).join();
        });
        own.complete(f); check(f.join() == 42 && f.join() == 42);
    }
    static void revocation() {
        var self = new AtomicReference<RetainedCallback<java.util.function.Function<Long,Long>>>();
        self.set(RetainedCallback.function((Long n) -> { self.get().close(); return n + 1; }));
        check(Api.once(9, self.get().callback()).join() == 10 && self.get().isClosed());
        self.get().close(); check(fault(Api.once(9, self.get().callback())) instanceof IllegalStateException);
        var entered = new CompletableFuture<Void>(); var release = new CompletableFuture<Void>(); var left = new CompletableFuture<Void>();
        try (var shared = RetainedCallback.function((String s) -> {
            if (s.equals("hold")) { entered.complete(null); release.join(); left.complete(null); }
            return s + "x";
        })) {
            check(Api.repeatCall("a", shared.callback()).join().equals("axx"));
            var held = Api.repeatCall("hold", shared.callback()); entered.join(); check(held.cancel(false));
            check(org.leanbridge.relay.Api.run("b", shared.callback()).join().equals("bxx"));
            release.complete(null); left.join(); check(!shared.isClosed());
            shared.close(); check(fault(org.leanbridge.relay.Api.run("b", shared.callback())) instanceof IllegalStateException);
        }
        check(Api.remember(n -> n + 1).join() == 17);
        check(fault(Api.useExpired()) instanceof TaskIOException e && e.getMessage().contains("expired")); Api.forget();
    }
    record Held(CompletableFuture<Long> task, WeakReference<byte[]> capture) { }
    static Held hold() {
        byte[] payload = new byte[4096]; payload[0] = 1;
        return new Held(Api.queued(n -> n + payload[0]), new WeakReference<>(payload));
    }
    static void cancel() throws Exception {
        Api.reset(); var calls = new AtomicInteger();
        var late = Api.cancelLate(n -> { calls.incrementAndGet(); return n; });
        until(() -> Api.state() == 1); check(late.cancel(false)); Api.release();
        until(() -> Api.state() == 2); check(late.isCancelled() && calls.get() == 0);
        Api.reset(); var queued = Api.queued(n -> { calls.incrementAndGet(); return n; });
        until(() -> Api.state() == 3); check(queued.cancel(false)); Api.release();
        until(() -> Api.state() == 4); check(calls.get() == 0);
        Api.reset(); Held lease = hold(); until(() -> Api.state() == 3);
        System.gc(); check(!lease.capture().refersTo(null)); check(lease.task().cancel(false)); Api.release();
        until(() -> Api.state() == 4);
        for (int i = 0; i < 16 && !lease.capture().refersTo(null); i++) { System.gc(); Thread.sleep(40); }
        check(lease.capture().refersTo(null)); Reference.reachabilityFence(lease.task());
        var active = new CompletableFuture<Void>(); var release = new CompletableFuture<Void>(); var returned = new CompletableFuture<Void>();
        var held = Api.once(8, n -> { entered(); active.complete(null); release.join(); returned.complete(null); return n; });
        active.join(); check(held.cancel(false)); drained();
        // This must work before allowing the suspended user callback to return.
        check(org.leanbridge.relay.Api.run("z", x -> x + "!").join().equals("z!!"));
        release.complete(null); returned.join(); check(held.isCancelled());
    }
    public static void main(String[] args) throws Exception {
        boolean peer = args[0].equals("peer-first");
        if (peer) check(org.leanbridge.relay.Api.run("", x -> x + "!").join().equals("!!"));
        else check(Api.once(1, x -> x + 1).join() == 2);
        org.leanbridge.relay.Api.direct(3).join(); Api.plain(0); drained(); long baseline = descriptors();
        carriers(); reentry(); errors(); revocation(); cancel(); drained(); until(() -> descriptors() == baseline);
        check(Arrays.equals(snapshot(), new int[]{1,2,2,0}));
        var fatal = new LinkageError("injected fatal callback");
        check(fault(Api.once(0, n -> { throw fatal; })) == fatal);
        try { org.leanbridge.relay.Api.direct(8).join(); throw new AssertionError(); } catch (CompletionException e) { check(e.getCause() instanceof IllegalStateException); }
        drained(); until(() -> descriptors() == baseline);
        System.out.println("Java: 19 carrier conversions, nested callback reentry, original exceptions, revocation, cancellation and shared retirement; 2 components, 0 live identities, descriptor delta 0");
    }
}
