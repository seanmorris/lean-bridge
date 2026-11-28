package probe;

import java.lang.ref.*;
import java.util.concurrent.*;
import static probe.WorkerProbe.*;
import static probe.BoundDeliveryProbe.*;

final class ScopeProbe {
    static HostTaskScope open() {
        var b=HostContract.bind(WorkerProbe.Unit.class,Box.class);
        WorkerProbe.bind(b,-2);
        return new HostTaskScope(b);
    }
    static void refuseClose(HostTaskScope s) {
        try { s.close(); throw new AssertionError("closed active binding"); }
        catch(IllegalStateException expected){check(expected.getMessage().contains("active call"));}
        catch(Exception e){throw new AssertionError(e);}
    }
    static Flow.Publisher<Box> boxes(HostTaskScope s,Box box) {
        return s.stream(()->new TaskPort<Box>(Methods.BOXES,2,1,f->{f.host.input(0,Box.class,box);f.word(1,0);},
            (f,status)->Wire.success(status),(f,status)->{if(status==2)return null;Wire.success(status);return f.host.output(Box.class);}));
    }
    static final class Sink implements Flow.Subscriber<Box> {
        final CompletableFuture<Box> item=new CompletableFuture<>();
        final CompletableFuture<Throwable> terminal=new CompletableFuture<>();
        volatile Flow.Subscription subscription;
        public void onSubscribe(Flow.Subscription s){check(subscription==null);subscription=s;}
        public void onNext(Box b){check(subscription!=null && item.complete(b));}
        public void onError(Throwable e){check(subscription!=null && terminal.complete(e));}
        public void onComplete(){check(subscription!=null && terminal.complete(null));}
    }
    record Captured(WeakReference<Box> ref, Flow.Publisher<Box> publisher) {}
    static Captured cold(HostTaskScope s) {
        var box=new Box(73); return new Captured(new WeakReference<>(box),boxes(s,box));
    }
    static void collect(WeakReference<Box> weak) throws Exception {
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(8);
        while(!weak.refersTo(null) && System.nanoTime()<deadline) { System.gc(); Thread.sleep(10); }
        check(weak.refersTo(null));
    }
    static WeakReference<Box> abandoned(HostTaskScope s){return cold(s).ref();}
    static void run() throws Exception {
        var a=open(); var b=open(); var x=new Box(82);
        var release=new CompletableFuture<Box>(); var observerRelease=new CompletableFuture<Void>();
        try {
            collect(abandoned(a));
            x.onRead=()->refuseClose(a);
            check((Long)a.invoke(Methods.SYNCREAD,new Object[]{x})[1]==82); x.onRead=null;
            check(relay(a,x,v->{refuseClose(a);return v;}).get(8,TimeUnit.SECONDS)==x);
            var captured=cold(a); var items=boxes(a,x); var idle=new Sink(); var started=new Sink();
            items.subscribe(idle); items.subscribe(started); started.subscription.request(1);
            check(started.item.get(8,TimeUnit.SECONDS)==x && !idle.item.isDone());
            var entered=new CountDownLatch(2); var callbacksDone=new CountDownLatch(2);
            var pending=relay(a,x,v->{entered.countDown();try{return release.join();}finally{callbacksDone.countDown();}});
            var sibling=relay(b,x,v->{entered.countDown();try{return release.join();}finally{callbacksDone.countDown();}});
            check(entered.await(8,TimeUnit.SECONDS));
            var observerEntered=new CountDownLatch(1);
            pending.whenComplete((v,e)->{observerEntered.countDown();observerRelease.join();});
            // If close invoked a user continuation inline, this would deadlock.
            var closed=CompletableFuture.runAsync(()->{try{a.close();}catch(Exception e){throw new CompletionException(e);}},Thread::startVirtualThread);
            closed.get(8,TimeUnit.SECONDS);
            check(pending.isCancelled() && !sibling.isDone() && observerEntered.await(8,TimeUnit.SECONDS));
            observerRelease.complete(null);
            check(idle.terminal.get(8,TimeUnit.SECONDS) instanceof CancellationException);
            check(started.terminal.get(8,TimeUnit.SECONDS) instanceof CancellationException);
            collect(captured.ref());
            try(var reopened=open()) {
                var stale=new Sink(); captured.publisher().subscribe(stale);
                check(stale.terminal.get(8,TimeUnit.SECONDS) instanceof IllegalStateException && !stale.item.isDone());
                check(echo(reopened,x).get(8,TimeUnit.SECONDS)==x);
            }
            release.complete(x);
            check(sibling.get(8,TimeUnit.SECONDS)==x && callbacksDone.await(8,TimeUnit.SECONDS) && pending.isCancelled());
            Reference.reachabilityFence(captured);
        } finally { release.complete(x); observerRelease.complete(null); a.close(); b.close(); }
    }
}
