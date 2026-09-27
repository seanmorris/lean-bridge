package org.leanbridge.owned_aggregates

import java.math.BigInteger
import org.leanbridge.owned_aggregates.kotlin.Bundle
import org.leanbridge.owned_aggregates.kotlin.Option
import org.leanbridge.owned_aggregates.kotlin.Payload
import org.leanbridge.owned_aggregates.kotlin.CallbackRecordArgument1Closure

internal object KotlinCallProbe {
    private val bindings get() = OwnedCallProbe.bindings
    private var called = 0
    private fun <T> seen(value: T): T { called++; return value }
    private fun verify(value: Boolean, message: String) = OwnedCallProbe.check(value, message)
    /* METHODS */
    fun run() {
        viaUnit({ called++ }, Unit.INSTANCE); verify(called == 1, "Kotlin Unit callback")
        verify(viaBool({ seen(!it) }, false), "Kotlin Bool callback")
        verify(viaChar({ seen(it) }, 0x1f331) == 0x1f331, "Kotlin Char callback")
        val huge = BigInteger.ONE.shiftLeft(257).add(BigInteger.ONE)
        verify(viaNat({ seen(it + BigInteger.ONE) }, huge) == huge + BigInteger.ONE, "Kotlin Nat callback")
        verify(viaInt({ seen(it - BigInteger.ONE) }, -huge) == -huge - BigInteger.ONE, "Kotlin Int callback")
        verify(viaU8({ seen(it) }, 255) == 255, "Kotlin UInt8 callback")
        verify(viaU16({ seen(it) }, 65535) == 65535, "Kotlin UInt16 callback")
        verify(viaU32({ seen(it) }, 0xffff_ffffL) == 0xffff_ffffL, "Kotlin UInt32 callback")
        val word = BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)
        verify(viaU64({ seen(it) }, word) == word, "Kotlin UInt64 callback")
        verify(viaI8({ seen(it) }, Byte.MIN_VALUE) == Byte.MIN_VALUE, "Kotlin Int8 callback")
        verify(viaI16({ seen(it) }, Short.MIN_VALUE) == Short.MIN_VALUE, "Kotlin Int16 callback")
        verify(viaI32({ seen(it) }, Int.MIN_VALUE) == Int.MIN_VALUE, "Kotlin Int32 callback")
        verify(viaI64({ seen(it) }, Long.MIN_VALUE) == Long.MIN_VALUE, "Kotlin Int64 callback")
        verify(viaUsize({ seen(it) }, word) == word, "Kotlin USize callback")
        verify(viaIsize({ seen(it) }, Long.MIN_VALUE) == Long.MIN_VALUE, "Kotlin ISize callback")
        verify(viaF32({ seen(it) }, Float.fromBits(0x7fc12345)).toRawBits() == 0x7fc12345, "Kotlin Float32 NaN bits")
        verify(viaF64({ seen(it) }, Double.fromBits(0x7ff8123456789abcL)).toRawBits() == 0x7ff8123456789abcL, "Kotlin Float64 NaN bits")
        verify(viaString({ seen(it) }, "A\u0000🌱") == "A\u0000🌱", "Kotlin String callback")
        val bytes = byteArrayOf(0, -1, 3); val copied = viaBytes({ seen(it) }, bytes)
        verify(bytes.contentEquals(copied) && bytes !== copied, "Kotlin ByteArray callback")
        verify(called == 19, "Kotlin all nineteen scalar callbacks executed")
        OwnedCallProbe.failures { viaNat({ it + BigInteger.ONE }, huge) }
        OwnedCallProbe.failures { viaBytes({ it }, bytes) }
        newTicket(BigInteger.valueOf(17), "higher").use { ticket ->
            val input = Bundle(ticket, Option.none(), emptyArray(), emptyArray(), Payload(BigInteger.ZERO, byteArrayOf()))
            var escaped: CallbackRecordArgument1Closure? = null
            var kept: CallbackRecordArgument1Closure? = null
            val result = withFunction(input) { closure, value ->
                escaped = closure; kept = closure.retain()
                val nested = closure.invoke(value)
                verify(serial(nested.primary) == BigInteger.valueOf(17), "Kotlin borrowed native closure invocation")
                OwnedCallProbe.drop(nested); value
            }
            verify(escaped!!.isClosed && !kept!!.isClosed, "Kotlin higher-order borrow expires")
            OwnedCallProbe.drop(result)
            val retained = kept!!.invoke(input)
            verify(serial(retained.primary) == BigInteger.valueOf(17), "Kotlin retained native closure")
            OwnedCallProbe.drop(retained); kept!!.close()
        }
    }
}
