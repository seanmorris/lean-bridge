// Installed Kotlin acceptance for checked Fin callbacks and Lean closures.
import java.math.BigInteger
import org.leanbridge.reviewedcallbacks.Unit as LeanUnit
import org.leanbridge.reviewedcallbacks.kotlin.Api
import org.leanbridge.reviewedcallbacks.kotlin.Tile

private var checks = 0
private var calls = 0
private fun n(value: Long) = BigInteger.valueOf(value)
private fun check(value: Boolean, label: String) {
    if (!value) throw AssertionError(label)
    checks++
}
private inline fun <reified T : Throwable> reject(operation: () -> Unit): T {
    try { operation() }
    catch (error: Throwable) {
        if (error is T) return error
        throw error
    }
    throw AssertionError("expected ${T::class.java.name}")
}
private fun refuses(operation: () -> Unit) =
    reject<IllegalArgumentException>(operation).message == "Invalid native copied input"

fun main() {
    val scaler = Api.scaler(n(3))
    check(scaler.invoke(n(4)) == n(12), "bounded closure argument")
    check(refuses { scaler.invoke(n(10)) }, "Fin 10 is refused")
    check(scaler.invoke(n(9)) == n(27), "closure remains usable")

    val counter = Api.counter(n(8))
    check(counter.invoke(n(4)) == n(2), "Lean-produced Fin result")

    val visited = Api.visit { value ->
        calls++
        if (value.signum() < 0 || value >= n(5))
            throw AssertionError("Lean supplied an invalid Fin")
        value
    }
    check(visited == n(10),
        "checked host callback arguments")
    check(calls == 5, "host receives every Fin 5 value")
    val sentinel = IllegalStateException("callback Fin sentinel")
    check(reject<IllegalStateException> {
        Api.visit { throw sentinel }
    } === sentinel, "callback exception identity")
    check(Api.apply({ value -> value + BigInteger.ONE }, n(2)) == n(3),
        "unrefined callback stays direct")

    val digits = Api.digits(LeanUnit.INSTANCE)
    check(digits.invoke(arrayOf(n(1), n(2))) == n(5), "nested Fin callback argument")
    check(refuses { digits.invoke(arrayOf(n(3))) }, "nested bound is refused")
    check(digits.invoke(emptyArray()) == BigInteger.ZERO, "nested closure remains usable")

    val tiles = Api.tiles(LeanUnit.INSTANCE)
    check(tiles.invoke(arrayOf(Tile(n(4), n(2)))) == n(402), "nominal Fin callback field")
    check(refuses { tiles.invoke(arrayOf(Tile(n(5), n(2)))) },
        "nominal Fin field is refused")

    val tileMaker = Api.tileMaker(n(3))
    check(tileMaker.invoke(n(4)) == Tile(n(2), n(4)), "Lean-produced nominal Fin field")

    scaler.close(); scaler.close(); check(scaler.isClosed, "scaler closes")
    counter.close(); counter.close(); check(counter.isClosed, "counter closes")
    digits.close(); digits.close(); check(digits.isClosed, "digits closes")
    tiles.close(); tiles.close(); check(tiles.isClosed, "tiles closes")
    tileMaker.close(); tileMaker.close(); check(tileMaker.isClosed, "tile maker closes")

    println("callback-fin-remaining-ok:$checks")
}
