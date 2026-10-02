import java.math.BigInteger
import org.leanbridge.owned_aggregates.kotlin.*

fun main() {
    Api.newTicket(BigInteger.valueOf(42), "callback-owner").use { seed ->
        val input = Bundle(seed.get(), Option.none(), emptyArray(), emptyArray(),
            Payload(BigInteger.ZERO, byteArrayOf()))
        Api.echoRecord(input).use { original ->
            Api.makeRecordCallback(input).use { closureOwner ->
                closureOwner.get().invoke(original).use { borrowed ->
                    borrowed.retain().use { independent ->
                        original.close()
                        check(borrowed.isClosed && !independent.isClosed)
                        check(Api.serial(independent.get().primary).intValueExact() == 42)
                        try {
                            borrowed.get()
                            error("Expired callback result was accepted")
                        } catch (failure: LeanBridgeException) {
                            check(failure.status() == 4)
                        }
                    }
                }
            }
        }
    }
    println("callback-result-retained")
}
