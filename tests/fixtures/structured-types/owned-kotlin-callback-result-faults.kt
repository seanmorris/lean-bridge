package org.leanbridge.owned_aggregates

import java.math.BigInteger
import java.util.function.BooleanSupplier
import java.util.function.Supplier
import java.util.function.ToIntFunction
import org.leanbridge.owned_aggregates.kotlin.Api as KotlinApi
import org.leanbridge.owned_aggregates.kotlin.OwnedCallbacks as KotlinOwnedCallbacks
import org.leanbridge.owned_aggregates.kotlin.ApplyTwiceArgument1ClosureCallback
import org.leanbridge.owned_aggregates.kotlin.Bundle
import org.leanbridge.owned_aggregates.kotlin.Option
import org.leanbridge.owned_aggregates.kotlin.Payload
import org.leanbridge.owned_aggregates.kotlin.Ticket

internal object KotlinCallbackResultFaultProbe {
    private fun bundle(ticket: Ticket) = Bundle(ticket, Option.some(ticket), arrayOf(ticket), emptyArray(),
        Payload(BigInteger.valueOf(-17), byteArrayOf(0, -1)))

    private fun fixture(kind: Int): OwnedCallbackResultFaultProbe.Fixture<Bundle> =
        KotlinApi.newTicket(BigInteger.valueOf(42), "Kotlin fault-input").use { inputSeed ->
            KotlinApi.newTicket(BigInteger.valueOf(53), "Kotlin fault-reply").use { replySeed ->
                val original = KotlinApi.echoRecord(bundle(inputSeed.get()))
                val alias = original.share()
                val descendant = original.borrowRecord()
                val independent = original.retain()
                val reply = KotlinApi.echoRecord(bundle(replySeed.get()))
                val closure = KotlinApi.makeRecordCallback(reply.get())
                var entered = false
                val callback = KotlinOwnedCallbacks.withRecovery(ApplyTwiceArgument1ClosureCallback { value ->
                    entered = true
                    if (kind == 1) CallbackResult.value(value) else CallbackResult.owner(reply)
                }, CallbackResult.owner(reply))
                val call = Supplier<Value<Bundle>> {
                    when (kind) {
                        0 -> closure.get().invoke(original)
                        3 -> original.moveRecord(callback)
                        else -> KotlinApi.callbackRecord(original.get(), callback)
                    }
                }
                OwnedCallbackResultFaultProbe.Fixture(original, alias, descendant, independent, reply, closure, call,
                    ToIntFunction { value -> KotlinApi.serial(value.primary).intValueExact() },
                    BooleanSupplier { entered }, if (kind == 1) 42 else 53)
            }
        }

    fun run(): List<String> = (0 until 4).map { kind ->
        OwnedCallbackResultFaultProbe.sweep("kotlin", kind, Supplier { fixture(kind) })
    }
}
