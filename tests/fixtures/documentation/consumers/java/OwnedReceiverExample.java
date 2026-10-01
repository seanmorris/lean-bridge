import java.math.BigInteger;
import org.leanbridge.owned_aggregates.Api;

@SuppressWarnings("try")
public final class OwnedReceiverExample {
    public static void main(String[] args) {
        try (var owner = Api.newTicket(BigInteger.valueOf(42), "order");
             var view = owner.retainTicket();
             var kept = view.retain()) {
            System.out.println(owner.getSerial());
            owner.close();
            if (!view.isClosed()) throw new AssertionError("Borrowed view is still open");
            System.out.println(kept.getSerial());
        }
    }
}
