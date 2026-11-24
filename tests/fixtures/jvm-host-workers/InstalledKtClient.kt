import org.leanbridge.workshop.kotlin.Api
import org.leanbridge.workshop_peer.kotlin.Api as Peer
import org.leanbridge.workshop.Result
import org.leanbridge.workshop.RefuseError
import org.leanbridge.workshop.BoxesStepError
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

fun main(args: Array<String>) = runBlocking {
    if(args.single()=="peer-first") check(Peer.scalar(1)==38L) else check(Api.scalar(1)==2L)
    val early = if (args.single()=="peer-first") Peer.bindHosts(Installed.Box::class) else null
    Api.bindHosts(Installed.Box::class).use { a ->
        (early ?: Peer.bindHosts(Installed.Box::class)).use { b ->
            check(Api.scalar(3)==4L && Peer.scalar(3)==40L)
            val x: Installed.Box=a.make(21)
            check(b.echo(x)===x && a.relay(x){v->b.identity(v)}===x)
            val outcome=a.outcome(x)
            check(outcome is Result.Err<*,*> && outcome.error()===x)
            try { a.refuse(x); error("missing EIO") }
            catch(e:RefuseError){check(e.payload(Installed.Box::class.java)===x)}
            val cold: Flow<Installed.Box> = a.boxes(x,false)
            check(cold.single()===x && cold.first()===x)
            try { a.boxes(x,true).toList(); error("missing step error") }
            catch(e:BoxesStepError){check(e.payload(Installed.Box::class.java)===x)}
            val release=CompletableFuture<Installed.Box>(); val entered=CountDownLatch(1)
            try {
                val job=launch(Dispatchers.Default) { a.relay(x){ entered.countDown(); release.join() } }
                check(entered.await(8,TimeUnit.SECONDS)); job.cancelAndJoin()
                check(job.isCancelled && b.echo(x)===x)
            } finally { release.complete(x) }
            a.close()
            try { cold.first(); error("stale publisher") } catch(e:IllegalStateException){check(e.message?.contains("Closed JVM host binding")==true)}
            check(b.echo(x)===x)
        }
    }
    println("Kotlin: installed suspend, Flow and cancellation across bindings")
}
