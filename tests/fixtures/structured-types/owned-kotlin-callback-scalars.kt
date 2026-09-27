package org.leanbridge.owned_aggregates

import java.math.BigInteger

internal object KotlinCallProbe {
    private val bindings get() = OwnedCallProbe.bindings
    private fun verify(value: Boolean, message: String) = OwnedCallProbe.check(value, message)
    /* METHODS */
    fun run() {
        newTicket(BigInteger.valueOf(42), "A\u0000🌱").use { ticket ->
            val input = makePacket(ticket)
            verify(inspect(input), "Kotlin receives all nineteen scalar types")
            val output = echo(input)
            verify(inspect(output), "Kotlin scalar packet round trip")
            verify(input.scalars == output.scalars, "Kotlin scalar values preserved")
            verify(input.scalars.bytes !== output.scalars.bytes, "Kotlin bytes copied")
            verify(input.ticket !== output.ticket, "Kotlin resource wrapper independently owned")
            verify(input.optional == output.optional, "Kotlin nested options preserved")
            verify(output.scalars.text == "A\u0000🌱", "Kotlin Unicode and embedded null")
            OwnedCallProbe.drop(output)
            OwnedCallProbe.failures { echo(input) }
            OwnedCallProbe.drop(input)
        }
    }
}
