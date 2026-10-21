// Independent installed Kotlin checks for generic Subtype compositions.
import java.math.BigInteger
import org.leanbridge.nominalsubtypes.kotlin.*

private var checks = 0
private var rejections = 0
private fun n(value: Long) = BigInteger.valueOf(value)
private fun generic(value: Long, marker: Long) = GenericNat(n(value), n(marker))
private fun snapshot(value: GenericNat) = "${value.value()}:${value.marker()}"
private fun checkCase(condition: Boolean, label: String) { check(condition) { "failed: $label" }; ++checks }
private fun call(name: String, input: GenericNat, action: (GenericNat) -> GenericNat, expected: GenericNat) {
    val before = snapshot(input); val result = action(input)
    checkCase(snapshot(result) == snapshot(expected), "$name exact copied result")
    checkCase(snapshot(input) == before, "$name input unchanged")
}
private fun scalar(input: GenericNat, expected: BigInteger) {
    val before = snapshot(input)
    checkCase(Api.genericUse(input) == expected, "genericUse exact result")
    checkCase(snapshot(input) == before, "genericUse input unchanged")
}
private fun <T> refused(name: String, input: GenericNat, action: (GenericNat) -> T, constructor: String) {
    val before = snapshot(input); val expected = "arg0.value was rejected by NominalSubtypes.$constructor"
    try { action(input); error("accepted: $expected") }
    catch (error: IllegalArgumentException) {
        checkCase(error.javaClass == IllegalArgumentException::class.java && error.message == expected, "$name exact refusal")
    }
    checkCase(snapshot(input) == before, "$name rejected input unchanged"); ++rejections
}
fun main() {
    scalar(generic(40, 2), n(43))
    call("echoGenericFirst", generic(40, 2), Api::echoGenericFirst, generic(41, 2))
    call("echoGenericSecond", generic(40, 2), Api::echoGenericSecond, generic(42, 2))
    scalar(generic(99, 7), n(107))
    call("echoGenericFirst", generic(99, 7), Api::echoGenericFirst, generic(100, 7))
    refused("genericUse", generic(100, 2), Api::genericUse, "plusOne")
    refused("echoGenericFirst", generic(100, 2), Api::echoGenericFirst, "plusOne")
    refused("echoGenericSecond", generic(90, 2), Api::echoGenericSecond, "plusTwo")
    call("echoGenericSecond", generic(40, 2), Api::echoGenericSecond, generic(42, 2))
    println("{\"checks\":$checks,\"rejections\":$rejections}")
}
