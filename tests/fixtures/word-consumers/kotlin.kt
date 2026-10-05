import java.math.BigInteger
import org.leanbridge.words.Api
import org.leanbridge.words.Sample
private var checks = 0
private fun checkWord(value: Boolean) { check(value); ++checks }
fun main() {
    val modulus = BigInteger.ONE.shiftLeft(64)
    val us = arrayOf(BigInteger.ZERO, BigInteger.ONE, BigInteger("4294967295"), BigInteger("9007199254740993"), modulus - BigInteger.ONE)
    val ss = longArrayOf(Long.MIN_VALUE, -9007199254740993L, -1, 0, Long.MAX_VALUE)
    checkWord(Api.wordBits() == 64L)
    for (i in us.indices) {
        checkWord(Api.keepUnsigned(us[i]) == us[i])
        checkWord(Api.keepSigned(ss[i]) == ss[i])
        checkWord(Api.unsignedText(us[i]) == us[i].toString())
        checkWord(Api.signedText(ss[i]) == ss[i].toString())
        checkWord(Api.advanceUnsigned(us[i]) == (us[i] + BigInteger.ONE).mod(modulus))
        checkWord(Api.advanceSigned(ss[i]) == ss[i] + 1)
    }
    for (bad in arrayOf(BigInteger.valueOf(-1), modulus)) {
        for (call in listOf<() -> Unit>({ Api.keepUnsigned(bad) }, { Api.keepUnsignedValues(arrayOf(BigInteger.ZERO, bad)) },
            { Api.keepUnsignedRows(arrayOf(arrayOf(BigInteger.ZERO), arrayOf(bad))) },
            { Api.keepSample(Sample(bad, -1, us, ss)) }, { Api.keepSample(Sample(BigInteger.ONE, -1, arrayOf(bad), ss)) })) {
            var rejected = false
            try { call() } catch (error: IllegalArgumentException) { rejected = true }
            checkWord(rejected); checkWord(Api.keepSigned(-1) == -1L)
        }
    }
    repeat(1000) {
        val sample = Api.keepSample(Sample(us[4], ss[0], us, ss))
        checkWord(sample.natural() == us[4] && sample.integer() == ss[0])
        checkWord(sample.unsignedValues().contentEquals(us) && sample.signedValues().contentEquals(ss))
        checkWord(Api.keepUnsignedValues(us).contentEquals(us))
        checkWord(Api.keepSignedValues(ss).contentEquals(ss))
        checkWord(Api.keepUnsignedRows(arrayOf(us, emptyArray())).contentDeepEquals(arrayOf(us, emptyArray())))
        checkWord(Api.keepSignedRows(arrayOf(ss, longArrayOf())).contentDeepEquals(arrayOf(ss, longArrayOf())))
    }
    println("word-ok:$checks")
}
