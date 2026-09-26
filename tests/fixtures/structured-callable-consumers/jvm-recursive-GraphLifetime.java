package org.leanbridge.structured;

import java.lang.foreign.*;
import java.lang.ref.*;
import java.lang.reflect.*;
import java.math.BigInteger;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

public final class GraphLifetime {
    private GraphLifetime() { }
    private static int checks;
    private static Method make, call, twice;
    private static Object value;
    private static void check(boolean condition) { ++checks; if (!condition) throw new AssertionError("recursive lifetime " + checks); }
    private static Object invoke(Method method, Object target, Object... args) {
        try { return method.invoke(target, args); }
        catch (InvocationTargetException error) { throw GraphFaultProbe.raise(error.getCause()); }
        catch (ReflectiveOperationException error) { throw new AssertionError(error); }
    }
    private static Object create() { return invoke(make, null, value); }
    private static Object apply(Object owned) {
        var method = Arrays.stream(owned.getClass().getDeclaredMethods()).filter(item -> item.getName().equals("invoke")).findFirst().orElseThrow();
        return invoke(method, owned, true, value);
    }
    private static void close(Object owned) {
        try { ((AutoCloseable)owned).close(); }
        catch (Exception error) { throw GraphFaultProbe.raise(error); }
    }
    private static Throwable reject(Class<? extends Throwable> type, Runnable action) {
        try { action.run(); }
        catch (Throwable error) { check(type.isInstance(error)); return error; }
        throw new AssertionError("Expected " + type.getName());
    }
    private static Object callback(java.util.function.Function<Object,Object> callback) {
        var type = call.getParameterTypes()[1];
        return Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, (proxy, method, args) -> {
            if (method.getName().equals("invoke")) return callback.apply(args[0]);
            throw new AssertionError(method);
        });
    }
    private static Object reenter(int depth) {
        return invoke(call, null, value, callback(item -> depth == 0 ? item : reenter(depth - 1)));
    }
    private static WeakReference<Object> abandoned() { return new WeakReference<>(create()); }
    public static void main(String[] args) throws Throwable {
        String namespace = "org.leanbridge.structured" + (args[0].equals("kotlin") ? ".kotlin" : "");
        var api = Class.forName(namespace + ".Api");
        make = Arrays.stream(api.getDeclaredMethods()).filter(item -> item.getName().equals("makeRecursive")).findFirst().orElseThrow();
        call = Arrays.stream(api.getDeclaredMethods()).filter(item -> item.getName().equals("callRecursive")).findFirst().orElseThrow();
        twice = Arrays.stream(api.getDeclaredMethods()).filter(item -> item.getName().equals("twiceRecursive")).findFirst().orElseThrow();
        value = Class.forName(namespace + ".TreeLeaf").getConstructor(BigInteger.class).newInstance(BigInteger.ONE.shiftLeft(200));
        GraphProbeSetup.initialize(); check(GraphFaultProbe.identities() == 0);
        var owned = create(); var error = new AtomicReference<Throwable>();
        Thread.ofPlatform().start(() -> { try { apply(owned); } catch(Throwable failure) { error.set(failure); } }).join();
        check(error.get() instanceof IllegalStateException); check(value.equals(apply(owned))); check(GraphFaultProbe.identities() == 1);
        var threads = new ArrayList<Thread>();
        for (int i = 0; i < 16; ++i) threads.add(Thread.ofPlatform().start(() -> close(owned)));
        for (var thread : threads) thread.join();
        check(GraphFaultProbe.identities() == 0); reject(IllegalStateException.class, () -> apply(owned));
        var orphan = new AtomicReference<Object>(); Thread.ofPlatform().start(() -> orphan.set(create())).join();
        reject(IllegalStateException.class, () -> apply(orphan.get())); close(orphan.get()); check(GraphFaultProbe.identities() == 0);
        error.set(null); Thread.ofVirtual().start(() -> { try { create(); } catch(Throwable failure) { error.set(failure); } }).join();
        check(error.get() instanceof IllegalStateException); check(GraphFaultProbe.identities() == 0);
        var virtualClosed = create(); Thread.ofVirtual().start(() -> close(virtualClosed)).join(); check(GraphFaultProbe.identities() == 0);
        reject(IllegalStateException.class, () -> apply(virtualClosed));
        var active = create();
        GraphFaultProbe.during = () -> { close(active); check(GraphFaultProbe.identities() == 1); };
        check(value.equals(apply(active))); check(GraphFaultProbe.during == null && GraphFaultProbe.identities() == 0);
        reject(IllegalStateException.class, () -> apply(active));
        for (Throwable marker : new Throwable[]{new RuntimeException("marker"),new Error("fatal marker"),new Exception("checked marker")}) {
            var suppressed = new Exception("suppressed"); marker.addSuppressed(suppressed); var stack = marker.getStackTrace(); int[] count = {0};
            var caught = reject(Throwable.class, () -> invoke(twice, null, value, GraphMarker.callback(args[0].equals("kotlin"),marker,count)));
            check(caught == marker && caught.getSuppressed()[0] == suppressed && Arrays.equals(stack,caught.getStackTrace()) && count[0] == 1);
            check(value.equals(reenter(0))); check(GraphFaultProbe.identities() == 0);
        }
        check(value.equals(reenter(12))); reject(IllegalArgumentException.class, () -> reenter(80)); check(value.equals(reenter(2)));
        var forked = create(); GraphFaultProbe.fakeFork = true;
        try { reject(IllegalStateException.class, GraphLifetime::create); reject(IllegalStateException.class, () -> apply(forked)); reject(IllegalStateException.class, () -> close(forked)); }
        finally { GraphFaultProbe.fakeFork = false; }
        check(GraphFaultProbe.identities() == 1 && value.equals(apply(forked))); close(forked);
        var weak = abandoned();
        for(int attempt=0;attempt<200 && (weak.get()!=null || GraphFaultProbe.identities()!=0);++attempt) { System.gc(); Thread.sleep(10); }
        check(weak.get()==null); check(GraphFaultProbe.identities()==0);
        var held = new ArrayList<Object>();
        try {
            for(int i=0;i<4096;++i)held.add(create());
            check(GraphFaultProbe.identities()==4096); reject(OutOfMemoryError.class,GraphLifetime::create);
            check(value.equals(apply(held.get(0))) && value.equals(apply(held.get(4095))));
        } finally { for(var entry:held)close(entry); }
        check(GraphFaultProbe.identities()==0);
        for(int i=0;i<8192;++i) { var entry=create(); try { check(value.equals(apply(entry))); } finally { close(entry); } }
        GraphFaultProbe.clean(); check(GraphFaultProbe.identities()==0); check(GraphFaultProbe.remainingHosts()==0);
        System.out.println("{\"profile\":\""+args[0]+"\",\"checks\":"+checks+",\"capacity\":4096,\"recovered\":8192,\"identities\":0,\"cleaner\":true,\"simulatedFork\":true,\"actualFork\":false}");
    }
}
