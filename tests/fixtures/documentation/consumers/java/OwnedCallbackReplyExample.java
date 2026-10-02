import java.math.BigInteger;
import org.leanbridge.owned_aggregates.*;

@SuppressWarnings("try")
public final class OwnedCallbackReplyExample {
    public static void main(String[] args) {
        try (var seed = Api.newTicket(BigInteger.valueOf(42), "callback-reply")) {
            var input = new Bundle(seed.get(), Option.none(), new Ticket[0], new Ticket[0],
                new Payload(BigInteger.ZERO, new byte[0]));
            try (var replyOwner = Api.echoRecord(input);
                 var raw = Api.callbackRecord(input,
                     (ApplyTwiceArgument1ClosureCallback)value -> CallbackResult.value(value));
                 var whole = Api.callbackRecord(input,
                     (ApplyTwiceArgument1ClosureCallback)value -> CallbackResult.owner(replyOwner))) {
                replyOwner.close();
                if (Api.serial(raw.get().primary()).intValueExact() != 42
                    || Api.serial(whole.get().primary()).intValueExact() != 42)
                    throw new AssertionError("Callback reply was not copied before expiry");
            }
        }
        System.out.println("callback-replies-copied");
    }
}
