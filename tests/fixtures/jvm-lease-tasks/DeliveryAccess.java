import java.util.concurrent.*;
import kotlin.coroutines.Continuation;
import kotlinx.coroutines.flow.Flow;

/** Test-only: put a scheduling gate in front of the *installed* coroutine adapters. */
final class DeliveryAccess {
    static <T> Object await(CompletableFuture<T> f, Continuation<? super T> c) {
        return org.leanbridge.depot.LeaseDeliveryKt.awaitLeanLease(f, c);
    }
    static <T> Flow<T> flow(java.util.concurrent.Flow.Publisher<T> p) {
        return org.leanbridge.depot.LeaseDeliveryKt.asLeanLeaseFlow(p);
    }
}
