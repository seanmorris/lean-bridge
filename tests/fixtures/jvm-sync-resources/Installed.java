import org.leanbridge.desk.Api;
import org.leanbridge.desk.CheckTicketError;
import java.nio.file.*;
import java.util.concurrent.*;
import java.lang.foreign.*;
import static java.lang.foreign.ValueLayout.*;

final class Installed {
    static void check(boolean ok) { if (!ok) throw new AssertionError(); }
    static void closed(Runnable f) {
        try { f.run(); throw new AssertionError("closed lease accepted"); }
        catch (IllegalStateException e) { check(e.getMessage().contains("closed")); }
    }
    static long descriptors() throws Exception {
        try (var files = Files.list(Path.of("/proc/self/fd"))) {
            return files.filter(p -> { try { return Files.readSymbolicLink(p).toString().equals("/dev/null"); }
                catch (java.io.IOException e) { return false; } }).count();
        }
    }
    // Exercise frame abandonment before Java decodes the native lease. The private
    // ABI is used only by this observer, never by the application examples.
    static void abandon(int issue, String ledger, String kind) throws Exception {
        var w = Class.forName("org.leanbridge.desk.Wire");
        var init = w.getDeclaredConstructor(int.class, int.class); init.setAccessible(true);
        var word = w.getDeclaredMethod("word", int.class, long.class); word.setAccessible(true);
        var call = w.getDeclaredMethod("call", int.class); call.setAccessible(true);
        try (var f = (AutoCloseable)init.newInstance(1, 1)) {
            word.invoke(f, 0, 72L); check((int)call.invoke(f, issue) == 0);
            check(Observe.snapshot()[3] == 1);
            // Even a direct native release from this Java thread must refuse
            // without consuming the words. Wire.close must then reach the owner.
            var outField = w.getDeclaredField("out"); outField.setAccessible(true);
            var out = (MemorySegment)outField.get(f); long id = out.get(JAVA_LONG, 0);
            var lib = "liblb_task_resources_" + ledger + ".so";
            var path = System.getProperty("lean.bridge.jvm.native-library-v1.library." + lib + ".path");
            try (var arena = Arena.ofConfined()) {
                var lookup = SymbolLookup.libraryLookup(Path.of(path), arena);
                var release = Linker.nativeLinker().downcallHandle(lookup.find("lb_task_resource_" + ledger + "_release").orElseThrow(),
                    FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS));
                int refused = (int)release.invokeExact(arena.allocateFrom(kind), out);
                check(refused == 1 && id != 0 && out.get(JAVA_LONG, 0) == id && Observe.snapshot()[3] == 1);
            } catch (Throwable e) { throw new AssertionError(e); }
        }
        check(Observe.snapshot()[3] == 0);
    }
    public static void main(String[] args) throws Exception {
        var first = args[0].equals("peer-first") ? org.leanbridge.counter.Api.issue(40) : Api.issue(40);
        var nominal = first.getClass(); check(nominal.getConstructors().length == 0);
        for (var m : nominal.getDeclaredMethods()) if (java.lang.reflect.Modifier.isPublic(m.getModifiers())) {
            check(java.util.Set.of("close", "sameResource", "isClosed", "retain").contains(m.getName()));
            check(m.getReturnType() == nominal || m.getReturnType() == boolean.class || m.getReturnType() == void.class);
            for (var param : m.getParameterTypes()) check(param == nominal);
        }
        first.close();
        long baseline = descriptors();
        try (var t = Api.issue(10); var peer = org.leanbridge.counter.Api.bump(t);
             var b = Api.badge(4); var different = org.leanbridge.counter.Api.issue(11)) {
            check(Api.count(t) == 11 && org.leanbridge.counter.Api.readBadge(b) == 4);
            check(t.sameResource(peer) && peer.sameResource(t) && !different.sameResource(t));
            try (var alias = Api.checkTicket(false, peer)) { check(alias.sameResource(t)); }
            try { Api.checkTicket(true, peer); throw new AssertionError("expected EIO failure"); }
            catch (CheckTicketError e) { try (var payload = e.payload()) { check(payload.sameResource(t)); } }
            var stale = t.retain(); stale.close(); stale.close();
            check(stale.isClosed()); closed(stale::retain); closed(() -> t.sameResource(stale));
            closed(() -> org.leanbridge.counter.Api.bump(stale));
            try (var threads = Executors.newVirtualThreadPerTaskExecutor()) {
                var jobs = new java.util.ArrayList<Future<?>>();
                for (int i = 0; i < 12; i++) jobs.add(threads.submit(() -> {
                    try (var alias = t.retain(); var result = org.leanbridge.counter.Api.bump(alias)) {
                        check(result.sameResource(t));
                    }
                }));
                for (var job : jobs) job.get(20, TimeUnit.SECONDS);
                var start = new CountDownLatch(1); var race = t.retain();
                var use = threads.submit(() -> {
                    start.await(); try (var copy = race.retain()) { check(copy.sameResource(t)); }
                    catch (IllegalStateException e) { check(e.getMessage().contains("closed")); }
                    return null;
                });
                start.countDown(); race.close(); use.get(20, TimeUnit.SECONDS);
            }
            check(Api.count(t) == 23);
        }
        check(Observe.snapshot()[3] == 0 && descriptors() == baseline);
        abandon(Integer.parseInt(args[1]), args[2], args[3]);
        check(descriptors() == baseline);
        try (var live = org.leanbridge.counter.Api.issue(3)) {
            Observe.retire();
            try { Api.count(live); throw new AssertionError("retired runtime accepted"); }
            catch (IllegalStateException e) { check(e.getMessage().contains("unavailable")); }
        }
        check(Observe.snapshot()[3] == 0 && descriptors() == baseline);
        System.out.println("Java: exchange, typed failure, cross-thread retain and close, abandoned frame and retired cleanup; zero leaked leases or files");
    }
}
