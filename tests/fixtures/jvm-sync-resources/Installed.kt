import org.leanbridge.desk.kotlin.Api as Desk
import org.leanbridge.counter.kotlin.Api as Counter
import org.leanbridge.desk.CheckTicketError

fun main(args: Array<String>) {
    (if (args.first() == "peer-first") Counter.issue(5) else Desk.issue(5)).use { check(Desk.count(it) == 5L) }
    val baseline = Installed.descriptors()
    Counter.issue(31).use { ticket ->
        Counter.bump(ticket).use { updated ->
            check(ticket.sameResource(updated) && Desk.count(ticket) == 32L)
            Desk.checkTicket(false, updated).use { check(it.sameResource(ticket)) }
            try { Desk.checkTicket(true, updated); error("missing typed failure") }
            catch (e: CheckTicketError) { e.payload().use { check(it.sameResource(ticket)) } }
        }
        val alias = ticket.retain()
        alias.use { check(it.sameResource(ticket)) }
        check(alias.isClosed && runCatching { Counter.bump(alias) }.exceptionOrNull() is IllegalStateException)
        check(!ticket.isClosed)
    }
    Desk.badge(9).use { check(Counter.readBadge(it) == 9L) }
    check(Observe.snapshot()[3] == 0 && Installed.descriptors() == baseline)
    Desk.issue(1).use { ticket ->
        Observe.retire()
        check(runCatching { Counter.bump(ticket) }.exceptionOrNull()?.message?.contains("unavailable") == true)
    }
    check(Observe.snapshot()[3] == 0 && Installed.descriptors() == baseline)
    println("Kotlin: use, shared mutation, typed payload, stale rejection and retired cleanup; zero leaked leases or files")
}
