// Kotlin's metadata-backed copied types, distinct from the Java record projection.
import java.math.BigInteger
import org.leanbridge.structured.kotlin.*
import org.leanbridge.structured.kotlin.Pair
import org.leanbridge.structured.Unit as LeanUnit

internal object StructuredValues {
    val shapes = listOf("array", "list", "option", "result", "tuple", "record", "variant", "alias")
    fun text(seed: Int): String = arrayOf("", "a\u0000λ🌿", "\udbff\udfff", "e\u0301")[seed % 4] + seed
    fun huge(seed: Int): BigInteger = BigInteger.ONE.shiftLeft(256 + seed)
        .add(BigInteger.ONE.shiftLeft(64)).add(BigInteger.valueOf(seed.toLong()))
    fun array(seed: Int): Array<Option<String>> = if (seed % 5 == 0) emptyArray() else arrayOf(
        Option.none(), Option.some(text(seed)), Option.some(""), Option.some("\u0000")
    )
    fun list(seed: Int): Array<Result<Pair<Long, String>, String>> = if (seed % 5 == 0) emptyArray() else arrayOf(
        Result.ok(Pair(4294967295L, text(seed))), Result.err(text(seed)),
        Result.ok(Pair(seed.toLong(), "")), Result.err("")
    )
    fun option(seed: Int): Option<Option<LeanUnit>> = when (seed % 3) {
        0 -> Option.none()
        1 -> Option.some(Option.none())
        else -> Option.some(Option.some(LeanUnit.INSTANCE))
    }
    fun result(seed: Int): Result<Option<Long>, Array<String>> = when (seed % 4) {
        0 -> Result.ok(Option.none())
        1 -> Result.ok(Option.some(seed.toLong()))
        2 -> Result.err(arrayOf(text(seed), "", "\u0000"))
        else -> Result.err(emptyArray())
    }
    fun tuple(seed: Int): Pair<String, Pair<ByteArray, BigInteger>> {
        val bytes = if (seed % 2 == 0) byteArrayOf() else byteArrayOf(0, -1, -128) + ByteArray(256) { it.toByte() }
        return Pair(text(seed), Pair(bytes, huge(seed)))
    }
    fun record(seed: Int): Payload {
        val nested: Option<Result<Pair<BigInteger, LeanUnit>, String>> = when (seed % 3) {
            0 -> Option.none()
            1 -> Option.some(Result.ok(Pair(BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE), LeanUnit.INSTANCE)))
            else -> Option.some(Result.err(text(seed)))
        }
        return Payload(text(seed), array(seed), huge(seed), nested)
    }
    fun variant(seed: Int): Packet = when (seed % 3) {
        0 -> PacketEmpty()
        1 -> PacketPayload(text(seed), array(seed))
        else -> PacketCounts(huge(seed), huge(seed).negate())
    }
}
