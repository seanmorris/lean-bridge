import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Path;
import java.util.concurrent.FutureTask;

import org.leanbridge.workshop.Api;
import org.leanbridge.workshop.Result;

public final class Consumer {
    @FunctionalInterface public interface Read { long get() throws Exception; }
    public static final class Box {
        private long level;
        public Read hook, onGet, onSet;
        public Box(long n) { level = n; }
        public long read() throws Exception { return hook == null ? level : hook.get(); }
        public long getLevel() throws Exception { if (onGet!=null) onGet.get(); return level; }
        public void setLevel(long n) throws Exception { if (onSet!=null) onSet.get(); level = n; }
        public Box identity() { return this; }
        @Override public boolean equals(Object o) { return o instanceof Box; }
        @Override public int hashCode() { return 1; }
    }
    static void check(boolean p) { if (!p) throw new AssertionError(); }
    static java.lang.ref.WeakReference<Box> retainedUntilClose(java.lang.ref.ReferenceQueue<Box> queue) throws Exception {
        try (var binding = Api.bindHosts(Box.class)) {
            Box only = binding.make(88);
            binding.keep(only);
            return new java.lang.ref.WeakReference<>(only, queue);
        }
    }
    public static void main(String[] args) throws Exception {
        boolean peerFirst = args[0].equals("peer-first");
        var a = peerFirst ? null : Api.bindHosts(Box.class);
        var b = org.leanbridge.workshop_peer.Api.bindHosts(Box.class);
        final var api = a == null ? Api.bindHosts(Box.class) : a;
        try (api; b) {
            ErrorOwner.verify(b);
            Box x = api.make(21), y = b.make(22);
            check(x != y && x.equals(y) && b.identity(x) == x && api.identity(y) == y);
            api.keep(x); check(b.identity(api.held()) == x);
            check(b.update(x, 31) == 31 && x.getLevel() == 31);
            try { api.update(x, -1); throw new AssertionError(); }
            catch (IllegalArgumentException expected) { check(x.getLevel() == 31); }
            x.hook = () -> b.read(y) + 5;
            var call = new FutureTask<Long>(() -> api.read(x));
            Thread.startVirtualThread(call);
            check(call.get(10, java.util.concurrent.TimeUnit.SECONDS) == 27);
            x.hook = () -> {
                try { api.close(); throw new AssertionError(); }
                catch (IllegalStateException active) { return 12; }
            };
            check(api.read(x) == 12);
            var original = new Exception("host read");
            int[] nestedReads = {0};
            x.hook = () -> { ++nestedReads[0]; throw original; };
            var indirect = api.make(5);
            indirect.hook = () -> b.read(x);
            try { api.read(indirect); throw new AssertionError(); } catch (Exception seen) { check(seen == original); }
            try { api.mapped(indirect); throw new AssertionError(); }
            catch (org.leanbridge.workshop.MappedError seen) { check(seen.payload().equals("host read failed")); }
            try { api.replaced(indirect); throw new AssertionError(); }
            catch (org.leanbridge.workshop.LeanIOException seen) { check(seen.getCause().getMessage().contains("replacement")); }
            check(nestedReads[0] == 3);
            x.hook = null;
            check(api.verdict(true).equals(new Result.Ok<>(42L)));
            check(api.verdict(false).equals(new Result.Err<>("ordinary refusal")));
            check(api.layered(x,false).equals(new Result.Ok<>(new Result.Err<>("inner refusal"))));
            // This is the same installed JAR again, in a classloader with no application parent.
            try (var loader = new URLClassLoader(new URL[]{Path.of(args[1]).toUri().toURL()}, ClassLoader.getPlatformClassLoader())) {
                Class<?> other = loader.loadClass("org.leanbridge.workshop.Api");
                try (var handle = (AutoCloseable)other.getMethod("bindHosts", Class.class).invoke(null, Box.class)) {
                    check(handle.getClass().getMethod("held").invoke(handle) == x);
                }
            }
            // An already loaded compatible native component must not exempt another JAR's JNI entry from verification.
            try (var changed = new URLClassLoader(new URL[]{Path.of(args[1]).toUri().toURL()}, ClassLoader.getPlatformClassLoader()) {
                @Override public java.io.InputStream getResourceAsStream(String name) {
                    if (name.startsWith("META-INF/lean-bridge/jni/")) return new java.io.ByteArrayInputStream(new byte[]{1,2,3});
                    return super.getResourceAsStream(name);
                }
            }) {
                try {
                    changed.loadClass("org.leanbridge.workshop.Api").getMethod("bindHosts", Class.class).invoke(null, Box.class);
                    throw new AssertionError("modified JNI entry accepted");
                } catch (java.lang.reflect.InvocationTargetException expected) {
                    Throwable reason = expected.getCause();
                    while (reason.getCause() != null) reason = reason.getCause();
                    check(reason.getMessage().contains("JNI entry library differs"));
                }
            }
            try { Api.bindHosts(String.class); throw new AssertionError(); }
            catch (IllegalArgumentException expected) { check(api.held() == x); }
            api.close(); check(b.read(x) == 31);
            try { api.read(x); throw new AssertionError(); } catch (IllegalStateException expected) { }
        }
        try (var next = Api.bindHosts(Box.class)) {
            try { next.held(); throw new AssertionError(); } catch (IllegalStateException stale) { }
            next.forget();
            check(next.read(next.make(9)) == 9);
        }
        var queue = new java.lang.ref.ReferenceQueue<Box>();
        var reference = retainedUntilClose(queue);
        java.lang.ref.Reference<? extends Box> collected = null;
        for (int i=0; i<60 && collected==null; i++) { System.gc(); collected=queue.remove(100); }
        check(collected == reference);
        try (var left = Api.bindHosts(Box.class); var right = org.leanbridge.workshop_peer.Api.bindHosts(Box.class)) {
            Box inner = right.make(1), outer = left.make(2);
            LinkageError fatal = new LinkageError("injected peer fatal");
            LinkageError[] caught = {null};
            int[] reads = {0};
            inner.hook = () -> { throw fatal; };
            outer.onSet = () -> {
                try { right.mapped(inner); throw new AssertionError("Lean mapped a terminal JVM error"); }
                catch (LinkageError seen) { caught[0] = seen; check(seen == fatal); }
                return 0;
            };
            outer.onGet = () -> ++reads[0];
            try { left.update(outer, 23); throw new AssertionError("returned after peer retirement"); }
            catch (IllegalStateException retired) { check(caught[0] == fatal && reads[0] == 0); }
            try { right.read(inner); throw new AssertionError("peer still usable"); }
            catch (IllegalStateException retired) { check(reads[0] == 0); }
        }
        System.out.println("Java: last-owner nested error updated to 42 and collected; independent peers, repeated classloader, virtual-thread reentry, original and mapped errors, retirement");
    }
}
