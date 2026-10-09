import java.math.BigInteger
import org.leanbridge.genericrecords.*
private var checks = 0
private fun checkCase(value: Boolean) { check(value); ++checks }
private fun rejected(call: () -> Unit): Boolean {
    try { call() } catch (error: IllegalArgumentException) { return true } catch (error: NullPointerException) { return true }
    return false
}
private fun n(value: Long): BigInteger = BigInteger.valueOf(value)
private fun natBox(value: Long, count: Long) = NatBox(n(value), n(count))
fun main() {
    // Each alias is its own record with the structure's fields instantiated; Nat fields are BigInteger.
    val box = natBox(4, 1)
    val bumped = Api.bump(box)
    checkCase(bumped == natBox(5, 2) && box.value() == n(4) && bumped !== box)
    checkCase(Api.again(NatBoxAgain(n(4), n(1))) == NatBoxAgain(n(8), n(1)))
    // Two aliases of one application are two distinct classes with the same layout.
    checkCase(NatBox::class != NatBoxAgain::class)
    val greeting = "héllo 🙂"
    checkCase(Api.shout(TextBox(greeting, n(3))) == TextBox("$greeting!", n(3)))
    checkCase(Api.swapNamed(WordPair("a", n(1))) == WordPair("a!", n(2)))
    // A parameter instantiated with Option Nat and a List of a named instantiation.
    checkCase(Api.orZero(MaybeBox(Option.some(n(5)), n(2))) == n(7))
    checkCase(Api.orZero(MaybeBox(Option.none(), n(2))) == n(2))
    val huge = BigInteger.ONE.shiftLeft(70)
    val boxes = arrayOf(natBox(1, 0), natBox(2, 0), NatBox(huge, n(0)))
    checkCase(Api.total(boxes) == huge.add(n(3)) && Api.total(arrayOf()) == n(0))
    val first = Api.firstBoxes(n(2))
    checkCase(first.isSome() && first.value().size == 2 && first.value()[1] == natBox(1, 2))
    checkCase(!Api.firstBoxes(n(0)).isSome())
    // A pair of two named instantiations.
    checkCase(Api.unpair(BoxPair(natBox(3, 0), TextBox("abcd", n(0)))) == n(7))
    // A universe-polymorphic structure instantiated at Type.
    checkCase(Api.retag(TaggedNat("t", n(1))) == TaggedNat("t#", n(2)))
    // A phantom argument: the instantiation names Marker, which no field carries.
    checkCase(Api.relabel(MarkerTag("m")) == MarkerTag("m?"))
    // Negative Nat fields fail before Lean runs.
    checkCase(rejected { Api.bump(natBox(-1, 1)) })
    checkCase(rejected { Api.unpair(BoxPair(natBox(3, 0), TextBox("abcd", n(-1)))) })
    for (i in 0L until 1000L) {
        val round = Api.bump(natBox(i, i))
        check(round == natBox(i + 1, i + 1)) { "round $i failed" }
    }
    checks += 1000
    println("generic-records-ok:$checks")
}
