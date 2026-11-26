import java.math.BigInteger
import org.leanbridge.workshop.Pair
import org.leanbridge.workshop.kotlin.Api

fun main() {
    Api.bindHosts(Installed.Meter::class).use { binding ->
        val a = Installed.Meter(8)
        val b = Installed.Meter(13)
        val bytes = byteArrayOf(3, 5)
        val wide = BigInteger.ONE.shiftLeft(135)
        Pair(a, bytes, wide, b).use { pair ->
            bytes[0] = 99
            binding.flip(pair).use { result ->
                check(result.lead === b && result.spare === a && result.sequence == wide + BigInteger.ONE)
                check(result.sample.contentEquals(byteArrayOf(3, 5, 8)))
                result.sample[0] = 0
                check(result.sample[0] == 3.toByte() && binding.sumRead(pair, result) == 16L)
            }
            binding.choose(pair).use { choose ->
                pair.close()
                check(choose.invoke(true) === a && choose.invoke(false) === b)
            }
        }
        val outside = binding.createPair(b)
        binding.close()
        outside.use { check(it.lead === b && it.spare === b) }
        check(runCatching { outside.lead }.exceptionOrNull() is IllegalStateException)
    }
    println("Kotlin: original meters, property copies, wide Nat, retained choose and independent disposal")
}
