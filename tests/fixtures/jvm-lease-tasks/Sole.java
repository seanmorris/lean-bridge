import java.nio.file.*;
import java.util.concurrent.*;
import org.leanbridge.depot.Api;

class Sole {
    static void check(boolean v) { if (!v) throw new AssertionError(); }
    static long files() {
        try (var fds = Files.list(Path.of("/proc/self/fd"))) {
            return fds.filter(p -> { try { return Files.readSymbolicLink(p).toString().equals("/dev/null"); }
                catch (java.io.IOException e) { return false; } }).count();
        } catch (Exception e) { throw new AssertionError(e); }
    }
    static void owners(String where, int expected, long open) {
        int identities = Observe.snapshot()[3]; long actual = files();
        if (identities != expected || actual != open)
            throw new AssertionError(where + ": broker identities " + identities + " (expected " + expected + "), file descriptors " + actual + " (expected " + open + ")");
    }
    static void drained(long base) { Observe.until(() -> Observe.snapshot()[3] == 0 && files() == base && Observe.reactors() == 0); }
    private static final class Cursor<T extends AutoCloseable> implements Flow.Subscriber<T> {
        Flow.Subscription sub; final CompletableFuture<Void> consumed = new CompletableFuture<>(), end = new CompletableFuture<>();
        public void onSubscribe(Flow.Subscription s) { sub = s; }
        public void onNext(T value) { try { value.close(); consumed.complete(null); } catch (Exception e) { consumed.completeExceptionally(e); } }
        public void onError(Throwable e) { end.completeExceptionally(e); }
        public void onComplete() { end.complete(null); }
    }
    private static <T extends AutoCloseable> Cursor<T> open(Flow.Publisher<T> stream) { var c = new Cursor<T>(); stream.subscribe(c); return c; }
    public static void main(String[] args) throws Exception {
        org.leanbridge.desk.Api.issue(0).close(); long base = files();
        for (boolean cancel : new boolean[]{false,true}) {
            Api.reset(); var input = org.leanbridge.desk.Api.issue(17); var work = Api.pending(input, false); input.close();
            Observe.until(() -> Api.state() == 1);
            // No host resource lease remains. A pending task registers both the
            // delivery handle and a notification kept alive by the Lean worker.
            check(input.isClosed()); owners("running worker", 2, base + 1);
            if (cancel) { check(work.cancel(false) && work.isCancelled()); owners("cancelled future, still-running worker", 1, base + 1); }
            Api.release();
            if (!cancel) try (var result = work.get(20, TimeUnit.SECONDS)) { check(Api.count(result) == 18); }
            Observe.until(() -> Api.state() == 3); drained(base);
        }
        long closes = Api.closes(); var input = org.leanbridge.desk.Api.issue(24);
        var source = Api.tickets(input, false); var active = open(source); active.sub.request(1);
        active.consumed.get(20, TimeUnit.SECONDS); input.close();
        owners("open cursor", 1, base + 1);
        // The first cursor is still valid; the second subscription has not borrowed the input.
        var cold = open(source); cold.sub.request(1);
        try { cold.end.get(20, TimeUnit.SECONDS); throw new AssertionError(); }
        catch (ExecutionException e) { check(e.getCause() instanceof IllegalStateException && e.getCause().getMessage().contains("closed")); }
        active.sub.request(1); active.end.get(20, TimeUnit.SECONDS);
        drained(base); check(Api.closes() == closes + 1);
        System.out.println("Java: last host lease closed; worker, late cancelled worker and opened cursor retained the file until native cleanup; baseline restored");
    }
}
