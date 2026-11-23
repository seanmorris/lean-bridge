package __PACKAGE__

import java.util.concurrent.CompletableFuture
import java.util.concurrent.CompletionException
import java.util.concurrent.Flow as JFlow
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.FlowCollector
import kotlinx.coroutines.suspendCancellableCoroutine

// Carry the typed failure as a value until the coroutine actually receives it:
// the failure can own a lease just as the successful result can.
private class LeaseSignal<T : Any>(val value: T?, val failure: Throwable?) {
    fun discard() { Resources.discardValue(value); Resources.discardError(failure) }
    fun take(): T {
        if (failure != null) throw if (failure is CompletionException) failure.cause ?: failure else failure
        return checkNotNull(value)
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
internal suspend fun <T : Any> CompletableFuture<T>.awaitLeanLease(): T {
    val signal = suspendCancellableCoroutine<LeaseSignal<T>> { c ->
        c.invokeOnCancellation { cancel(false) }
        whenComplete { v, e ->
            val item = LeaseSignal(v, e)
            c.resume(item) { item.discard() }
        }
    }
    return signal.take()
}

// One request at a time. At most one item and a terminal signal can be
// pending. No lease is retained by an uncollected publisher.
internal fun <T : Any> JFlow.Publisher<T>.asLeanLeaseFlow(): Flow<T> = object : Flow<T> {
    override suspend fun collect(collector: FlowCollector<T>) {
        val inbox = Channel<LeaseSignal<T>>(Channel.UNLIMITED, onUndeliveredElement = { it.discard() })
        val subscription = AtomicReference<JFlow.Subscription>()
        fun send(signal: LeaseSignal<T>) {
            if (inbox.trySend(signal).isFailure) signal.discard()
        }
        try {
            subscribe(object : JFlow.Subscriber<T> {
                override fun onSubscribe(s: JFlow.Subscription) {
                    if (!subscription.compareAndSet(null, s)) s.cancel()
                }
                override fun onNext(item: T) { send(LeaseSignal(item, null)) }
                override fun onError(e: Throwable) { send(LeaseSignal(null, e)); inbox.close() }
                override fun onComplete() { inbox.close() }
            })
            val s = checkNotNull(subscription.get())
            while (true) {
                s.request(1)
                val item = inbox.receiveCatching().getOrNull() ?: break
                // Ownership changes at collector entry. A collector may keep
                // the value and immediately stop collection (e.g. first()).
                collector.emit(item.take())
            }
        } finally {
            try { subscription.get()?.cancel() } finally { inbox.cancel() }
        }
    }
}
