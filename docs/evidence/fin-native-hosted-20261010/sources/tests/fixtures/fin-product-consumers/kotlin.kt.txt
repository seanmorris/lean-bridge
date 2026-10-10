import java.math.BigInteger
import org.leanbridge.finproducts.Api
import org.leanbridge.finproducts.Option
import org.leanbridge.finproducts.Pair
import org.leanbridge.finproducts.Result

private var checks = 0
private fun check(value: Boolean, label: String) { if (!value) throw AssertionError("failed: " + label); checks++ }
private fun rejected(parameter: String, bound: String, action: () -> Any?): Boolean =
    try { action(); false }
    catch (error: IllegalArgumentException) { error.message == parameter + " is not below its Fin " + bound + " bound" }
private fun n(value: Long): BigInteger = BigInteger.valueOf(value)
private fun pair(a: BigInteger, b: BigInteger) = Pair(a, b)
private fun rows(a: Long, b: Long): Array<Option<Pair<BigInteger, Result<BigInteger, BigInteger>>>> = arrayOf(Option.none()
    , Option.some(Pair(n(a), Result.ok(n(50)))), Option.some(Pair(n(1), Result.err(n(b)))))

fun main() {
    val wide = n(10).shiftLeft(64).add(n(10))
    // Fin 10 × Nat: only the first component is bounded.
    for (d in 0L until 10L) check(Api.first(pair(n(d), n(1000))) == pair(n(9 - d), n(1001)), "first valid")
    check(rejected("arg0", "10") { Api.first(pair(n(10), n(0))) }, "first at bound")
    check(rejected("arg0", "10") { Api.first(pair(BigInteger.ONE.shiftLeft(70), n(0))) }, "first beyond 64 bits")
    check(Api.first(pair(n(3), BigInteger.ONE.shiftLeft(200))).second() == BigInteger.ONE.shiftLeft(200).add(n(1)), "unbounded component")
    // Nat × Fin 1, and a bound wider than 64 bits beside Fin 10.
    check(Api.second(pair(n(41), n(0))) == n(41), "second valid")
    check(rejected("arg0", "1") { Api.second(pair(n(41), n(1))) }, "second at bound")
    check(Api.wide(pair(wide.subtract(n(1)), n(9))) == wide.add(n(8)), "wide valid")
    check(rejected("arg0", wide.toString()) { Api.wide(pair(wide, n(9))) }, "wide at bound")
    check(rejected("arg0", "10") { Api.wide(pair(wide.subtract(n(1)), n(10))) }, "wide second at bound")
    // Option (Fin 0 × Nat): only none is valid.
    check(Api.absentOnly(Option.none()) == n(7), "absent only none")
    check(rejected("arg0", "0") { Api.absentOnly(Option.some(pair(n(0), n(0)))) }, "absent only some")
    // Except String (Fin 10): the ok branch is bounded; an inactive branch is never read.
    check(Api.okOnly(Result.ok(n(9))) == n(9), "ok valid")
    check(rejected("arg0", "10") { Api.okOnly(Result.ok(n(10))) }, "ok at bound")
    check(Api.okOnly(Result.err("four")) == n(104), "inactive ok")
    // Except (Fin 5) Nat: the error branch is bounded; any ok Nat is valid.
    check(Api.errorOnly(Result.ok(BigInteger.ONE.shiftLeft(100))) == BigInteger.ONE.shiftLeft(100), "unbounded ok")
    check(Api.errorOnly(Result.err(n(4))) == n(104), "error valid")
    check(rejected("arg0", "5") { Api.errorOnly(Result.err(n(5))) }, "error at bound")
    // Except (Fin 3) (Fin 7): only the active branch is checked.
    check(Api.both(Result.ok(n(6))) == n(6), "both ok valid")
    check(rejected("arg0", "7") { Api.both(Result.ok(n(7))) }, "both ok at bound")
    check(Api.both(Result.err(n(2))) == n(102), "both error valid")
    check(rejected("arg0", "3") { Api.both(Result.err(n(3))) }, "both error at bound")
    // List (Option (Fin 3 × Except (Fin 2) Nat)): every present element, both levels.
    check(Api.nested(rows(2, 1)) == n(54), "nested valid")
    check(rejected("arg0", "2") { Api.nested(rows(2, 2)) }, "nested branch")
    check(rejected("arg0", "3") { Api.nested(rows(3, 1)) }, "nested component")
    check(Api.nested(rows(2, 1)) == n(54), "nested recovery")
    // DigitPair := Digit × Digit through the alias.
    check(Api.aliased(pair(n(1), n(9))) == pair(n(9), n(1)), "aliased valid")
    check(rejected("arg0", "10") { Api.aliased(pair(n(1), n(10))) }, "aliased at bound")
    // Results carrying bounds are produced by Lean and arrive below them.
    val produced = Api.produce(n(4))
    check(!produced.isOk() && produced.error() == n(4), "produce error")
    check(Api.produce(n(23)).isOk(), "produce ok")
    check(Api.pairUp(n(23)) == pair(n(3), n(23)), "pair up")
    for (i in 0L until 1000L) {
        check(Api.first(pair(n(i % 10), n(i))).first() == n(9 - i % 10), "round")
        check(rejected("arg0", "10") { Api.first(pair(n(10 + i), n(i))) }, "rejection round")
    }
    println("fin-product-ok:$checks")
}
