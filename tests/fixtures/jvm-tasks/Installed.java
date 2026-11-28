import java.math.BigInteger;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.leanbridge.timers.*;

class Installed extends Observe {
    static final BigInteger Z = BigInteger.ZERO, ONE = BigInteger.ONE, BAD = BigInteger.valueOf(99);
    static final Object END = new Object();
    static final class Sink<T> implements Flow.Subscriber<T> {
        final BlockingQueue<Object> signals = new LinkedBlockingQueue<>();
        Flow.Subscription sub;
        public void onSubscribe(Flow.Subscription s) { check(sub == null); sub = s; }
        public void onNext(T value) { signals.add(Objects.requireNonNull(value)); }
        public void onComplete() { signals.add(END); }
        public void onError(Throwable t) { signals.add(t); }
        Object next() throws Exception { Object x = signals.poll(20, TimeUnit.SECONDS); if (x == null) throw new AssertionError("missing signal"); return x; }
        void silent() throws Exception { check(signals.poll(50, TimeUnit.MILLISECONDS) == null); }
    }
    static <T> Sink<T> collect(Flow.Publisher<T> source) { var s = new Sink<T>(); source.subscribe(s); return s; }
    static Throwable failed(CompletableFuture<?> f) throws Exception {
        try { f.get(20, TimeUnit.SECONDS); throw new AssertionError("expected exceptional completion"); }
        catch (ExecutionException e) { return e.getCause(); }
    }
    static Flow.Publisher<Result<BigInteger,String>> series(int n, int fail, boolean paused, boolean refuse) {
        return Api.series(Z, BigInteger.valueOf(n), BigInteger.valueOf(fail), paused, true, refuse, "series");
    }
    static void races() throws Exception {
        for (int i=0; i<8; ++i) {
            Api.reset(); var pending = Api.openTask(true, "race"); until(() -> Api.state() == 1);
            var settled = new AtomicInteger();
            var observed = pending.handle((v, e) -> {
                settled.incrementAndGet();
                if (e != null) check(e instanceof CancellationException);
                else check(v.equals(new Result.Ok<>("race")));
                return e != null;
            });
            var go = new CountDownLatch(1);
            var cancel = Thread.ofVirtual().start(() -> { try { go.await(); } catch (InterruptedException e) { throw new AssertionError(e); } pending.cancel(false); });
            go.countDown(); Api.release(); cancel.join();
            check(observed.get(20, TimeUnit.SECONDS) == pending.isCancelled() && settled.get() == 1);
            until(() -> Api.state() == 2 || Api.state() == 3);
        }
    }
    static void streams() throws Exception {
        int open = Api.opens().intValueExact(), pulls = Api.pulls().intValueExact(), close = Api.closes().intValueExact();
        var cold = series(2, 99, false, false); var first = collect(cold); var second = collect(cold);
        first.silent(); check(Api.opens().intValueExact() == open && Api.pulls().intValueExact() == pulls);
        first.sub.request(1); check(first.next().equals(new Result.Ok<>(Z))); first.silent();
        check(Api.opens().intValueExact() == open + 1 && Api.pulls().intValueExact() == pulls + 1);
        first.sub.request(Long.MAX_VALUE); check(first.next().equals(new Result.Err<>("series")) && first.next() == END);
        second.sub.request(1); check(second.next().equals(new Result.Ok<>(Z))); second.sub.cancel(); second.sub.cancel(); second.silent();
        check(Api.closes().intValueExact() == close + 2 && Api.pulls().intValueExact() == pulls + 4);
        var bad = collect(series(2, 0, false, false)); bad.sub.request(1);
        check(bad.next() instanceof SeriesStepError e && e.payload().equals("series") && e.declaration().equals("Timers.nextSeries"));
        var refused = collect(series(2, 99, false, true)); refused.sub.request(1); check(refused.next() instanceof SeriesError e && e.payload().equals("series"));
        var units = collect(Api.units(ONE)); units.sub.request(2); check(units.next() == Unit.INSTANCE && units.next() == END);
        Api.reset(); var blocked = collect(series(3, 99, true, false)); blocked.sub.request(1);
        until(() -> Api.state() == 1); blocked.sub.request(-1); check(blocked.next() instanceof IllegalArgumentException); until(() -> Api.state() == 2); blocked.silent();
        Api.reset(); var early = collect(series(3, 99, true, false)); early.sub.request(1); until(() -> Api.state() == 1);
        early.sub.cancel(); until(() -> Api.state() == 2); early.silent();
    }
    public static void main(String[] args) throws Exception {
        var untouched = collect(series(2, 99, false, false)); untouched.sub.request(0);
        check(untouched.next() instanceof IllegalArgumentException && System.getProperty("lean.bridge.jvm.native-library-v1.runtime") == null);
        if (args[0].equals("peer-first")) org.leanbridge.alarm.Api.reset();
        var big = ONE.shiftLeft(500).add(ONE);
        CompletableFuture<BigInteger> fast = Api.immediate(big); check(fast.join().equals(big.add(ONE)));
        check(Api.compute("λ").join().equals("λ!") && Api.later(big).join().equals(big.multiply(BigInteger.valueOf(3))));
        check(Api.owner().split(" ")[0].equals(org.leanbridge.alarm.Api.owner().split(" ")[0]));
        check(Api.startChecked(false, true, "é").join().equals(new Result.Err<>("é")));
        check(failed(Api.startChecked(true, false, "factory")) instanceof StartCheckedError e && e.payload().equals("factory"));
        check(failed(Api.startIo(true)) instanceof LeanIOException e && e.declaration().equals("Timers.startIO"));
        check(failed(Api.finalIo(true)) instanceof TaskIOException e && e.declaration().equals("Timers.finalIO"));
        check(Api.finalIo(false).join().equals("done") && failed(Api.immediate(ONE.negate())) instanceof IllegalArgumentException);
        byte[] input = {0, -1}; byte[] copy = Api.octets(input).join(); check(input != copy && Arrays.equals(input, copy));
        Api.reset(); var coop = Api.openTask(true, "ignored"); until(() -> Api.state() == 1);
        check(coop.cancel(false) && coop.isCancelled()); until(() -> Api.state() == 2);
        Api.reset(); var late = Api.openTask(false, "late"); until(() -> Api.state() == 1);
        check(late.cancel(true)); Api.release(); until(() -> Api.state() == 3); check(late.isCancelled());
        Api.reset(); var own = Api.openTask(true, "ok"); var count = new AtomicInteger();
        var nested = own.thenApply(v -> { count.incrementAndGet(); return Api.later(ONE).join(); });
        until(() -> Api.state() == 1); Api.release(); check(nested.get(20, TimeUnit.SECONDS).intValueExact() == 3 && count.get() == 1);
        races(); streams(); drained(); long base = descriptors();
        org.leanbridge.alarm.Api.reset(); var many = new ArrayList<CompletableFuture<Long>>();
        for (int j=0;j<32;++j) many.add(org.leanbridge.alarm.Api.wait_(j));
        until(() -> reactors() == 1); long waitThreads = reactors(); org.leanbridge.alarm.Api.release();
        for (int j=0;j<many.size();++j) check(many.get(j).join() == j);
        drained(); until(() -> descriptors() == base); check(Arrays.equals(snapshot(), new int[]{1,2,2,0}));
        Api.reset(); org.leanbridge.alarm.Api.reset();
        // Establish an idle cursor before occupying the only Lean worker with
        // gated tasks. Its first pull is real work, not a retirement signal.
        var idle = collect(series(3, 99, false, false)); idle.sub.request(1); check(idle.next() instanceof Result.Ok);
        var pending = Api.openTask(true,"never"); var other = org.leanbridge.alarm.Api.wait_(91);
        until(() -> Api.state() == 1 && reactors() == 2); retire();
        check(failed(pending) instanceof IllegalStateException && failed(other) instanceof IllegalStateException);
        check(idle.next() instanceof IllegalStateException); drained(); until(() -> descriptors() == base);
        int[] finalState = snapshot();
        System.out.println("Java: futures, cancellation, cold Flow demand, typed failures, two packages, retirement, zero native identities and descriptors at baseline");
        System.out.printf("{\"runtimeInits\":%d,\"componentInits\":%d,\"attached\":%d,\"live\":%d,\"fdDelta\":%d,\"concurrentTasks\":%d,\"readinessThreads\":%d}%n",
            finalState[0], finalState[1], finalState[2], finalState[3], descriptors()-base, many.size(), waitThreads);
    }
}
