package __PACKAGE__.kotlin

import java.util.concurrent.Flow as JFlow
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/** One request per completed emission; cancellation closes even a parked native pull. */
internal fun <T : Any> JFlow.Publisher<T>.asLeanFlow(): Flow<T> = flow {
    val inbox = Channel<T>(1)
    val subscription = AtomicReference<JFlow.Subscription>()
    try {
        subscribe(object : JFlow.Subscriber<T> {
            override fun onSubscribe(s: JFlow.Subscription) {
                if (!subscription.compareAndSet(null, s)) s.cancel()
            }
            override fun onNext(item: T) { inbox.trySend(item) }
            override fun onError(e: Throwable) { inbox.close(e) }
            override fun onComplete() { inbox.close() }
        })
        val s = checkNotNull(subscription.get())
        while (true) {
            s.request(1)
            val next = inbox.receiveCatching()
            if (next.isClosed) { next.exceptionOrNull()?.let { throw it }; break }
            emit(next.getOrThrow())
        }
    } finally { subscription.get()?.cancel(); inbox.cancel() }
}
