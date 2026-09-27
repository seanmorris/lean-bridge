package consumer

import java.math.BigInteger
import java.lang.reflect.Modifier
import org.leanbridge.owned_aggregates.kotlin.*
import org.leanbridge.owned_aggregates.kotlin.Unit

private var checks = 0
private fun verify(value: Boolean) { check(value); checks++ }
fun main() {
    val huge = BigInteger.ONE.shiftLeft(200)
    val word = BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)
    fun values() = Scalars(Unit.INSTANCE, true, 0x1f331, huge, huge.negate(),
        255, 65535, 0xffff_ffffL, word, Byte.MIN_VALUE, Short.MIN_VALUE, Int.MIN_VALUE, Long.MIN_VALUE,
        word, Long.MIN_VALUE, 1.5f, -0.0, "Kotlin\u0000🌱", byteArrayOf(0, -1, 1))
    val first = values(); val second = values()
    verify(first == second); verify(first.hashCode() == second.hashCode())
    verify(first.bytes !== second.bytes); verify(first.natural == huge)
    verify(first.integer == huge.negate()); verify(first.u64 == word)
    verify(first.i8 == Byte.MIN_VALUE); verify(first.signedWord == Long.MIN_VALUE)
    verify(first.char_ == 0x1f331); verify(first.text.contains('\u0000'))
    verify(first.f64.toRawBits() == Long.MIN_VALUE)
    verify(Empty() == Empty())
    val absent: Option<Option<Unit>> = Option.none()
    val missing: Option<Option<Unit>> = Option.some(Option.none())
    val present: Option<Option<Unit>> = Option.some(Option.some(Unit.INSTANCE))
    verify(absent != missing); verify(missing != present)
    verify(present.value().value() == Unit.INSTANCE)
    verify(Ticket::class.java.declaredConstructors.filterNot { it.isSynthetic }.all { Modifier.isPrivate(it.modifiers) })
    verify(Ticket::class.java.fields.none { it.name == "handle" })
    println(checks)
}
