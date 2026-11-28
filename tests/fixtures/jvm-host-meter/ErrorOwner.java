import java.lang.ref.Reference;
import java.lang.ref.WeakReference;
import org.leanbridge.workshop.Api;
import org.leanbridge.workshop.MixedFaultError;
import org.leanbridge.workshop.Result;

final class ErrorOwner {
    private record Observation(WeakReference<Consumer.Box> weak, MixedFaultError error) {}

    private static Observation capture() throws Exception {
        try (var producer = Api.bindHosts(Consumer.Box.class)) {
            var meter = new Consumer.Box(23);
            var weak = new WeakReference<>(meter);
            try { producer.mixedFault(meter, 1); throw new AssertionError("missing EIO failure"); }
            catch (MixedFaultError error) {
                Consumer.check(error.declaration().equals("Workshop.mixedFault"));
                return new Observation(weak, error);
            }
        }
    }

    private static WeakReference<Consumer.Box> useLastReference(org.leanbridge.workshop_peer.Api.Bound<Consumer.Box> peer) throws Exception {
        var observation = capture();
        System.gc();
        var inner = ((Result.Ok<Result<Long,Consumer.Box>,String>)observation.error().payload(Consumer.Box.class)).value();
        var payload = ((Result.Err<Long,Consumer.Box>)inner).error();
        Consumer.check(payload == observation.weak().get() && peer.read(payload) == 23 && peer.update(payload, 42) == 42);
        Reference.reachabilityFence(observation.error());
        return observation.weak();
    }

    static void requireCollected(WeakReference<?> weak) throws InterruptedException {
        for (int i=0; i<60 && !weak.refersTo(null); i++) { System.gc(); Thread.sleep(25); }
        Consumer.check(weak.refersTo(null));
    }

    static void verify(org.leanbridge.workshop_peer.Api.Bound<Consumer.Box> peer) throws Exception {
        requireCollected(useLastReference(peer));
        Consumer.check(peer.read(peer.make(7)) == 7);
    }
}
