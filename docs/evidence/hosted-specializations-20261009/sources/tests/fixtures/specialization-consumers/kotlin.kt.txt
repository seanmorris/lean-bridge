import java.math.BigInteger
import org.leanbridge.specialized.Api
private var checks = 0
private fun checkCase(value: Boolean) { check(value); ++checks }
fun main() {
    val greeting = "héllo 🙂"
    // One generic declaration, three concrete exports.
    checkCase(Api.echoWord(0) == 0L && Api.echoWord(4294967295L) == 4294967295L)
    checkCase(Api.echoText(greeting) == greeting && Api.echoText("").isEmpty())
    val large = BigInteger.ONE.shiftLeft(200)
    checkCase(Api.echoNat(large) == large)
    val words = longArrayOf(0, 42, 4294967295L)
    checkCase(Api.echoWords(words).contentEquals(words))
    // No open generic method is exposed.
    for (method in Api::class.java.declaredMethods) {
        checkCase(method.typeParameters.isEmpty())
        checkCase(method.name !in listOf("echo", "choose", "first", "duplicate"))
    }
    // Lean resolved each instance dictionary at build time.
    checkCase(Api.chooseWord(true, 5) == 5L && Api.chooseWord(false, 5) == 37L)
    checkCase(Api.chooseText(true, greeting) == greeting && Api.chooseText(false, greeting).isEmpty())
    checkCase(Api.chooseWords(true, words).contentEquals(words) && Api.chooseWords(false, words).isEmpty())
    checkCase(Api.doubleWord(2147483649L) == 2L)
    checkCase(Api.doubleNat(BigInteger.ONE.shiftLeft(100)) == BigInteger.ONE.shiftLeft(101))
    checkCase(Api.firstTextWord(greeting, 9) == greeting)
    checkCase(Api.plain(1) == 4L)
    // Each export keeps its own concrete argument checks.
    for (call in listOf<() -> Unit>({ Api.echoWord(4294967296L) }, { Api.echoWord(-1) }, { Api.echoNat(BigInteger.valueOf(-1)) })) {
        var rejected = false
        try { call() } catch (error: IllegalArgumentException) { rejected = true }
        checkCase(rejected)
    }
    for (i in 0L until 1000L) {
        checkCase(Api.chooseWord(i % 2 == 0L, i) == (if (i % 2 == 0L) i else 37L))
        checkCase(Api.doubleWord(i) == 2 * i)
    }
    println("specialization-ok:$checks")
}
