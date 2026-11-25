import java.lang.ref.Reference;
import java.lang.ref.WeakReference;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import org.leanbridge.workshop.Api;

public final class Installed {
    interface Action { void run() throws Exception; }
    public static final class Box {
        long value; Action onRead;
        public Box(long n) { value=n; }
        public long read() throws Exception { if(onRead!=null) onRead.run(); return value; }
        public long getLevel() { return value; }
        public void setLevel(long n) { value=n; }
        public Box identity() { return this; }
        @Override public boolean equals(Object other) { return other instanceof Box; }
        @Override public int hashCode() { return 1; }
    }
    static void check(boolean yes) { if(!yes) throw new AssertionError(); }
    static <T extends Throwable> T reject(Class<T> kind,Action action) throws Exception {
        try { action.run(); } catch(Throwable e) { if(kind.isInstance(e)) return kind.cast(e); throw e; }
        throw new AssertionError("Expected "+kind);
    }
    static void gone(WeakReference<?> ref) throws Exception {
        for(int i=0;i<200 && !ref.refersTo(null);++i) { System.gc();Thread.sleep(15); }
        check(ref.refersTo(null));
    }
    record Capture(Api.ReturnedReader<Box> fn,WeakReference<Box> object) {}
    static Capture keep(Api.Bound<Box> bound) throws Exception {
        var x=bound.make(40);return new Capture(bound.reader(x),new WeakReference<>(x));
    }
    static WeakReference<Box> forgotten(Api.Bound<Box> bound) throws Exception {
        return keep(bound).object();
    }
    record Orphan(Api.ReturnedRemember<Box> fn, WeakReference<Box> object, WeakReference<?> owner) {}
    static Orphan orphan() throws Exception {
        var a=Api.bindHosts(Box.class);var x=a.make(13);
        return new Orphan(a.remember(x),new WeakReference<>(x),new WeakReference<>(a));
    }
    static final class Anchor {
        Api.Bound<Box> owner;
        Anchor() throws Exception { owner=Api.bindHosts(Box.class); }
        Orphan start() throws Exception {
            var x=owner.make(29);
            return new Orphan(owner.remember(x),new WeakReference<>(x),new WeakReference<>(owner));
        }
    }
    static void loseOwnerDuringInvocation(Box supplied) throws Exception {
        var anchor=new Anchor();var watch=anchor.start();
        supplied.onRead=()->{
            anchor.owner=null;System.gc();
            check(!watch.owner.refersTo(null) && !watch.object.refersTo(null));
        };
        check(watch.fn.invoke(supplied)==watch.object.get());supplied.onRead=null;
        gone(watch.owner);gone(watch.object);reject(IllegalStateException.class,()->watch.fn.invoke(supplied));
    }
    static Capture fatal(Api.Bound<Box> bound) throws Exception {
        var x=bound.make(2);var fn=bound.reader(x);var fatal=new LinkageError("deliberate terminal failure");
        x.onRead=()->{throw fatal;};check(reject(LinkageError.class,()->fn.invoke(0))==fatal);
        return new Capture(fn,new WeakReference<>(x));
    }
    public static void main(String[] args) throws Exception {
        try(var a=Api.bindHosts(Box.class);var b=Api.bindHosts(Box.class)) {
            var sibling=keep(b);
            if(args[0].equals("retire")) {
                var first=fatal(a);reject(IllegalStateException.class,()->sibling.fn.invoke(0));
                first.fn.close();first.fn.close();gone(first.object);check(!sibling.object.refersTo(null));
                b.close();gone(sibling.object);
            } else {
                var x=a.make(12);var y=b.make(13);check(x!=y && x.equals(y));
                try(var source=a.supplier(x);var set=a.consumer(x);var action=a.action(x)) {
                    java.util.function.Supplier<Box> get=source; java.util.function.Consumer<Long> write=set;
                    Runnable read=action; check(get.get()==x);write.accept(17L);check(x.getLevel()==17);read.run();
                }
                var f=a.remember(x);reject(NullPointerException.class,()->f.invoke(null));
                check(f.getClass().getConstructors().length==0 && f.invoke(y)==x);
                var method=f.getClass().getMethod("invoke",Object.class);
                var wrong=reject(java.lang.reflect.InvocationTargetException.class,()->method.invoke(f,"not a box"));
                check(wrong.getCause() instanceof ClassCastException && f.apply(y)==x);
                var boom=new Exception("original");y.onRead=()->{throw boom;};
                check(reject(Exception.class,()->a.remember(y))==boom && reject(Exception.class,()->f.invoke(y))==boom);
                y.onRead=null;try(var identity=a.identityReader(x)) { check(identity.invoke(0)==x); }
                var task=new FutureTask<Box>(()->f.invoke(y));Thread.startVirtualThread(task);check(task.get(10,TimeUnit.SECONDS)==x);
                y.onRead=()->{
                    check(sibling.fn.invoke(2)==42);reject(IllegalStateException.class,a::close);
                    f.close();reject(IllegalStateException.class,()->f.invoke(y));
                };
                check(f.invoke(y)==x);y.onRead=null;f.close();
                loseOwnerDuringInvocation(y);
                gone(forgotten(a));var abandoned=orphan();gone(abandoned.owner);gone(abandoned.object);
                reject(IllegalStateException.class,()->abandoned.fn.invoke(y));
                var live=keep(a);a.close();gone(live.object);reject(IllegalStateException.class,()->live.fn.invoke(0));
                try(var again=Api.bindHosts(Box.class)) {reject(IllegalStateException.class,()->live.fn.invoke(0));}
                check(sibling.fn.invoke(3)==43);sibling.fn.close();gone(sibling.object);
            }
            Reference.reachabilityFence(b);
        }
        System.out.println("ok Installed "+args[0]);
    }
}
