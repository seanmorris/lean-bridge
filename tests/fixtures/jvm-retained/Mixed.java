import java.math.BigInteger;
import java.util.Arrays;
import org.leanbridge.feedback.Api;

class Mixed extends Observe {
    public static void main(String[] args) {
        switch (args[0]) {
            case "sync-first" -> check(org.leanbridge.journal.Api.count() == 0);
            case "task-first" -> check(org.leanbridge.timers.Api.immediate(BigInteger.ZERO).join().equals(BigInteger.ONE));
            case "callback-first" -> check(Api.once(1, n -> n).join() == 1);
            default -> throw new AssertionError();
        }
        check(Api.once(40, n -> {
            check(Thread.currentThread().isVirtual());
            long fromSync = org.leanbridge.journal.Api.bump(1);
            return org.leanbridge.timers.Api.immediate(BigInteger.valueOf(n + fromSync)).join().longValueExact();
        }).join() == 42);
        check(org.leanbridge.journal.Api.count() == 1);
        drained(); check(Arrays.equals(snapshot(), new int[]{1,3,3,0}));
        System.out.println("retained callback reentered original synchronous and task releases: 1 runtime, 3 components, 0 live identities");
    }
}
