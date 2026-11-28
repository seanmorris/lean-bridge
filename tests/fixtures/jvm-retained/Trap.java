import java.util.concurrent.*;
import org.leanbridge.feedback.Api;

/** Cancelling the task only wins settlement. It cannot suppress a later
 * fatal JVM callback error and leave independently loaded components reusable. */
class Trap extends Observe {
    public static void main(String[] args) {
        check(org.leanbridge.relay.Api.direct(0).join() == 1);
        check(Api.once(0, n -> n).join() == 0); drained(); long baseline = descriptors();
        var active = new CompletableFuture<Void>(); var release = new CompletableFuture<Void>();
        var f = Api.once(7, n -> { active.complete(null); release.join(); throw new LinkageError("injected after cancellation"); });
        active.join(); check(f.cancel(false)); drained(); check(org.leanbridge.relay.Api.direct(1).join() == 2);
        release.complete(null);
        until(() -> {
            try { org.leanbridge.relay.Api.direct(2).join(); return false; }
            catch (CompletionException e) { return e.getCause() instanceof IllegalStateException; }
        });
        check(f.isCancelled()); drained(); until(() -> descriptors() == baseline);
        System.out.println("a fatal callback after cancellation retires both components without resettling the cancelled future");
    }
}
