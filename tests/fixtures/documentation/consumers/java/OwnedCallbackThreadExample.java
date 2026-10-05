import java.lang.ref.Reference;
import java.math.BigInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.leanbridge.owned_aggregates.*;

public final class OwnedCallbackThreadExample {
    public static void main(String[] args) throws InterruptedException {
        var held = new AtomicReference<Value<?>[]>();
        var failure = new AtomicReference<Throwable>();
        var worker = new Thread(() -> {
            try {
                var seed = Api.newTicket(BigInteger.valueOf(42), "callback-thread");
                var input = new Bundle(seed.get(), Option.none(), new Ticket[0], new Ticket[0],
                    new Payload(BigInteger.ZERO, new byte[0]));
                var original = Api.echoRecord(input);
                var closureOwner = Api.makeRecordCallback(input);
                var borrowed = closureOwner.get().invoke(original);
                var descendant = closureOwner.get().invoke(borrowed);
                var independent = descendant.retain();
                held.set(new Value<?>[] { seed, original, closureOwner, borrowed, descendant, independent });
            } catch (Throwable error) { failure.set(error); }
        });
        worker.start(); worker.join(10000);
        if (worker.isAlive()) throw new AssertionError("Worker did not exit");
        if (failure.get() != null) throw new AssertionError(failure.get());
        var owners = held.get();
        long deadline = System.nanoTime() + 5_000_000_000L;
        while (java.util.Arrays.stream(owners).anyMatch(owner -> !owner.isClosed())
            && System.nanoTime() < deadline) Thread.sleep(5);
        for (var owner : owners) {
            if (!owner.isClosed()) throw new AssertionError("Creator-thread owner remains open");
            try {
                owner.get();
                throw new AssertionError("Dead-thread owner was accepted");
            } catch (LeanBridgeException error) {
                if (error.status() != 4) throw error;
            }
        }
        Reference.reachabilityFence(owners); Reference.reachabilityFence(worker);
        System.out.println("callback-thread-owners-closed");
    }
}
