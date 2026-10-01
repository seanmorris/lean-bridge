import java.math.BigInteger
import org.leanbridge.owned_aggregates.kotlin.Api

fun main() {
    Api.newTicket(BigInteger.valueOf(42), "order").use { owner ->
        owner.retainTicket().use { view ->
            view.retain().use { kept ->
                println(owner.serial)
                owner.close()
                check(view.isClosed)
                println(kept.serial)
            }
        }
    }
}
