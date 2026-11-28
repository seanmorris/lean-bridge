import java.lang.ref.Reference
import java.lang.ref.WeakReference
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.*
import org.leanbridge.budget.CallbackAlreadyInvokedException
import org.leanbridge.budget.CheckedError
import org.leanbridge.budget.LeanIOException
import org.leanbridge.budget.RetainedCallback
import org.leanbridge.budget.TaskIOException
import org.leanbridge.budget.kotlin.Api

private fun tracked(calls: AtomicInteger): Pair<WeakReference<Any>, RetainedCallback<java.util.function.Function<Long,Long>>> {
    val captured = Any()
    return WeakReference(captured) to RetainedCallback.function<Long,Long> { n ->
        check(Thread.currentThread().isVirtual); calls.incrementAndGet(); Reference.reachabilityFence(captured); n+1L
    }
}
private suspend fun denied(name: String, call: suspend () -> Long): CallbackAlreadyInvokedException {
    try { call(); error("expected admission refusal for "+name) }
    catch (e: CallbackAlreadyInvokedException) {
        check(e.declaration()==name && e.message=="callback-already-invoked"); return e
    }
}
fun main() = runBlocking {
    val calls=AtomicInteger(); val many=AtomicInteger()
    val (weak,owner)=tracked(calls); val f: (Long)->Long = owner.callback()::apply
    denied("Budget.probe") { Api.probe(1, f) { n -> many.incrementAndGet(); n+1 } }
    check(calls.get()==1 && many.get()==2 && Api.pair(40,f,f)==42L)
    val a=async(start=CoroutineStart.UNDISPATCHED) { Api.single(3,f) }
    val b=async(start=CoroutineStart.UNDISPATCHED) { Api.single(41,f) }
    check(b.await()==42L && a.await()==4L && calls.get()==5)
    val failed=AtomicInteger(); val marker=IllegalArgumentException("callback-already-invoked")
    val bad: (Long)->Long = { failed.incrementAndGet(); throw marker }
    denied("Budget.retry") { Api.retry(1,bad) }; check(failed.get()==1)
    check(runCatching { Api.single(1,bad) }.exceptionOrNull() === marker)
    val prior=denied("Racing.duringStart") { Api.duringStart(1,f) }
    check(runCatching { Api.single(1) { throw prior } }.exceptionOrNull() === prior)
    val initial=runCatching { Api.start(0,f) }.exceptionOrNull()
    check(initial is LeanIOException && initial.declaration()=="FactoryFault.start" && initial.message!!.contains("callback-already-invoked"))
    val terminal=runCatching { Api.replace(1,f) }.exceptionOrNull()
    check(terminal is TaskIOException && terminal.declaration()=="Racing.replace" && terminal.message!!.contains("callback-already-invoked"))
    val before=calls.get(); val typed=runCatching { Api.checked(0,f) }.exceptionOrNull()
    check(typed is CheckedError && typed.payload()==73L && typed.declaration()=="TypedBudget.checked" && calls.get()==before)
    denied("TypedBudget.checked") { Api.checked(1,f) }; check(calls.get()==before+1)
    repeat(16) { n ->
        val at=calls.get(); denied("Racing.race") { Api.race(n.toLong(),f) }; check(calls.get()==at+1)
    }
    check(!weak.refersTo(null)); owner.close(); check(owner.isClosed)
    Observe.until { System.gc(); weak.refersTo(null) }; Observe.drained()
    check(Observe.snapshot()[0]==1 && Observe.snapshot()[3]==0)
    println("Kotlin: 16 worker races; original, factory, terminal and typed failures distinct; capture released; zero leases")
}
