import java.lang.ref.WeakReference;
import java.math.BigInteger;
import java.util.Arrays;
import org.leanbridge.workshop.Api;
import org.leanbridge.workshop.Pair;
import org.leanbridge.workshop.Reading;

public final class Installed {
    public static final class Meter {
        long level; int reads; Exception fault;
        public Meter(long n) { level=n; }
        public long read() throws Exception { ++reads; if(fault!=null) throw fault; return level; }
        public long getLevel() { return level; }
        public void setLevel(long n) { level=n; }
        public Meter identity() { return this; }
        @Override public boolean equals(Object x) { return x instanceof Meter; }
        @Override public int hashCode() { return 1; }
    }
    static void check(boolean yes) { if(!yes) throw new AssertionError(); }
    interface Action { void run() throws Exception; }
    static <T extends Exception> T rejects(Class<T> type,Action action) throws Exception {
        try { action.run(); } catch(Exception e) { if(type.isInstance(e)) return type.cast(e); throw e; }
        throw new AssertionError("expected " + type.getName());
    }
    static void collected(WeakReference<?> weak) throws InterruptedException {
        for(int i=0;i<250 && weak.get()!=null;i++){ System.gc(); Thread.sleep(10); }
        check(weak.get()==null);
    }
    record Capture(Api.ReturnedChoose<Meter> fn,WeakReference<Meter> a,WeakReference<Meter> b) {}
    static Capture capture(Api.Bound<Meter> owner) throws Exception {
        Meter a=new Meter(8),b=new Meter(9);
        try(var pair=new Pair<>(a,new byte[0],BigInteger.ZERO,b)) {
            return new Capture(owner.choose(pair),new WeakReference<>(a),new WeakReference<>(b));
        }
    }
    static void verify(Capture c) throws Exception {
        System.gc(); check(c.a.get()!=null && c.b.get()!=null);
        check(c.fn.invoke(true)==c.a.get() && c.fn.invoke(false)==c.b.get());
    }
    static WeakReference<Meter> overflow(Api.Bound<Meter> owner) throws Exception {
        var only=new Meter(13);
        var error=rejects(IllegalArgumentException.class,()->owner.duplicateSample(only,new byte[8*1024*1024+1]));
        check(error.getMessage().contains("copy budget exceeded")); return new WeakReference<>(only);
    }
    record Outside(Pair<Meter> pair,WeakReference<Meter> only) {}
    static Outside outside(Api.Bound<Meter> owner) throws Exception {
        var x=new Meter(20); return new Outside(owner.createPair(x),new WeakReference<>(x));
    }
    static void verify(Outside x) {
        System.gc(); check(x.only.get()!=null && x.pair.getLead()==x.only.get() && x.pair.getSpare()==x.only.get());
    }
    public static void main(String[] args) throws Exception {
        var a=new Meter(4); var b=new Meter(9); byte[] sample={3,7}; var wide=BigInteger.ONE.shiftLeft(130);
        try(var owner=Api.bindHosts(Meter.class); var pair=new Pair<>(a,sample,wide,b)) {
            sample[0]=99;
            try(var result=owner.flip(pair)) {
                check(result.getLead()==b && result.getSpare()==a && result.getSequence().equals(wide.add(BigInteger.ONE)));
                check(Arrays.equals(result.getSample(),new byte[]{3,7,4})); result.getSample()[0]=88;
                check(result.getSample()[0]==3 && pair.getSample()[0]==3 && owner.sumRead(pair,result)==8);
            }
            var closed=owner.createPair(b); closed.close(); int reads=a.reads;
            rejects(IllegalStateException.class,()->owner.sumRead(pair,closed)); check(a.reads==reads);
            try(var neg=new Pair<>(a,sample,BigInteger.valueOf(-1),b)) {
                rejects(IllegalArgumentException.class,()->owner.sumRead(pair,neg)); check(a.reads==reads);
            }
            a.fault=new Exception("application fault"); check(rejects(Exception.class,()->owner.flip(pair))==a.fault); a.fault=null;
            collected(overflow(owner));
            try(var reading=owner.duplicateSample(b,sample)) {
                check(reading.getSourceMeter()==b && reading.getHeld()[0]==99); reading.getHeld()[0]=8;
                check(reading.getHeld()[0]==99 && reading.getSpareBytes()[0]==99);
            }
            var c=capture(owner); verify(c); c.fn.close(); c.fn.close(); collected(c.a); collected(c.b);
            var x=outside(owner); owner.close(); verify(x); x.pair.close(); x.pair.close(); collected(x.only);
        }
        System.out.println("Java: original meters, copied arrays, checked Nat, partial-result cleanup, retained closure and final release");
    }
}
