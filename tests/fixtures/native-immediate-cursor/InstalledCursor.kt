import org.leanbridge.dials.kotlin.Api
import org.leanbridge.dials.kotlin.LeanSequence
import org.leanbridge.dials.CheckedError
import org.leanbridge.dials.CheckedStepError
import org.leanbridge.dials.LeanIOException
import org.leanbridge.dials.TicketsStepError

private var atExit: LeanSequence<Long>? = null
fun main(args: Array<String>) {
    check(Api.counts() == 0L)
    if (args.single() == "shutdown") {
        atExit = Api.sequence(3)
        check(atExit!!.first() == 0L && Api.counts() == 10100L)
        return
    }
    Api.issue(37).use { original ->
        Api.tickets(original).use { seq ->
            check(seq.iterator().hasNext())
            seq.first().use { item ->
                check(original.sameResource(item)); original.close()
                try { seq.iterator().next(); error("missing owned step error") } catch (e: TicketsStepError) {
                    check(e.declaration() == "TicketPulls.nextTicket")
                    e.payload().use { payload ->
                        check(item.sameResource(payload)); seq.close(); item.close()
                        check(Api.readTicket(payload) == 37L)
                    }
                }
            }
        }
    }
    check(Api.closedTickets() == 1L)
    Api.sequence(3).use { seq ->
        check(seq.iterator().hasNext() && seq.iterator().hasNext())
        check(seq.first() == 0L && Api.counts() == 10100L)
    }
    check(Api.counts() == 10101L)
    check(Api.sequence(2).use { it.toList() } == listOf(0L, 1L) && Api.counts() == 20402L)
    try { Api.checked(0); error("missing factory error") } catch (e: CheckedError) {
        check(e.declaration() == "Dials.checked" && e.payload() == "factory")
    }
    Api.checked(1).use { seq ->
        val it = seq.iterator()
        check(it.next() == 0L)
        try { it.next(); error("missing step error") } catch (e: CheckedStepError) {
            check(e.declaration() == "Dials.checkedNext" && e.payload() == "step")
        }
        check(!it.hasNext())
    }
    check(Api.counts() == 30603L)
    Api.units(1).use { seq ->
        val it: Iterator<Unit> = seq.iterator()
        check(it.next() == Unit)
        try { it.next(); error("missing IO error") } catch (e: LeanIOException) {
            check(e.declaration() == "Dials.nextUnit" && e.cause?.message == "unit step")
        }
    }
    check(Api.units(4).use { it.toList() } == listOf(Unit, Unit))
    check(Api.counts() == 51105L)
    val fault = IllegalArgumentException("user block")
    try { Api.sequence(3).use { it.forEach { throw fault } }; error("missing exception") }
    catch (e: IllegalArgumentException) { check(e === fault) }
    check(Api.counts() == 61206L)
}
