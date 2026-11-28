import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import org.leanbridge.desk.kotlin.Api as Desk
import org.leanbridge.depot.kotlin.Api as Depot

fun main() = runBlocking {
    Desk.issue(0).close(); val base = Sole.files()
    for (cancel in listOf(false, true)) {
        Depot.reset()
        val input = Desk.issue(30)
        val task = async(start = CoroutineStart.UNDISPATCHED) { Depot.pending(input, false) }
        input.close()
        Observe.until { Depot.state() == 1L }
        check(input.isClosed); Sole.owners("running worker", 2, base + 1)
        if (cancel) { task.cancelAndJoin(); check(task.isCancelled); Sole.owners("cancelled coroutine, still-running worker", 1, base + 1) }
        Depot.release()
        if (!cancel) task.await().use { check(Desk.count(it) == 31L) }
        Observe.until { Depot.state() == 3L }; Sole.drained(base)
    }
    val input = Desk.issue(20); val accepted = CompletableDeferred<Unit>(); val proceed = CompletableDeferred<Unit>()
    val before = Depot.closes()
    val collection = launch(start = CoroutineStart.UNDISPATCHED) {
        Depot.tickets(input, false).collect { item -> item.close(); accepted.complete(Unit); proceed.await() }
    }
    withTimeout(20_000) { accepted.await() }; input.close()
    Sole.owners("open cursor", 1, base + 1)
    proceed.complete(Unit); collection.join(); Sole.drained(base); check(Depot.closes() == before + 1)
    println("Kotlin: last host lease closed; worker, late cancelled worker and collected cursor retained the file until native cleanup; baseline restored")
}
