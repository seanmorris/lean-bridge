package probe;

import java.lang.foreign.*;
import java.nio.*;
import java.util.concurrent.*;

// Test-only private ABI client; the application-facing Maven contract does not
// ask consumers to use buffers, JNI, method indexes or polling.
public final class WorkerProbe {
    enum Unit { INSTANCE }
    public static final class Box {
        long v;
        public Box(long v) { this.v=v; }
        public long read(){return v;}
        public long getLevel(){return v;}
        public void setLevel(long x){v=x;}
        public Box identity(){return this;}
    }
    static native void bind(HostMembers port,int op);
    static native Object work(HostMembers port,Object[] classes,int method,int op,
        ByteBuffer args,ByteBuffer handle,ByteBuffer output,ByteBuffer tags,ByteBuffer status);
    static native int plain(int method,int op,ByteBuffer args,ByteBuffer handle,ByteBuffer output,ByteBuffer tags,ByteBuffer status);
    static native long live();
    static native long domainLive(HostMembers port);
    static native void clear(ByteBuffer output);
    static void check(boolean ok) { if(!ok) throw new AssertionError(); }
    static ByteBuffer buf(int size) { return ByteBuffer.allocateDirect(size).order(ByteOrder.nativeOrder()); }
    static void confined(HostMembers port, Box x) throws Exception {
        try (var arena=Arena.ofConfined()) {
            var args=arena.allocate(24,8); var h=arena.allocate(16,8);
            var out=arena.allocate(32,8); var tags=arena.allocate(1); var status=arena.allocate(8,4);
            var frame=new HostWorkerFrame(1); frame.input(0,Box.class,x);
            check(frame.call(port,Methods.ECHO,0,args,h,out,tags,status)==0);
            try {
                int state; long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
                while((state=plain(Methods.ECHO,1,args.asByteBuffer(),h.asByteBuffer(),out.asByteBuffer(),tags.asByteBuffer(),status.asByteBuffer()))==1) {
                    if(System.nanoTime()>end) throw new AssertionError("confined-frame task did not settle");
                    Thread.sleep(2);
                }
                check(state==0 && args.get(ValueLayout.JAVA_LONG,0)==0);
                check(frame.call(port,Methods.ECHO,2,MemorySegment.NULL,h,out,tags,status)==0);
                check(frame.output(Box.class)==x && out.get(ValueLayout.JAVA_LONG,24)==0);
            } finally {
                if(h.get(ValueLayout.JAVA_LONG,0)!=0)
                    check(plain(Methods.ECHO,3,args.asByteBuffer(),h.asByteBuffer(),out.asByteBuffer(),tags.asByteBuffer(),status.asByteBuffer())==0);
            }
        }
    }
    static final class Call implements AutoCloseable {
        final HostMembers owner; final int method;
        final ByteBuffer h=buf(16),args=buf(48),out=buf(32),tags=buf(2),control=buf(8);
        Call(HostMembers owner,int method) { this.owner=owner; this.method=method; }
        Object call(int op,Object... classes) {
            return work(owner,classes,method,op,args,h,out,tags,control);
        }
        int code() { return control.getInt(0); }
        int raw(int op) { return plain(method,op,args,h,out,tags,control); }
        void waitFor(int op) throws Exception {
            long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
            int v;
            while((v=raw(op))==1) {
                if(System.nanoTime()>end) throw new AssertionError("worker did not settle: "+op);
                Thread.sleep(2);
            }
            check(v==0);
        }
        Object take() throws Exception { waitFor(1); return call(2); }
        public void close() { clear(out); if(h.getLong(0)!=0) check(raw(3)==0); }
    }
    static void probe() throws Exception {
        HostMembers a=HostContract.bind(Unit.class,Box.class), b=HostContract.bind(Unit.class,Box.class);
        bind(a,-2); bind(b,-2); var x=new Box(47);
        try {
            confined(a,x);
            BoundDeliveryProbe.run(a,b,x);
            try(var c=new Call(a,Methods.ECHO)) {
                try { c.call(0,new Object()); throw new AssertionError(); } catch(IllegalArgumentException expected) {}
                try { c.call(0,(Object)null); throw new AssertionError(); } catch(NullPointerException expected) {}
                check(c.h.getLong(0)==0);
                c.call(0,x); check(c.code()==0 && c.args.getLong(0)==0);
                check(c.take()==x && c.code()==0 && c.out.getLong(24)==0);
            }
            try(var c=new Call(a,Methods.OUTCOME)) {
                c.call(0,x); check(c.take()==x && c.tags.get(0)==0 && c.code()==0);
            }
            try(var c=new Call(b,Methods.REFUSE)) {
                check(c.call(0,x)==x && c.code()==3 && c.h.getLong(0)==0);
            }
            try(var c=new Call(a,Methods.RELAY)) {
                c.call(0,x,null); check(c.code()==0);
                c.waitFor(6); long slot=c.out.getLong(0); check(slot==1);
                c.args.putLong(0,slot);
                check(c.call(7)==x && c.code()==0);
                var answer=new Box(72); c.args.putLong(0,0); c.args.putLong(24,slot);
                c.call(8,answer); check(c.code()==0 && c.take()==answer);
            }
            for(boolean fail:new boolean[]{true,false}) try(var c=new Call(b,Methods.BOXES)) {
                c.args.putLong(24,fail?1:0); c.call(0,x,null); check(c.code()==0 && c.raw(4)==0);
                check(c.take()==x && c.code()==0 && c.raw(4)==0);
                check(c.take()==(fail?x:null) && c.code()==(fail?3:2));
            }
            try(var c=new Call(a,Methods.IOBOXES)) {
                c.call(0,x); check(c.code()==0 && c.raw(4)==0);
                check(c.take()==x && c.code()==0 && c.raw(4)==0);
                check(c.take()==null && c.code()==4 && c.out.getLong(24)==1 && c.out.getLong(8)>0);
            }
            bind(a,-1);
            try(var c=new Call(a,Methods.ECHO)) {
                try { c.call(0,x); throw new AssertionError(); } catch(IllegalStateException expected) {}
            }
            try(var c=new Call(b,Methods.ECHO)) { c.call(0,x); check(c.take()==x); }
        } finally { bind(a,-1); bind(b,-1); }
        long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
        while(live()!=0 && System.nanoTime()<end) Thread.sleep(2);
        check(live()==0 && domainLive(b)==0);
    }
    public static void main(String[] args) throws Exception {
        System.load(args[0]);
        try(var service=Executors.newVirtualThreadPerTaskExecutor()) {
            service.submit(()->{probe();return null;}).get();
        }
        System.out.println("JVM owner round-tripped class workers, callback arguments/replies, typed errors and cursors; zero native identities");
    }
}
