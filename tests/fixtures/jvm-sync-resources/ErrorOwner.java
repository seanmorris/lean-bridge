import java.nio.file.*;
import org.leanbridge.desk.Api;
import org.leanbridge.desk.CheckTicketError;

final class ErrorOwner {
    static void check(boolean value) { if (!value) throw new AssertionError(); }
    static long files() throws Exception {
        try (var paths = Files.list(Path.of("/proc/self/fd"))) {
            return paths.filter(p -> {
                try { return Files.readSymbolicLink(p).toString().equals("/dev/null"); }
                catch (java.io.IOException e) { return false; }
            }).count();
        }
    }
    static void owners(int live, long descriptors) throws Exception {
        check(Observe.snapshot()[3] == live);
        check(files() == descriptors);
    }
    public static void main(String[] args) throws Exception {
        if (args[0].equals("peer-first")) org.leanbridge.counter.Api.issue(0).close();
        Api.issue(1).close();
        org.leanbridge.counter.Api.issue(1).close();
        long base = files(); owners(0, base);
        var original = Api.issue(41);
        owners(1, base + 1);
        try {
            Api.checkTicket(true, original);
            throw new AssertionError("expected a synchronous declared failure");
        } catch (CheckTicketError error) {
            var payload = error.payload();
            check(error.declaration().equals("Desk.checkTicket") && payload.sameResource(original));
            original.close();
            check(original.isClosed() && !payload.isClosed());
            try { Api.count(original); throw new AssertionError("stale ticket accepted"); }
            catch (IllegalStateException stale) { check(stale.getMessage().contains("closed")); }
            owners(1, base + 1);
            try (var alias = org.leanbridge.counter.Api.bump(payload)) { check(alias.sameResource(payload)); }
            check(Api.count(payload) == 42);
            payload.close(); payload.close();
            owners(0, base);
        }
        try (var fresh = Api.issue(8)) { check(Api.count(fresh) == 8); }
        owners(0, base);
        System.out.println("Java: only the declared error holds the live ticket, peer read 42, zero owners and descriptor delta");
    }
}
