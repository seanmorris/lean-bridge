import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.*;
import org.leanbridge.workshop.Api;
import org.leanbridge.workshop.LeanIOException;

public final class Worker {
    static <T> T get(CompletableFuture<T> f) throws Exception {return f.get(10,TimeUnit.SECONDS);}
    public static void main(String[] args) throws Exception {
        try(var a=Api.bindHosts(Installed.Box.class);var b=Api.bindHosts(Installed.Box.class)) {
            var x=a.make(7);var y=b.make(13);var f=a.remember(x);var g=b.remember(y);
            Installed.check(get(a.echoBox(x))==x && get(a.relay(y,f))==x);
            var boom=new Exception("original checked application exception");y.onRead=()->{throw boom;};
            Installed.check(Installed.reject(ExecutionException.class,()->get(a.relay(y,f))).getCause()==boom);
            y.onRead=null;
            try(var read=a.fileReader()) {
                var path=Path.of("contents");Installed.reject(LeanIOException.class,()->read.invoke(path.toString()));
                Files.writeString(path,"first");Installed.check(read.invoke(path.toString()).equals("first"));
                Files.writeString(path,"second");Installed.check(read.invoke(path.toString()).equals("second"));
            }
            var entered=new CountDownLatch(2);var release=new CompletableFuture<Boolean>();
            var finished=new CountDownLatch(2);var calls=new java.util.concurrent.atomic.AtomicInteger();
            try {
                var victim=a.relay(y,v->{entered.countDown();try{release.join();return f.apply(v);}finally{finished.countDown();}});
                var survivor=b.relay(x,v->{entered.countDown();try{release.join();calls.incrementAndGet();return g.apply(v);}finally{finished.countDown();}});
                Installed.check(entered.await(10,TimeUnit.SECONDS));a.close();Installed.check(victim.isCancelled());
                release.complete(true);Installed.check(get(survivor)==y && finished.await(10,TimeUnit.SECONDS) && calls.get()==1);
                Installed.reject(IllegalStateException.class,()->f.invoke(y));
            } finally {release.complete(true);}
        }
        System.out.println("ok Worker normal");
    }
}
