import java.math.BigInteger;
import org.leanbridge.owned_aggregates.*;

@SuppressWarnings("try")
public final class OwnedCallbackResultExample {
    public static void main(String[] args) {
        try (var seed = Api.newTicket(BigInteger.valueOf(42), "callback-owner")) {
            var input = new Bundle(seed.get(), Option.none(), new Ticket[0], new Ticket[0],
                new Payload(BigInteger.ZERO, new byte[0]));
            try (var original = Api.echoRecord(input);
                 var closureOwner = Api.makeRecordCallback(input);
                 var borrowed = closureOwner.get().invoke(original);
                 var independent = borrowed.retain()) {
                original.close();
                if (!borrowed.isClosed() || independent.isClosed()) throw new AssertionError("Owner lifetime");
                if (Api.serial(independent.get().primary()).intValueExact() != 42)
                    throw new AssertionError("Retained callback result");
                try {
                    borrowed.get();
                    throw new AssertionError("Expired callback result was accepted");
                } catch (LeanBridgeException error) {
                    if (error.status() != 4) throw error;
                }
            }
        }
        System.out.println("callback-result-retained");
    }
}
