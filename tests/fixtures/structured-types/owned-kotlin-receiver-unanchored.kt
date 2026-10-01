package org.leanbridge.owned_aggregates

import org.leanbridge.owned_aggregates.kotlin.Api as KotlinApi
import org.leanbridge.owned_aggregates.kotlin.Ticket as KotlinTicket
import org.leanbridge.owned_aggregates.kotlin.Bundle as KotlinBundle
import org.leanbridge.owned_aggregates.kotlin.Option as KotlinOption
import org.leanbridge.owned_aggregates.kotlin.Payload as KotlinPayload

internal object KotlinUnanchoredReceiverProbe {
    private fun verify(value: Boolean, message: String) = UnanchoredReceiverProbe.check(value, message)
    private fun bundle(ticket: KotlinTicket) = KotlinBundle(ticket, KotlinOption.none(), emptyArray(), emptyArray(), KotlinPayload(java.math.BigInteger.ONE, byteArrayOf()))
    private fun closeRaw(value: KotlinBundle) {
        value.primary.close()
        if (value.spare.isSome()) value.spare.value().close()
        value.peers.forEach { it.close() }; value.history.forEach { it.close() }
    }
    fun run() {
        var escaped: KotlinTicket? = null
        KotlinApi.newTicket(java.math.BigInteger.valueOf(42), "unanchored").use { seed ->
            KotlinApi.copyEchoRecordResult(bundle(seed.get())).use { record ->
                record.callbackRecord { incoming ->
                    escaped = incoming.primary
                    verify(escaped!!.serial == java.math.BigInteger.valueOf(42), "Kotlin raw callback member")
                    incoming
                }.use { response ->
                    record.makeRecord().use { closure ->
                        closure.get().invoke(false, bundle(seed.get())).use { reply ->
                            reply.primary.use { primary ->
                                verify(escaped!!.isClosed, "Kotlin callback argument expiration")
                                UnanchoredReceiverProbe.expired { escaped!!.serial }
                                verify(primary.serial == java.math.BigInteger.valueOf(42), "Kotlin nominal closure result")
                                val rawReply = closure.get().asCallback().invoke(false, bundle(seed.get()))
                                verify(rawReply.primary.serial == java.math.BigInteger.valueOf(42), "Kotlin raw callback reply")
                                closeRaw(rawReply)
                                seed.close(); record.close()
                                verify(!response.isClosed && response.get().primary.serial == java.math.BigInteger.valueOf(42), "Kotlin independent callback result")
                                verify(!closure.isClosed && !reply.isClosed && primary.serial == java.math.BigInteger.valueOf(42), "Kotlin independent closure and reply")
                                closure.get().invoke(false, response.get()).use { repeated ->
                                    verify(repeated.get().primary.serial == java.math.BigInteger.valueOf(42), "Kotlin closure environment survives")
                                }
                            }
                        }
                    }
                }
            }
        }
        escaped!!.close()
    }
}
