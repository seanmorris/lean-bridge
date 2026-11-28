package org.leanbridge.depot;

import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.*;
import __TICKET__;

/** Test-only package peer. Pause after the installed port actually takes and decodes
 * a native result, outside its lock, without adding a test switch to the generated API. */
public final class Races {
    static void check(boolean ok) { if (!ok) throw new AssertionError(); }
    static void waitFor(BooleanSupplier f) throws Exception {
        long limit = System.nanoTime() + TimeUnit.SECONDS.toNanos(20);
        while (!f.getAsBoolean()) { check(System.nanoTime() < limit); Thread.sleep(4); }
    }
    static final class Gate {
        final CountDownLatch reached = new CountDownLatch(1), resume = new CountDownLatch(1);
        final AtomicInteger left;
        Gate(int at) { left = new AtomicInteger(at); }
        void afterTake() {
            if (left.decrementAndGet() == 0) {
                reached.countDown();
                try { check(resume.await(20, TimeUnit.SECONDS)); } catch (InterruptedException e) { throw new AssertionError(e); }
            }
        }
    }
    static TaskPort<Ticket> port(Ticket input, int method, boolean stream, Gate g) {
        return new TaskPort<Ticket>(method, 2, 1,
            f -> { Resources.K1.borrow(f, 0, input); f.word(1, stream ? 1 : 0); },
            (f,s) -> Wire.success(s),
            (f,s) -> {
                if (stream && s == 2) return null;
                if (stream && s == 3) throw new TicketsStepError(Resources.K1.take(f));
                Wire.success(s); return Resources.K1.take(f);
            }) {
            @Override Ticket await() { try { return super.await(); } finally { g.afterTake(); } }
        };
    }
    static final class Sink implements Flow.Subscriber<Ticket> {
        Flow.Subscription sub; final CompletableFuture<Object> signal = new CompletableFuture<>();
        int items;
        public void onSubscribe(Flow.Subscription s) { sub=s; }
        public void onNext(Ticket t) { ++items; t.close(); sub.request(1); }
        public void onError(Throwable t) { signal.complete(t); }
        public void onComplete() { signal.complete("end"); }
    }
    public static void run(int pending, int cursor, IntSupplier identities) throws Exception {
        try (var input = org.leanbridge.desk.Api.issue(7)) {
            for (boolean external : new boolean[]{true,false}) {
                Api.reset(); Gate g = new Gate(1);
                var f = Delivery.task(port(input, pending, false, g)); Api.release();
                try (var mine = input.retain()) {
                    try {
                        check(g.reached.await(20, TimeUnit.SECONDS));
                        // Only input, mine and the native just-decoded result: the task handle is gone.
                        check(identities.getAsInt() == 3);
                        if (external) { check(f.complete(mine)); check(f.join() == mine); }
                        else { check(f.cancel(false)); check(!f.complete(mine)); }
                    } finally { g.resume.countDown(); }
                    waitFor(() -> identities.getAsInt() == 2); check(!mine.isClosed());
                }
            }
            for (int step : new int[]{1,2}) for (boolean invalid : new boolean[]{false,true}) {
                Gate g = new Gate(step); Sink sink = new Sink(); long closes = Api.closes();
                Delivery.stream(() -> port(input, cursor, true, g)).subscribe(sink);
                sink.sub.request(1);
                try {
                    check(g.reached.await(20, TimeUnit.SECONDS));
                    if (invalid) sink.sub.request(0); else sink.sub.cancel();
                } finally { g.resume.countDown(); }
                if (invalid) check(sink.signal.get(20, TimeUnit.SECONDS) instanceof IllegalArgumentException);
                waitFor(() -> identities.getAsInt() == 1 && Api.closes() == closes + 1);
                check(sink.items == step-1 && (invalid || !sink.signal.isDone()));
            }
        }
    }
}
