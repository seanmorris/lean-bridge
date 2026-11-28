import java.nio.file.*;
import java.util.concurrent.*;
import org.leanbridge.workshop.Api;

public final class EffectClient {
    public static final class Box {
        private long level;
        public Box(long n) { level=n; }
        public long read() { return level; }
        public long getLevel() { return level; }
        public void setLevel(long n) { level=n; }
        public Box identity() { return this; }
    }
    static void check(boolean ok) { if (!ok) throw new AssertionError(); }
    // Cancelling a Java Flow subscription signals its virtual-thread owner.
    // Wait for the actual OS effect, not an assumed fixed scheduler delay.
    public static void awaitClose(Path file) throws Exception {
        long start=System.nanoTime();
        while (!Files.readString(file).equals("closed")) {
            if (System.nanoTime()-start>TimeUnit.SECONDS.toNanos(8)) throw new AssertionError("missing close");
            Thread.sleep(5);
        }
    }
    public static void main(String[] args) throws Exception {
        try (var bound=Api.bindHosts(Box.class)) {
            check(bound.read(new Box(41))==41 && bound.readBoot().equals("from-app"));
            Path path=Path.of("state"); Files.writeString(path,"open");
            check(bound.observe(path.toString())==37);
            CompletableFuture<Long> future=Api.worker(path.toString());
            check(future.get(8,TimeUnit.SECONDS)==37L);
            class Items implements Flow.Subscriber<Long> {
                Flow.Subscription subscription; final BlockingQueue<Object> replies=new LinkedBlockingQueue<>();
                public void onSubscribe(Flow.Subscription s) { subscription=s; }
                public void onNext(Long item) { replies.add(item); }
                public void onError(Throwable error) { replies.add(error); }
                public void onComplete() { replies.add("unexpected end"); }
                Object one() throws Exception { subscription.request(1); return replies.poll(8,TimeUnit.SECONDS); }
            }
            var items=new Items(); Flow.Publisher<Long> stream=Api.walk(path.toString()); stream.subscribe(items);
            check(Long.valueOf(37).equals(items.one()));
            Files.writeString(path,"changed"); check(Long.valueOf(0).equals(items.one()));
            check(Files.readString(path).equals("changed")); items.subscription.cancel(); awaitClose(path);
            Files.writeString(path,"after-close"); items.subscription.cancel(); items.subscription.request(1);
            check(items.replies.isEmpty() && Files.readString(path).equals("after-close"));
        }
        System.out.println("Java future, separate demand and cancelling a real finalizer passed");
    }
}
