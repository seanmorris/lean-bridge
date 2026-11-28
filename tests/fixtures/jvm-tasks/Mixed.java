import java.math.BigInteger;
import java.nio.file.*;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.leanbridge.timers.Api;

class Mixed extends Observe {
    static long registrations() {
        try (var info = Files.list(Path.of("/proc/self/fdinfo"))) {
            return info.mapToLong(f -> { try (var rows = Files.lines(f)) { return rows.filter(s -> s.startsWith("tfd:")).count(); }
                catch (java.io.IOException e) { return 0; } }).max().orElse(0);
        } catch (java.io.IOException e) { throw new AssertionError(e); }
    }
    public static void main(String[] args) throws Exception {
        if (args[0].equals("sync-first")) check(org.leanbridge.journal.Api.count() == 0);
        else check(Api.immediate(BigInteger.ONE).join().intValueExact() == 2);
        check(Api.owner().split(" ")[0].equals(org.leanbridge.journal.Api.owner().split(" ")[0]));
        Api.reset(); var task = Api.openTask(true, "release");
        until(() -> Api.state() == 1);
        var then = task.thenApply(v -> org.leanbridge.journal.Api.bump(3));
        check(org.leanbridge.journal.Api.bump(2) == 2);
        Api.release(); check(then.get(20, TimeUnit.SECONDS) == 5);
        drained(); Api.reset();
        var pending = new ArrayList<CompletableFuture<org.leanbridge.timers.Result<String,String>>>();
        for (int i=0; i<32; ++i) pending.add(Api.openTask(true, "ready"));
        // Observe actual kernel registrations, not merely how many futures Java allocated.
        until(() -> reactors() == 1 && registrations() == pending.size() + 2);
        Api.release();
        for (var f : pending) check(f.join().equals(new org.leanbridge.timers.Result.Ok<>("ready")));
        drained(); check(Arrays.equals(snapshot(), new int[]{1,2,2,0}));
        System.out.println("one native owner and runtime across installed sync and task releases; continuation reentered the sync package; 32 completions plus wake and retirement on one epoll; zero identities");
    }
}
