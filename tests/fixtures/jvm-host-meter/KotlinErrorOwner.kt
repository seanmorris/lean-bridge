import java.lang.ref.Reference
import java.lang.ref.WeakReference
import org.leanbridge.workshop.Api.Bound
import org.leanbridge.workshop.RejectBoxError
import org.leanbridge.workshop.Result
import org.leanbridge.workshop.kotlin.Api
import org.leanbridge.workshop_peer.Api.Bound as PeerBound

private data class Observation(val weak: WeakReference<Consumer.Box>, val error: RejectBoxError)

private fun capture(): Observation = Api.bindHosts(Consumer.Box::class).use { producer ->
    val meter = Consumer.Box(23)
    val weak = WeakReference(meter)
    val answer = producer.chooseBox(meter, false)
    check(answer is Result.Err && answer.error() === meter)
    try { producer.rejectBox(meter); throw AssertionError("missing EIO failure") }
    catch (e: RejectBoxError) {
        check(e.declaration() == "Workshop.rejectBox" && e.payload() === meter)
        Observation(weak, e)
    }
}

private fun useLastReference(peer: PeerBound<Consumer.Box>): WeakReference<Consumer.Box> {
    val observation = capture()
    System.gc()
    val meter = observation.error.payload(Consumer.Box::class.java)
    check(meter === observation.weak.get() && peer.read(meter) == 23L && peer.update(meter, 42) == 42L)
    Reference.reachabilityFence(observation.error)
    return observation.weak
}

fun verifyKotlinErrors(a: Bound<Consumer.Box>, b: PeerBound<Consumer.Box>) {
    ErrorOwner.requireCollected(useLastReference(b))
    val box = b.make(8)
    try { a.update(box, -1); throw AssertionError("accepted negative UInt32") }
    catch (_: IllegalArgumentException) { check(b.read(box) == 8L) }

    val original = Exception("original host failure")
    var nestedReads = 0
    box.hook = Consumer.Read { ++nestedReads; throw original }
    val indirect = a.make(5)
    indirect.hook = Consumer.Read { b.read(box) }
    try { a.read(indirect); throw AssertionError("lost host exception") }
    catch (e: Exception) { check(e === original) }
    try { a.mapped(indirect); throw AssertionError("expected declared mapped failure") }
    catch (e: org.leanbridge.workshop.MappedError) { check(e.payload() == "host read failed") }
    try { a.replaced(indirect); throw AssertionError("expected replacement IO failure") }
    catch (e: org.leanbridge.workshop.LeanIOException) { check(e.cause?.message?.contains("replacement") == true) }
    box.hook = null
    check(nestedReads == 3 && b.read(box) == 8L)

    val fatal = LinkageError("injected Kotlin peer fault")
    var caught: LinkageError? = null
    box.hook = Consumer.Read { throw fatal }
    var reads = 0
    val outer = a.make(2)
    outer.onSet = Consumer.Read {
        try { b.mapped(box); throw AssertionError("terminal callback was mapped") }
        catch (e: LinkageError) { caught = e; check(e === fatal) }
        0L
    }
    outer.onGet = Consumer.Read { ++reads; reads.toLong() }
    try { a.update(outer, 23); throw AssertionError("outer call survived") }
    catch (_: IllegalStateException) { check(caught === fatal && reads == 0) }
    try { b.read(box); throw AssertionError("peer did not retire") }
    catch (_: IllegalStateException) { check(reads == 0) }
}
