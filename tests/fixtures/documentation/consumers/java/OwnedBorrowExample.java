import java.math.BigInteger;
import org.leanbridge.owned_aggregates.Api;

@SuppressWarnings("try")
public final class OwnedBorrowExample {
    public static void main(String[] args) {
        try (var owner = Api.newTicket(BigInteger.valueOf(42), "order");
             var view = Api.retainTicket(owner);
             var kept = view.retain()) {
            owner.close();
            if (!view.isClosed()) throw new AssertionError("Borrowed view is still open");
            System.out.println(Api.serial(kept.get()));
        }
    }
}
