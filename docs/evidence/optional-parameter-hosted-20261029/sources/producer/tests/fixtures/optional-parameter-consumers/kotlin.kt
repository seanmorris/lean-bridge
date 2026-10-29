import java.math.BigInteger
import org.leanbridge.defaults.Unit
import org.leanbridge.defaults.kotlin.Api
import org.leanbridge.defaults.kotlin.Option

private var checks = 0

private fun checkValue(condition: Boolean) {
    check(condition) { "Optional-parameter mismatch" }
    ++checks
}

fun main(arguments: Array<String>) {
    check(arguments.isEmpty()) { "unexpected arguments" }
    checkValue(Api.word() == 7L)
    checkValue(Api.word(7L) == 7L)
    checkValue(Api.word(11L) == 11L)

    val large = BigInteger("184467440737095516160")
    checkValue(Api.natural() == large)
    checkValue(Api.natural(large) == large)
    checkValue(Api.natural(BigInteger.valueOf(11L)) == BigInteger.valueOf(11L))

    checkValue(Api.text() == "Lean\nBridge")
    checkValue(Api.text("Lean\nBridge") == "Lean\nBridge")
    checkValue(Api.text("other") == "other")

    checkValue(Api.character() == 0x3bb)
    checkValue(Api.character(0x3bb) == 0x3bb)
    checkValue(Api.character(0x732b) == 0x732b)

    checkValue(Api.maybe() == Option.none<Long>())
    checkValue(Api.maybe(Option.none()) == Option.none<Long>())
    checkValue(Api.maybe(Option.some(11L)) == Option.some(11L))

    checkValue(Api.present() == Option.some(9L))
    checkValue(Api.present(Option.some(9L)) == Option.some(9L))
    checkValue(Api.present(Option.none()) == Option.none<Long>())
    checkValue(Api.present(Option.some(11L)) == Option.some(11L))

    Api.unitValue()
    checkValue(true)
    Api.unitValue(Unit.INSTANCE)
    checkValue(true)

    println("optional-parameter-kotlin:$checks")
}
