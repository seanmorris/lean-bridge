import org.leanbridge.depot.Api;
import org.leanbridge.depot.CheckedError;
import org.leanbridge.depot.TicketsStepError;
import java.nio.file.*;
import java.util.concurrent.*;
import java.util.function.BooleanSupplier;

class Installed {
    static void check(boolean ok) { if (!ok) throw new AssertionError(); }
    static long files() {
        try (var fds = Files.list(Path.of("/proc/self/fd"))) {
            return fds.filter(p -> { try { return Files.readSymbolicLink(p).toString().equals("/dev/null"); }
                catch (java.io.IOException e) { return false; } }).count();
        } catch (Exception e) { throw new AssertionError(e); }
    }
    static void waitFor(BooleanSupplier f) { Observe.until(f); }
    static void drain(long base) {
        waitFor(() -> Observe.snapshot()[3] == 0 && files() == base && Observe.reactors() == 0);
    }
    static final class Probe<T> implements Flow.Subscriber<T> {
        Flow.Subscription sub; final CompletableFuture<T> item = new CompletableFuture<>();
        final CompletableFuture<Throwable> terminal = new CompletableFuture<>();
        public void onSubscribe(Flow.Subscription s) { sub = s; }
        public void onNext(T t) { if (!item.complete(t)) throw new AssertionError("unexpected second item"); }
        public void onError(Throwable t) { terminal.complete(t); }
        public void onComplete() { terminal.complete(null); }
    }
    static <T> Probe<T> probe(Flow.Publisher<T> source) { var p = new Probe<T>(); source.subscribe(p); return p; }
    public static void main(String[] args) throws Exception {
        (args[0].equals("depot-first") ? Api.make(0, "warm") : org.leanbridge.desk.Api.issue(0)).close();
        long base = files();
        var original = org.leanbridge.desk.Api.issue(10);
        Api.reset();
        var worker = Api.pending(original, false); var peer = original.retain(); original.close();
        try (peer) {
            waitFor(() -> Api.state() == 1); Api.release();
            try (var value = worker.get(20, TimeUnit.SECONDS)) { check(value.sameResource(peer) && Api.count(value) == 11); }
            try (var value = Api.checked(false, peer).join()) { check(value.sameResource(peer)); }
            try { Api.checked(true, peer).get(); throw new AssertionError(); }
            catch (ExecutionException e) { try (var error = ((CheckedError)e.getCause()).payload()) { check(error.sameResource(peer)); } }
            try (var value = Api.revisit(peer, n -> org.leanbridge.desk.Api.count(peer) + 1).get(20, TimeUnit.SECONDS)) {
                check(value.sameResource(peer) && Api.count(peer) == 12);
            }
            var mine = new RuntimeException("host");
            try { Api.revisit(peer, n -> { throw mine; }).get(); throw new AssertionError(); }
            catch (ExecutionException e) { check(e.getCause() == mine); }
            var entered = new CountDownLatch(1); var leave = new CountDownLatch(1); var returned = new CountDownLatch(1);
            var cb = Api.revisit(peer, n -> {
                entered.countDown();
                try { check(leave.await(20, TimeUnit.SECONDS)); } catch (InterruptedException e) { throw new AssertionError(e); }
                finally { returned.countDown(); } return n;
            });
            try { check(entered.await(20, TimeUnit.SECONDS) && cb.cancel(false)); }
            finally { leave.countDown(); }
            check(returned.await(20, TimeUnit.SECONDS) && cb.isCancelled());
            for (boolean cooperate : new boolean[]{false,true}) {
                Api.reset(); var late = Api.pending(peer, cooperate); waitFor(() -> Api.state() == 1);
                check(late.cancel(false)); if (!cooperate) Api.release();
                waitFor(() -> Api.state() == (cooperate ? 2 : 3)); check(late.isCancelled());
            }
            for (int mode = 0; mode < 3; ++mode) {
                long before = Api.closes(); var p = probe(Api.tickets(peer, mode == 2)); check(Api.closes() == before);
                p.sub.request(1);
                try (var item = p.item.get(20, TimeUnit.SECONDS)) {
                    check(item.sameResource(peer));
                    if (mode == 0) { p.sub.cancel(); p.sub.cancel(); check(Api.count(item) == Api.count(peer)); }
                    else {
                        p.sub.request(1); var error = p.terminal.get(20, TimeUnit.SECONDS);
                        if (mode == 1) check(error == null);
                        else try (var lease = ((TicketsStepError)error).payload()) { check(lease.sameResource(peer)); }
                    }
                }
                waitFor(() -> Api.closes() == before + 1);
            }
            var temp = peer.retain(); var cold = Api.tickets(temp, false); temp.close();
            var refused = probe(cold); refused.sub.request(1);
            check(refused.terminal.get(20, TimeUnit.SECONDS) instanceof IllegalStateException);
        }
        drain(base);
        org.leanbridge.depot.Races.run(Integer.parseInt(args[1]), Integer.parseInt(args[2]), () -> Observe.snapshot()[3]);
        drain(base);
        try (var t = Api.make(4, "retire-probe")) {
            var p = probe(Api.tickets(t, false)); p.sub.request(1);
            try (var item = p.item.get(20, TimeUnit.SECONDS)) {
                check(t.sameResource(item)); Observe.retire(); p.sub.cancel();
            }
        }
        drain(base); check(!Files.exists(Path.of("retired-close-ran.txt")));
        System.out.println("Java: shared resource tasks, callback reentry and original failure, cancellation, cold stream, early exit, typed step error, retirement; zero leaked leases or files");
    }
}
