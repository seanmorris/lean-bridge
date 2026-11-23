import java.math.BigInteger;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Flow;
import org.leanbridge.timers.Api;
import org.leanbridge.timers.Unit;

class Example {
    public static void main(String[] args) {
        System.out.println(Api.immediate(BigInteger.valueOf(41)).join());
        var count = new CompletableFuture<Integer>();
        Api.units(BigInteger.TWO).subscribe(new Flow.Subscriber<Unit>() {
            Flow.Subscription subscription;
            int items;
            public void onSubscribe(Flow.Subscription s) { subscription = s; s.request(1); }
            public void onNext(Unit item) { items++; subscription.request(1); }
            public void onError(Throwable error) { count.completeExceptionally(error); }
            public void onComplete() { count.complete(items); }
        });
        System.out.println(count.join());
    }
}
