package org.leanbridge.audit;

import java.lang.ref.Reference;
import java.util.concurrent.*;

/** Deterministic fault injection for the managed facade; no large allocation. */
final class NativePort {
    static int mode;
    static final java.util.concurrent.atomic.AtomicIntegerArray drops=new java.util.concurrent.atomic.AtomicIntegerArray(5);
    static final Error transfer=new AssertionError("injected: cannot transfer JNI result");
    static final RuntimeException cleanup=new IllegalStateException("injected: drop failed");
    static Object[] invoke(HostMembers port,int op,Object[] args) {
        if(op==-1 || op==-2) return null;
        if(op==0) {
            if(mode!=3) ((long[])args[1])[0]=91+mode;
            if(mode==1 || mode==2) throw transfer;
            return new Object[]{0L,null};
        }
        if(op==2) {
            int slot=Math.toIntExact(((long[])args[0])[0]-91);
            drops.incrementAndGet(slot);if(slot==2) throw cleanup;return null;
        }
        throw new AssertionError("unexpected operation");
    }
}
public class Rollback {
    public static final class Box {
        public Box(long n) {} public long read(){return 0;}
        public long getLevel(){return 0;} public void setLevel(long n){} public Box identity(){return this;}
    }
    static void check(boolean yes) {if(!yes)throw new AssertionError();}
    public static void main(String[] args) throws Exception {
        try(var a=Api.bindHosts(Box.class)) {
            for(int mode:new int[]{1,2}) {
                NativePort.mode=mode;
                try {a.remember(new Box(0));throw new AssertionError();}
                catch(Error original) {
                    check(original==NativePort.transfer && NativePort.drops.get(mode)>=1);
                    if(mode==2) check(original.getSuppressed()[0]==NativePort.cleanup);
                }
            }
            NativePort.mode=3;
            try {a.remember(new Box(0));throw new AssertionError();}
            catch(IllegalStateException missing) {check(NativePort.drops.get(3)==0);}
            NativePort.mode=0;try(var f=a.remember(new Box(0))) {f.close();}
            check(NativePort.drops.get(0)==1);
        }
        // Closing a binding can encounter a worker that rejects closure.
        // A concurrently requested function release must not disappear.
        var owner=new Object();var callable=new Object();
        var closing=new CountDownLatch(1);var resume=new CountDownLatch(1);
        AutoCloseable scope=()->{closing.countDown();resume.await();throw NativePort.cleanup;};
        var group=new HostFunctions.Group(owner,HostContract.bind(Unit.class,Box.class),scope);
        var lease=new HostFunctions.Lease(callable,group,1,2);lease.cell[0]=95;
        var attempt=new FutureTask<Void>(()->{group.close();return null;});Thread.startVirtualThread(attempt);
        check(closing.await(5,TimeUnit.SECONDS));lease.close();
        try {lease.ticket();throw new AssertionError();} catch(IllegalStateException expected) {}
        resume.countDown();
        try {attempt.get(5,TimeUnit.SECONDS);throw new AssertionError();}
        catch(ExecutionException failed) {check(failed.getCause()==NativePort.cleanup);}
        check(NativePort.drops.get(4)==1);Reference.reachabilityFence(owner);Reference.reachabilityFence(callable);Reference.reachabilityFence(scope);
        System.out.println("rollback passed");
    }
}
