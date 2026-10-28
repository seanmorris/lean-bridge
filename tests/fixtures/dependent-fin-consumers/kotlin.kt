import java.math.BigInteger
import org.leanbridge.dependentfin.Api

private var checks = 0
private fun check(value: Boolean, label: String) { if (!value) throw AssertionError("failed: " + label); checks++ }
private fun rejected(parameter: String, bound: String, action: () -> Any?): Boolean =
    try { action(); false }
    catch (error: IllegalArgumentException) { error.message == parameter + " is not below its dependent Fin bound " + bound }
private fun illegal(action: () -> Any?): Boolean = try { action(); false } catch (error: IllegalArgumentException) { true }
private fun n(value: Long): BigInteger = BigInteger.valueOf(value)

fun main() {
    val huge = BigInteger.ONE.shiftLeft(70)
    val word = BigInteger.ONE.shiftLeft(32)
    // Fin 0: the live bound zero has no values.
    check(rejected("arg1", "arg0") { Api.mirror(n(0), n(0)) }, "Fin 0 rejects zero")
    check(rejected("arg1", "arg0") { Api.mirror(n(0), n(1)) }, "Fin 0 rejects one")
    // Fin 1: only zero.
    check(Api.mirror(n(1), n(0)) == n(0), "Fin 1 accepts zero")
    check(rejected("arg1", "arg0") { Api.mirror(n(1), n(1)) }, "Fin 1 rejects its bound")
    // The exact endpoints of a small live bound.
    check(Api.mirror(n(10), n(0)) == n(9) && Api.mirror(n(10), n(9)) == n(0), "Fin 10 endpoints")
    for (value in listOf(n(10), n(11), word, huge)) check(rejected("arg1", "arg0") { Api.mirror(n(10), value) }, "Fin 10 rejects " + value)
    // Live bounds wider than a machine word are compared limb by limb.
    check(Api.mirror(word, word - BigInteger.ONE) == n(0) && Api.mirror(word + BigInteger.ONE, word) == n(0), "word bounds")
    check(rejected("arg1", "arg0") { Api.mirror(word, word) }, "word bound rejects itself")
    check(Api.mirror(huge, huge - BigInteger.ONE) == n(0) && Api.mirror(huge, n(0)) == huge - BigInteger.ONE, "huge endpoints")
    check(Api.mirror(huge + BigInteger.ONE, huge) == n(0), "one past a huge bound")
    for (value in listOf(huge, huge + BigInteger.ONE, BigInteger.ONE.shiftLeft(128))) check(rejected("arg1", "arg0") { Api.mirror(huge, value) }, "huge bound rejects " + value)
    // The bound is the argument of this call, never a frozen constant.
    for (bound in 0L until 12L) {
        if (bound > 5) check(Api.mirror(n(bound), n(5)) == n(bound - 6), "value 5 below live bound " + bound)
        else check(rejected("arg1", "arg0") { Api.mirror(n(bound), n(5)) }, "value 5 at or above live bound " + bound)
    }
    // Only the named earlier parameter bounds the value, not an unrelated earlier Nat.
    check(Api.label(n(100), n(3), n(2), "slot") == "slot:102", "later dependency")
    check(rejected("arg2", "arg1") { Api.label(n(100), n(3), n(3), "slot") }, "bound is arg1, not the larger arg0")
    check(rejected("arg2", "arg1") { Api.label(n(100), n(0), n(0), "slot") }, "Fin 0 at a later site")
    check(Api.label(n(0), huge, huge - BigInteger.ONE, "x") == "x:" + (huge - BigInteger.ONE), "huge later bound")
    // A negative Nat is the Nat error, not a dependent Fin rejection.
    check(illegal { Api.mirror(n(-1), n(0)) } && !rejected("arg1", "arg0") { Api.mirror(n(-1), n(0)) }, "negative bound")
    check(illegal { Api.mirror(n(5), n(-1)) } && !rejected("arg1", "arg0") { Api.mirror(n(5), n(-1)) }, "negative value")
    // Rejection leaves caller data unchanged.
    val start = n(7)
    val limit = n(4)
    val digit = n(4)
    val name = "slot"
    check(rejected("arg2", "arg1") { Api.label(start, limit, digit, name) }, "rejected label")
    check(start == n(7) && limit == n(4) && digit == n(4) && name == "slot" && Api.label(start, limit, n(3), name) == "slot:10", "caller data unchanged")
    // Repeated invalid and valid calls recover; the bound changes every call.
    for (i in 0 until 1000) {
        if (!rejected("arg1", "arg0") { Api.mirror(n(10), n(10L + i % 5)) }) throw AssertionError("invalid call accepted at " + i)
        if (Api.mirror(n(i % 7 + 1L), n(i % 7L)) != n(0) || Api.mirror(n(10), n(i % 10L)) != n(9L - i % 10)) throw AssertionError("valid call failed at " + i)
    }
    checks += 2000
    println("dependent-fin-ok:$checks")
}
