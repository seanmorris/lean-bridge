import java.math.BigInteger
import org.leanbridge.owned_aggregates.kotlin.Api

fun main() {
    Api.newTicket(BigInteger.valueOf(42), "order").use { owner ->
        Api.retainTicket(owner).use { view ->
            view.retain().use { kept ->
                owner.close()
                check(view.isClosed)
                println(Api.serial(kept.get()))
            }
        }
    }
}
