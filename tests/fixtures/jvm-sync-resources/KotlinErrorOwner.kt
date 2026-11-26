import org.leanbridge.desk.kotlin.Api as Desk
import org.leanbridge.counter.kotlin.Api as Counter
import org.leanbridge.desk.CheckTicketError

fun main(args: Array<String>) {
    if (args.single() == "peer-first") Counter.issue(0).close()
    Desk.issue(1).close()
    Counter.issue(1).close()
    val base = ErrorOwner.files()
    ErrorOwner.owners(0, base)
    val original = Desk.issue(41)
    ErrorOwner.owners(1, base + 1)
    val failure = try {
        Desk.checkTicket(true, original)
        error("expected a declared failure")
    } catch (e: CheckTicketError) { e }
    check(failure.declaration() == "Desk.checkTicket")
    failure.payload().use { payload ->
        check(payload.sameResource(original))
        original.close()
        check(original.isClosed && !payload.isClosed)
        val stale = runCatching { Desk.count(original) }.exceptionOrNull()
        check(stale is IllegalStateException && stale.message.orEmpty().contains("closed"))
        ErrorOwner.owners(1, base + 1)
        Counter.bump(payload).use { check(it.sameResource(payload)) }
        check(Desk.count(payload) == 42L)
    }
    check(failure.payload().isClosed)
    ErrorOwner.owners(0, base)
    Desk.issue(8).use { check(Desk.count(it) == 8L) }
    ErrorOwner.owners(0, base)
    println("Kotlin: only the declared error holds the live ticket, peer read 42, zero owners and descriptor delta")
}
