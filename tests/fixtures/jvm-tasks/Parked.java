import java.math.BigInteger;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.leanbridge.timers.Api;
import org.leanbridge.timers.Result;

/** An ordinary Flow subscriber: cancellation is silent; invalid demand signals an error. */
class Parked extends Observe implements Flow.Subscriber<Result<BigInteger,String>> {
    private final AtomicInteger signals = new AtomicInteger();
    private final CompletableFuture<Throwable> error = new CompletableFuture<>();
    private Flow.Subscription sub;
    public void onSubscribe(Flow.Subscription s) { check(sub == null); sub=s; }
    public void onNext(Result<BigInteger,String> item) { signals.incrementAndGet(); }
    public void onError(Throwable failure) { signals.incrementAndGet(); error.complete(failure); }
    public void onComplete() { signals.incrementAndGet(); }

    static void exercise(boolean invalidDemand) throws Exception {
        Api.reset();
        var one=BigInteger.ONE; var before=Api.closes(); var pulls=Api.pulls();
        var reader=new Parked();
        Api.series(BigInteger.ZERO,one,BigInteger.TEN,true,false,false,"late").subscribe(reader);
        reader.sub.request(1); until(() -> Api.state()==1);
        check(Api.pulls().equals(pulls.add(one)) && Api.closes().equals(before) && reader.signals.get()==0);
        if(invalidDemand) {
            Thread.ofVirtual().start(() -> reader.sub.request(0)).join();
            check(reader.error.get(20,TimeUnit.SECONDS) instanceof IllegalArgumentException);
        } else {
            Thread.ofVirtual().start(reader.sub::cancel).join();
        }
        // The worker ignores cancellation and is still waiting on its gate.
        check(Api.state()==1 && Api.closes().equals(before.add(one)));
        int expected=invalidDemand ? 1 : 0;
        check(reader.signals.get()==expected);
        check(!org.leanbridge.alarm.Api.owner().isEmpty());
        reader.sub.request(2); reader.sub.cancel(); reader.sub.cancel();
        Api.release(); until(() -> Api.state()==3); drained();
        check(reader.signals.get()==expected && Api.closes().equals(before.add(one)) && Api.pulls().equals(pulls.add(one)));
    }
    public static void main(String[] args) throws Exception {
        if(args[0].equals("peer-first")) org.leanbridge.alarm.Api.reset();
        Api.reset(); org.leanbridge.alarm.Api.reset();
        check(Api.later(BigInteger.ONE).join().intValueExact()==3); drained(); long fds=descriptors();
        exercise(false); exercise(true);
        until(() -> descriptors()==fds); check(snapshot()[3]==0);
        System.out.println("Java " + args[0] + ": blocked cancel silent, invalid demand signals once, close before late worker, zero live owners and descriptor delta");
    }
}
