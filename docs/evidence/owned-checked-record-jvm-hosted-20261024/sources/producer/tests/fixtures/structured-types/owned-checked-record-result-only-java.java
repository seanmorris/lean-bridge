import java.math.BigInteger;
import static org.leanbridge.owned_checked_records.Api.*;

final class Consumer {
    public static void main(String[] args) {
        int checks = 0;
        try (var ticket = newTicket(BigInteger.valueOf(17), "result-only")) {
            if (!serial(ticket).equals(BigInteger.valueOf(17))) throw new AssertionError(); checks++;
            var claim = claimFor(ticket);
            if (!claim.isSome() || !claim.value().quota().equals(BigInteger.ZERO)) throw new AssertionError(); checks++;
            if (!serial(claim.value().holder()).equals(BigInteger.valueOf(17))) throw new AssertionError(); checks++;
            claim.value().holder().close(); checks++;
        }
        System.out.println("owned-checked-record-result-only-java:" + checks);
    }
}
