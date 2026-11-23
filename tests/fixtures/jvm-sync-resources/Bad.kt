import org.leanbridge.counter.kotlin.Api as Counter
import org.leanbridge.desk.kotlin.Api as Desk
import org.leanbridge.other_desk.kotlin.Api as Other
fun incompatible() {
    Counter.bump(Desk.badge(1))
    Counter.bump(Other.issue(1))
}
