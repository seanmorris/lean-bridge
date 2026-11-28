import java.lang.ref.Cleaner;
import java.lang.ref.Reference;
import java.lang.ref.WeakReference;

/** Private state; only NativePort's owner thread touches a Lean reference. */
final class HostFunctions {
    private static final Cleaner CLEANER=Cleaner.create();
    private HostFunctions() {}

    // Function.apply cannot declare a checked exception. Rethrow the exact
    // application exception (also available through the checked invoke API)
    // rather than wrapping it or losing its identity at a retained callback.
    @SuppressWarnings("unchecked")
    static <E extends Throwable> RuntimeException unchecked(Exception original) throws E {
        throw (E)original;
    }

    static final class Group implements Runnable {
        final WeakReference<Object> owner;
        private final WeakReference<AutoCloseable> tasks;
        private HostMembers port;
        private int active;
        private boolean closing;
        private java.util.Set<Lease> deferred;
        Group(Object bound, HostMembers port, AutoCloseable scope) {
            this.port=port; owner=new WeakReference<>(bound); tasks=new WeakReference<>(scope);
            CLEANER.register(bound,this);
        }
        private synchronized HostMembers enter() {
            if (port==null || closing) throw new IllegalStateException("Closed JVM host binding");
            ++active; return port;
        }
        Object[] invoke(int op,Object[] args) throws Exception {
            Object bound=owner.get();
            if (bound==null) throw new IllegalStateException("Expired JVM host binding");
            return invokeOn(bound,op,args);
        }
        Object[] invokeOn(Object bound,int op,Object[] args) throws Exception {
            HostMembers p=enter();
            try { return NativePort.invoke(p,op,args); }
            finally { synchronized (this) { --active; } Reference.reachabilityFence(bound); }
        }
        void close() throws Exception {
            HostMembers p;
            synchronized (this) {
                if (port==null) return;
                if (active!=0 || closing) throw new IllegalStateException("Cannot close an active JVM host binding");
                closing=true; p=port;
            }
            // A worker shutdown can invoke application callbacks. Never hold
            // a Java monitor while waiting for them or for the JNI dispatcher.
            try {
                AutoCloseable scope=tasks.get();
                if (scope!=null) scope.close(); else NativePort.invoke(p,-1,null);
                synchronized (this) { port=null; closing=false; deferred=null; }
            } catch (Throwable failure) {
                // A task callback can refuse to close its own scope. If a
                // different thread dropped a callable meanwhile, its drop is
                // still owed; never revive it or wait for another GC cycle.
                java.util.Set<Lease> owed;
                synchronized (this) { closing=false; owed=deferred; deferred=null; }
                if (owed!=null) for (var lease:owed) try { lease.close(); }
                    catch (Throwable cleanup) { if(cleanup!=failure) failure.addSuppressed(cleanup); }
                throw failure;
            }
        }
        public void run() {
            try { close(); } catch (Exception ignored) { /* explicit close reports failures */ }
        }
    }
    static final class Lease implements Runnable {
        final long[] cell=new long[1];
        final Group group;
        final int apply,drop;
        private boolean pending;
        Lease(Object callable,Group group,int apply,int drop) {
            this.group=group; this.apply=apply; this.drop=drop;
            CLEANER.register(callable,this);
        }
        synchronized long ticket() {
            if (cell[0]==0 || pending) throw new IllegalStateException("Closed returned Lean function");
            return cell[0];
        }
        Object[] invoke(Object arg) throws Exception {
            return group.invoke(apply,new Object[]{new long[]{ticket()},arg});
        }
        void close() throws Exception {
            Object bound=group.owner.get();
            if (bound==null) return; // Group retirement owns the remaining tickets.
            HostMembers p;
            long id;
            synchronized (group) {
                if (group.port==null) return;
                synchronized (this) {
                    id=cell[0]; if(id==0) return;
                    if (group.closing) {
                        if(group.deferred==null) group.deferred=new java.util.HashSet<>();
                        group.deferred.add(this); pending=true; return;
                    }
                    cell[0]=0;
                }
                p=group.enter();
            }
            try { NativePort.invoke(p,drop,new Object[]{new long[]{id}}); }
            catch (Throwable error) {
                synchronized (this) { cell[0]=id; pending=false; }
                throw error;
            } finally { synchronized (group) { --group.active; } Reference.reachabilityFence(bound); }
        }
        public void run() {
            try { close(); } catch (Exception ignored) { /* group retirement also revokes every live ticket */ }
        }
    }
}
