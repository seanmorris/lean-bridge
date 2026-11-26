import java.util.concurrent.*;
import org.leanbridge.workshop.*;

/** An ordinary Maven consumer: no ffi, raw handles, scheduler or reflection. */
public final class Installed {
    public static final class Box {
        private long value;
        public Box(long n){value=n;}
        public long read(){return value;}
        public long getLevel(){return value;}
        public void setLevel(long n){value=n;}
        public Box identity(){return this;}
        @Override public boolean equals(Object other){return other instanceof Box;}
        @Override public int hashCode(){return 1;}
    }
    static void check(boolean ok){if(!ok)throw new AssertionError();}
    static <T> T get(CompletableFuture<T> f) throws Exception { return f.get(8,TimeUnit.SECONDS); }
    static Throwable failure(CompletableFuture<?> future) throws Exception {
        try { get(future); throw new AssertionError("missing failure"); }
        catch(ExecutionException e){return e.getCause();}
    }
    static final class Items implements Flow.Subscriber<Box> {
        Flow.Subscription s; final CompletableFuture<Box> first=new CompletableFuture<>();
        final CompletableFuture<Throwable> end=new CompletableFuture<>();
        public void onSubscribe(Flow.Subscription next){check(s==null);s=next;}
        public void onNext(Box x){check(s!=null && first.complete(x));}
        public void onComplete(){check(s!=null && end.complete(null));}
        public void onError(Throwable e){check(s!=null && end.complete(e));}
    }
    public static void main(String[] args) throws Exception {
        if(args[0].equals("peer-first")) check(get(org.leanbridge.workshop_peer.Api.scalar(1))==38);
        else check(get(Api.scalar(1))==2);
        var early=args[0].equals("peer-first")?org.leanbridge.workshop_peer.Api.bindHosts(Box.class):null;
        var latch=new CompletableFuture<Box>(); var late=new CountDownLatch(2);
        try(var a=Api.bindHosts(Box.class); var b=early!=null?early:org.leanbridge.workshop_peer.Api.bindHosts(Box.class)) {
            check(get(Api.scalar(10))==11 && get(org.leanbridge.workshop_peer.Api.scalar(10))==47);
            var x=a.make(27); var y=b.make(53);
            check(x!=y && x.equals(y) && get(a.echo(x))==x && get(a.echo(y))==y);
            check(a.identity(x)==x && a.identity(y)==y);
            check(a.update(x,28)==28 && b.read(x)==28 && get(b.echo(x))==x);
            check(get(a.relay(x,v->{check(v==x && Thread.currentThread().isVirtual()); return b.echo(y).join();}))==y);
            check(get(a.outcome(x)) instanceof Result.Err<?,?> err && err.error()==x);
            var refused=(RefuseError)failure(a.refuse(x)); check(refused.payload(Box.class)==x && refused.declaration().equals("Jobs.refuse"));
            var original=new IllegalArgumentException("from Java");
            check(failure(a.relay(x,v->{throw original;}))==original);
            check(get(a.recover(x,v->{throw original;}))==x);
            check(failure(a.echo(null)) instanceof NullPointerException && get(a.echo(x))==x);
            for(boolean fail:new boolean[]{false,true}) {
                var sink=new Items();a.boxes(x,fail).subscribe(sink);check(!sink.first.isDone());sink.s.request(1);
                check(get(sink.first)==x && !sink.end.isDone());sink.s.request(1);var error=get(sink.end);
                if(fail) check(error instanceof BoxesStepError e && e.payload(Box.class)==x && e.declaration().equals("Jobs.next"));
                else check(error==null);
            }
            var io=new Items();a.ioBoxes(x).subscribe(io);io.s.request(1);check(get(io.first)==x);io.s.request(1);
            check(get(io.end) instanceof LeanIOException e && e.declaration().equals("Jobs.ioNext") && e.getMessage().contains("JVM cursor ended"));
            var cold=a.boxes(x,false);var idle=new Items();cold.subscribe(idle);
            var entered=new CountDownLatch(2);
            var stop=a.relay(x,v->{entered.countDown();try{return latch.join();}finally{late.countDown();}});
            var survivor=b.relay(x,v->{entered.countDown();try{return latch.join();}finally{late.countDown();}});
            check(entered.await(8,TimeUnit.SECONDS));a.close();
            check(stop.isCancelled() && !survivor.isDone() && get(idle.end) instanceof CancellationException);
            try(var reopened=Api.bindHosts(Box.class)) {
                var stale=new Items();cold.subscribe(stale);
                check(get(stale.end) instanceof IllegalStateException && get(reopened.echo(x))==x);
            }
            latch.complete(y);check(get(survivor)==y && stop.isCancelled() && late.await(8,TimeUnit.SECONDS));
            check(refused.payload(Box.class)==x);
            var fatal=new LinkageError("fatal callback");
            check(failure(b.relay(x,v->{throw fatal;}))==fatal);
            check(failure(Api.scalar(0)) instanceof IllegalStateException);
        } finally { latch.complete(new Box(0)); }
        System.out.println("Java: installed class workers, backpressure, exceptions and shutdown");
    }
}
