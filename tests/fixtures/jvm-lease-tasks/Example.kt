import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.leanbridge.desk.kotlin.Api as Desk
import org.leanbridge.depot.kotlin.Api as Depot

fun main() = runBlocking {
    Desk.issue(42).use { ticket ->
        Depot.tickets(ticket, false).first().use { println(Desk.count(it)) }
    }
}
