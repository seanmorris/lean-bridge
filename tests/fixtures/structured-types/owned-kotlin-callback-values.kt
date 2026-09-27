package org.leanbridge.owned_aggregates

import java.math.BigInteger
import org.leanbridge.owned_aggregates.kotlin.Bundle
import org.leanbridge.owned_aggregates.kotlin.Option
import org.leanbridge.owned_aggregates.kotlin.Payload
import org.leanbridge.owned_aggregates.kotlin.Ticket
import org.leanbridge.owned_aggregates.kotlin.OwnedCallbacks
import org.leanbridge.owned_aggregates.kotlin.FactoryArgument0ClosureCallback

internal object KotlinCallProbe {
    private val bindings get() = OwnedCallProbe.bindings
    private fun verify(value: Boolean, message: String) = OwnedCallProbe.check(value, message)
    private fun drop(value: Any) = OwnedCallProbe.drop(value)
    /* METHODS */
    fun retirement() {
        newTicket(BigInteger.ONE, "retired").use { ticket ->
            val input = Bundle(ticket, Option.none(), emptyArray(), emptyArray(), Payload(BigInteger.ZERO, byteArrayOf()))
            OwnedCallProbe.status(7) { callbackRecord(input) { OwnedCallProbe.retireRuntime(); it } }
            OwnedCallProbe.status(7) { serial(ticket) }
        }
    }
    fun run() {
        newTicket(BigInteger.valueOf(42), "Kotlin\u0000🌱").use { ticket ->
            val payload = Payload(BigInteger.valueOf(-19), byteArrayOf(0, -1, 3))
            val input = Bundle(ticket, Option.some(ticket), arrayOf(ticket), arrayOf(ticket), payload)
            var escaped: Ticket? = null
            var kept: Ticket? = null
            val output = callbackRecord(input) { borrowed ->
                verify(serial(borrowed.primary) == BigInteger.valueOf(42), "Kotlin callback reads borrowed resource")
                verify(borrowed.payload == payload, "Kotlin callback preserves nominal payload")
                escaped = borrowed.primary; kept = borrowed.primary.retain()
                borrowed
            }
            verify(escaped!!.isClosed && !kept!!.isClosed, "Kotlin borrow expires")
            verify(serial(output.primary) == BigInteger.valueOf(42), "Kotlin reply independently owned")
            verify(output.primary !== ticket, "Kotlin identity wrappers distinct")
            drop(output); kept!!.close()
            val failure = IllegalStateException("Kotlin original exception")
            var count = 0
            try {
                twice(input) { count++; throw failure }
                error("Missing callback failure")
            } catch (observed: IllegalStateException) {
                verify(observed === failure, "Kotlin exception identity")
            }
            verify(count == 1, "Kotlin skips callbacks after failure")
            val callback = OwnedCallbacks.withRecovery(FactoryArgument0ClosureCallback { ticket }, ticket)
            factory(callback).use { verify(!it.isClosed, "Kotlin explicit recovery callback") }
            identityClosure(Unit.INSTANCE).use { closure ->
                retainCallback(closure.asCallback()).use { retained ->
                    val result = retained.invoke(input)
                    verify(result.payload == payload, "Kotlin returned closure and asCallback")
                    drop(result)
                }
            }
            dispatch(input).use { closure ->
                val result = closure.invoke { it }
                verify(result.payload == payload, "Kotlin higher-order closure callback")
                drop(result)
            }
            OwnedCallProbe.failures { callbackRecord(input) { it } }
            OwnedCallProbe.failures { factory(callback) }
        }
    }
}
