package probe;

import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.function.Function;
import static probe.WorkerProbe.Box;
import static probe.WorkerProbe.check;

// Test the generated Java delivery machinery. Maven installation and the public
// generated declaration names belong to the separate package-consumer gate.
final class BoundDeliveryProbe {
    static CompletableFuture<Box> echo(HostMembers b, Box x) {
        return Delivery.task(new TaskPort<Box>(Methods.ECHO,1,1,f->f.host.input(0,Box.class,x),
            (f,s)->Wire.success(s),(f,s)->{Wire.success(s);return f.host.output(Box.class);}).bound(b));
    }
    static CompletableFuture<Box> relay(HostMembers b, Box x, Function<Box,Box> fn) {
        var slot=CallbackPort.<Box,Box>bind(f->f.host.output(Box.class),fn,(f,r)->f.host.input(0,Box.class,r));
        return Delivery.task(new CallbackPort<Box>(Methods.RELAY,2,1,f->f.host.input(0,Box.class,x),
            (f,s,state)->{if(s==14)throw state.original(f.scalar());Wire.success(s);return f.host.output(Box.class);},
            new CallbackPort.Slot[]{null,slot}).bound(b));
    }
    static void run(HostMembers a, HostMembers b, Box x) throws Exception {
        var y=new Box(101); var callbacks=new AtomicInteger();
        check(relay(a,x,v->{
            check(v==x && Thread.currentThread().isVirtual()); callbacks.incrementAndGet();
            return echo(b,y).join();
        }).get(8,TimeUnit.SECONDS)==y && callbacks.get()==1);
        var failure=new IllegalArgumentException("application callback");
        try { relay(a,x,v->{throw failure;}).get(8,TimeUnit.SECONDS); throw new AssertionError(); }
        catch(ExecutionException e) { check(e.getCause()==failure); }

        var entered=new CountDownLatch(1); var release=new CompletableFuture<Box>();
        var finished=new CountDownLatch(1);
        var pending=relay(a,x,v->{entered.countDown();try{return release.join();}finally{finished.countDown();}});
        try {
            check(entered.await(8,TimeUnit.SECONDS)); check(pending.cancel(false));
            check(pending.isCancelled() && echo(b,y).get(8,TimeUnit.SECONDS)==y);
        } finally { release.complete(x); }
        check(finished.await(8,TimeUnit.SECONDS) && pending.isCancelled());

        var factories=new AtomicInteger(); var count=new AtomicInteger();
        var subscription=new CompletableFuture<Flow.Subscription>(); var item=new CompletableFuture<Box>();
        var end=new CompletableFuture<Void>();
        Flow.Publisher<Box> items=Delivery.stream(()->new TaskPort<Box>(Methods.BOXES,2,1,
            f->{factories.incrementAndGet();f.host.input(0,Box.class,x);f.word(1,0);},
            (f,s)->Wire.success(s),(f,s)->{if(s==2)return null;Wire.success(s);return f.host.output(Box.class);}).bound(a));
        items.subscribe(new Flow.Subscriber<Box>() {
            public void onSubscribe(Flow.Subscription s){subscription.complete(s);}
            public void onNext(Box v){count.incrementAndGet();item.complete(v);}
            public void onError(Throwable e){end.completeExceptionally(e);item.completeExceptionally(e);}
            public void onComplete(){end.complete(null);}
        });
        var s=subscription.get(8,TimeUnit.SECONDS);
        try {
            check(factories.get()==0 && !item.isDone()); s.request(1);
            check(item.get(8,TimeUnit.SECONDS)==x && !end.isDone()); s.request(1);
            end.get(8,TimeUnit.SECONDS); check(count.get()==1 && factories.get()==1);
        } finally { s.cancel(); }
    }
}
