import java.math.BigInteger
import org.leanbridge.owned_aggregates.kotlin.Api

fun main() {
    Api.newTicket(BigInteger.valueOf(42), "task").use { original ->
        original.retain().use { kept ->
            Api.retainTicket(original).use { received ->
                check(original.isClosed)
                check(Api.serial(received).intValueExact() == 42)
                check(Api.serial(kept).intValueExact() == 42)
                println("transferred")
            }
        }
    }
}
