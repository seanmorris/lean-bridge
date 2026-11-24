package experiment;

import java.lang.ref.WeakReference;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Path;

public final class SharedHost {
    public static class Box {
        Runnable hook;
        public Box identity() { if(hook!=null) hook.run(); return this; }
        @Override public boolean equals(Object o) { return o instanceof Box; }
        @Override public int hashCode() { return 0; }
    }
    public static final class Other extends Box {}
    private static void check(boolean ok) { if(!ok) throw new AssertionError(); }
    private static void fails(Class<? extends Exception> type,Runnable run) {
        try { run.run(); } catch(Exception e) { if(type.isInstance(e)) return; throw e; }
        throw new AssertionError("expected " + type.getName());
    }
    private static Port port(URLClassLoader c,String name) throws Exception {
        return (Port)c.loadClass("experiment."+name+".PortImpl").getConstructor().newInstance();
    }
    private static WeakReference<Box> exercise(Port a,Port b) {
        var x=new Box(); var y=new Box();
        check(x!=y && x.equals(y));
        fails(IllegalArgumentException.class,()->a.rejectSecond(1,x));
        check(a.live()==0 && b.live()==0);
        check(a.remember(0,x)==x && b.same(0,x) && !b.same(0,y) && b.recall(0)==x);
        check(a.live()==1 && b.live()==1);
        fails(IllegalStateException.class,()->b.recall(1));
        check(!b.same(1,x)); // One Java class bound to two different nominal kinds.
        check(b.live()==2);   // One weak saved Box; one accepted strong Key.
        x.hook=()->fails(IllegalStateException.class,a::close);
        check(a.self(0,x)==x); x.hook=null;
        b.clear(); check(b.live()==1);
        a.close(); a.close(); fails(IllegalStateException.class,()->a.self(0,x));
        check(b.live()==1 && b.self(1,x)==x);
        check(b.remember(1,x)==x); // Keep a Lean reference after the final binding closes.
        return new WeakReference<>(x);
    }
    private static WeakReference<Box> abandon(URLClassLoader loader,String name) throws Exception {
        Port forgotten=port(loader,name); forgotten.bind(Box.class,Box.class);
        var x=new Box(); check(forgotten.self(1,x)==x && forgotten.live()==1);
        return new WeakReference<>(x);
    }
    public static void main(String[] args) throws Exception {
        try (var l1=new URLClassLoader(new URL[]{Path.of(args[0]).toUri().toURL()}, SharedHost.class.getClassLoader());
             var l2=new URLClassLoader(new URL[]{Path.of(args[1]).toUri().toURL()}, SharedHost.class.getClassLoader())) {
            Port a=port(l1,args[2]), b=port(l2,args[3]);
            check(a.getClass().getClassLoader()!=b.getClass().getClassLoader());
            a.bind(Box.class,Box.class);
            fails(IllegalArgumentException.class,()->b.bind(Box.class,Other.class));
            b.bind(Box.class,Box.class);
            var ref=exercise(a,b);
            System.gc(); check(ref.get()!=null && b.live()==1);
            b.close(); check(b.live()==0);
            b.bind(Box.class,Box.class);
            fails(IllegalStateException.class,()->b.recall(1)); b.clear();
            for(int i=0;i<50 && ref.get()!=null;i++) { System.gc(); Thread.sleep(15); }
            check(ref.get()==null && b.live()==0);
            var orphan=abandon(l1,args[2]);
            for(int i=0;i<50 && orphan.get()!=null;i++) { System.gc(); Thread.sleep(15); b.live(); }
            check(orphan.get()==null && b.live()==0); b.close();
        }
        System.out.println("shared Lean pointer; distinct equal objects and nominal kinds; partial bind rollback; last close retired strong pin");
    }
}
