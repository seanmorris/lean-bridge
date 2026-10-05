import java.math.BigInteger;
import org.leanbridge.owned_aggregates.Api;

public final class OwnedTransferExample {
    public static void main(String[] args) {
        try (var original = Api.newTicket(BigInteger.valueOf(42), "task");
             var kept = original.retain();
             var received = Api.retainTicket(original)) {
            if (!original.isClosed() || Api.serial(received).intValueExact() != 42
                || Api.serial(kept).intValueExact() != 42)
                throw new IllegalStateException("Transfer lost a retained reference.");
            System.out.println("transferred");
        }
    }
}
