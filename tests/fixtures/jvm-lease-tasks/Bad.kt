import org.leanbridge.depot.kotlin.Api as Depot
import org.leanbridge.desk.kotlin.Api as Desk
import org.leanbridge.other_desk.kotlin.Api as Other
suspend fun bad() {
    Depot.pending(Desk.badge(1), true)
    Depot.tickets(Other.issue(1), false)
}
