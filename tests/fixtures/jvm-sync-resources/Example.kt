import org.leanbridge.desk.kotlin.Api as Desk
import org.leanbridge.counter.kotlin.Api as Counter

fun main() {
    Desk.issue(41).use { ticket ->
        Counter.bump(ticket).use { updated -> println(Desk.count(updated)) }
    }
}
