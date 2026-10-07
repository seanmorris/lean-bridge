import java.math.BigInteger
import org.leanbridge.subtypes.Api

private var checks = 0
private fun check(value: Boolean, label: String) { if (!value) throw AssertionError("failed: " + label); checks++ }
private fun rejected(message: String, action: () -> Any?): Boolean =
    try { action(); false } catch (error: IllegalArgumentException) { error.message == message }
private fun illegal(action: () -> Any?): Boolean = try { action(); false } catch (error: IllegalArgumentException) { true }
private fun n(value: Long): BigInteger = BigInteger.valueOf(value)

fun main() {
    val hello = "héllo 🙂"
    // Nonempty String: Unicode and embedded NUL are ordinary payloads; the empty string is rejected.
    check(Api.shout(hello) == hello + "!" && Api.shout("a\u0000b") == "a\u0000b!", "shout")
    check(rejected("arg0 was rejected by Subtypes.checkedWord") { Api.shout("") }, "empty word")
    // Even Nat beyond 64 bits.
    check(Api.half(n(42)) == n(21) && Api.half(BigInteger.ONE.shiftLeft(100)) == BigInteger.ONE.shiftLeft(99), "half")
    check(rejected("arg0 was rejected by Subtypes.checkedEven") { Api.half(n(7)) }, "odd")
    check(illegal { Api.half(n(-2)) } && !rejected("arg0 was rejected by Subtypes.checkedEven") { Api.half(n(-2)) }, "negative is the Nat error")
    // Small Int after an unchecked argument.
    check(Api.scale(n(-3), n(-128)) == n(384) && Api.scale(n(-3), n(127)) == n(-381), "scale")
    check(rejected("arg1 was rejected by Subtypes.checkedSmall") { Api.scale(n(-3), n(128)) } && rejected("arg1 was rejected by Subtypes.checkedSmall") { Api.scale(n(-3), n(-129)) }, "late rejection")
    // Nonempty ByteArray.
    check(Api.head(byteArrayOf(0, 255.toByte())) == 0, "head")
    check(rejected("arg0 was rejected by Subtypes.checkedPayload") { Api.head(byteArrayOf()) }, "empty payload")
    // A result-only subtype and two checked arguments.
    check(Api.pad(n(21)) == n(42) && Api.join("ab", "cd") == "abcd", "pad and join")
    check(rejected("arg1 was rejected by Subtypes.checkedWord") { Api.join("ab", "") } && rejected("arg0 was rejected by Subtypes.checkedWord") { Api.join("", "cd") }, "join rejections")
    // A normalizing constructor: the export sees the constructed value.
    check(Api.clamp(n(250)) == n(100) && Api.clamp(n(7)) == n(7), "clamp")
    // A checked constructor beside a Fin bound: the Fin precheck runs first.
    check(Api.mix(n(4), n(3)) == n(7), "mix")
    check(rejected("arg1 is not below its Fin 10 bound") { Api.mix(n(4), n(10)) } && rejected("arg1 is not below its Fin 10 bound") { Api.mix(n(5), n(10)) }, "Fin before the constructor")
    check(rejected("arg0 was rejected by Subtypes.checkedEven") { Api.mix(n(5), n(3)) }, "odd beside a valid digit")
    for (i in 0 until 1000) {
        if (!rejected("arg0 was rejected by Subtypes.checkedEven") { Api.half(n(2L * i + 1)) }) throw AssertionError("invalid call accepted at " + i)
        if (Api.half(n(2L * i)) != n(i.toLong())) throw AssertionError("valid call failed at " + i)
    }
    checks += 2000
    println("subtype-ok:$checks")
}
