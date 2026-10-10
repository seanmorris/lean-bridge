import java.math.BigInteger
import org.leanbridge.fincontainers.Api
import org.leanbridge.fincontainers.Option

private var checks = 0
private fun check(value: Boolean, label: String) { if (!value) throw AssertionError("failed: " + label); checks++ }
private fun rejected(parameter: String, bound: String, action: () -> Any?): Boolean =
    try { action(); false }
    catch (error: IllegalArgumentException) { error.message == parameter + " is not below its Fin " + bound + " bound" }
private fun illegal(action: () -> Any?): Boolean = try { action(); false } catch (error: IllegalArgumentException) { true }
private fun n(value: Long): BigInteger = BigInteger.valueOf(value)

fun main() {
    val huge = BigInteger.ONE.shiftLeft(70)
    val word = BigInteger.ONE.shiftLeft(32)
    val digits = Array(10) { n(it.toLong()) }
    // Array (Fin 10): every element is checked; results stay below the bound.
    check(Api.mirrorAll(digits).contentEquals(Array(10) { n(9L - it) }), "mirror endpoints")
    check(Api.mirrorAll(arrayOf()).isEmpty(), "empty array")
    for (position in 0 until 3) {
        val bad = arrayOf(n(1), n(2), n(3))
        bad[position] = n(10)
        check(rejected("arg0[$position]", "10") { Api.mirrorAll(bad) }, "invalid element at " + position)
        check(bad[position] == n(10), "input unchanged")
    }
    check(rejected("arg0[0]", "10") { Api.mirrorAll(arrayOf(word, n(1), n(2))) }, "word element")
    check(illegal { Api.mirrorAll(arrayOf(n(-1), n(1))) } && !rejected("arg0[0]", "10") { Api.mirrorAll(arrayOf(n(-1), n(1))) }, "negative is the Nat error")
    // Array (Fin 0): only the empty array has values.
    check(Api.countNone(arrayOf()) == n(0), "Fin 0 empty")
    check(rejected("arg0[0]", "0") { Api.countNone(arrayOf(n(0))) }, "Fin 0 present")
    // List Huge: a 2^70 bound compared limb by limb.
    val last = huge - BigInteger.ONE
    check(Api.sumHuge(arrayOf(word, last)) == word + last && Api.sumHuge(arrayOf()) == n(0), "huge sums")
    check(rejected("arg0[1]", huge.toString()) { Api.sumHuge(arrayOf(word, huge)) }, "huge bound")
    // Option (Fin 1): none is valid; a present value is checked.
    check(Api.orDefault(Option.none()) == n(7) && Api.orDefault(Option.some(n(0))) == n(0), "option values")
    check(rejected("arg0?", "1") { Api.orDefault(Option.some(n(1))) }, "present Fin 1")
    // Array (Option Digit): only present elements are checked.
    val mixed: Array<Option<BigInteger>> = arrayOf(Option.some(n(1)), Option.none(), Option.some(n(9)))
    check(Api.present(mixed).contentEquals(arrayOf(n(1), n(9))), "present digits")
    mixed[2] = Option.some(n(10))
    check(rejected("arg0[2]?", "10") { Api.present(mixed) }, "present invalid")
    mixed[2] = Option.none()
    check(Api.present(mixed).size == 1, "absent is never read")
    // List (Array Digit) -> Option (List Digit): nested rows.
    val rows = arrayOf(arrayOf(n(1), n(2)), arrayOf(n(3)))
    val flat = Api.flatten(rows)
    check(flat.isSome() && flat.value().contentEquals(arrayOf(n(1), n(2), n(3))), "flatten rows")
    check(!Api.flatten(arrayOf()).isSome(), "no rows")
    rows[1][0] = n(10)
    check(rejected("arg0[1][0]", "10") { Api.flatten(rows) }, "nested invalid last")
    // A late refined argument after an unrefined one.
    val names = arrayOf("a", "b")
    check(Api.label(names, arrayOf(n(1), n(3))) == "a:1,b:3", "label")
    check(rejected("arg1[1]", "4") { Api.label(names, arrayOf(n(1), n(4))) } && names[1] == "b", "late argument, caller data unchanged")
    // A result-only container refinement projects each element after Lean returns.
    check(Api.wrapAll(arrayOf(n(100), huge)).contentEquals(arrayOf(n(2), n(2))) && Api.wrapAll(arrayOf()).isEmpty(), "wrapped results")
    for (i in 0 until 1000) {
        if (!rejected("arg0[0]", "10") { Api.mirrorAll(arrayOf(n(10L + i % 5))) }) throw AssertionError("invalid call accepted at " + i)
        if (Api.mirrorAll(arrayOf(n(i % 10L)))[0] != n(9L - i % 10)) throw AssertionError("valid call failed at " + i)
    }
    checks += 2000
    println("fin-container-ok:$checks")
}
