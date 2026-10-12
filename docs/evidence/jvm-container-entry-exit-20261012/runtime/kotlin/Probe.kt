import java.math.BigInteger
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.file.Files
import java.nio.file.Path
import kotlin.system.exitProcess
import org.leanbridge.fincontainers.Api
import org.leanbridge.fincontainers.Option

private val rejectedPattern = Regex("(arg[0-9]+(?:\\[[0-9]+\\]|\\?)*) is not below its Fin ([0-9]+) bound")
private val printablePattern = Regex("[!-~]*")
private var record = ""
private var nonce = ""
private var config = ""
private var expected = IntArray(0)

private fun instrumentation(): ByteBuffer? = try {
    val bytes = Files.readAllBytes(Path.of(record))
    if (bytes.size == 376) ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN) else null
} catch (error: java.io.IOException) { null } catch (error: RuntimeException) { null }
private fun ascii(bytes: ByteBuffer, offset: Int, length: Int) = String(bytes.array(), offset, length, Charsets.ISO_8859_1)
private fun word(bytes: ByteBuffer, offset: Int) = Integer.toUnsignedLong(bytes.getInt(offset))
private fun entries(bytes: ByteBuffer) = LongArray(10) { bytes.getLong(296 + 8 * it) }
private fun ours(bytes: ByteBuffer?) = bytes != null && ascii(bytes, 0, 8) == "LBFCOGDB" && word(bytes, 8) == 1L && word(bytes, 12) == 10L
    && ascii(bytes, 16, 64) == config && ascii(bytes, 80, 32) == nonce
    && bytes.getLong(112) == ProcessHandle.current().pid() && word(bytes, 120) == 1L
// Exactly the given armed mask, no conflicting or foreign definition and no counted entry.
private fun quiet(bytes: ByteBuffer, armed: Long) = word(bytes, 124) == armed && word(bytes, 128) == 0L && word(bytes, 132) == 0L && entries(bytes).all { it == 0L }
private fun covered(bytes: ByteBuffer) = (0 until 10).all { bytes.getLong(136 + 8 * it) == 1L && bytes.getInt(216 + 4 * it) == expected[it] }
private fun refuse(message: String, code: Int): Nothing {
    System.err.print(message)
    System.err.flush()
    exitProcess(code)
}

fun main(args: Array<String>) {
    if (args.size == 4) {
        record = args[0]; nonce = args[1]; config = args[2]
        expected = args[3].split(",").map { if (Regex("[0-9]{1,3}").matches(it)) it.toInt() else -1 }.toIntArray()
    }
    val before = if (expected.size == 10) instrumentation() else null
    if (!ours(before) || !quiet(before!!, 0L)) refuse("fin container record is not attached to this process with nothing armed\n", 2)
    if (!trigger()) refuse("fin container load trigger countNone([]) did not return 0\n", 4)
    val after = instrumentation()
    if (!ours(after) || !quiet(after!!, 1023L) || !covered(after)) refuse("fin container columns are not all armed once at their verified definitions with no entries\n", 3)
    measure()
    System.out.flush()
}

// The explicit load trigger: a public call that counts in no column extracts and opens the verified libraries.
private fun trigger(): Boolean = try { Api.countNone(arrayOf<BigInteger>()) == BigInteger.ZERO } catch (error: RuntimeException) { false }
private fun n(digits: String) = BigInteger(digits)
private fun report(step: String, status: String) {
    val bytes = instrumentation() ?: throw IllegalStateException("fin container record is unreadable")
    print(step + " " + status + " " + entries(bytes).joinToString(" ") + "\n")
}
private fun show(value: Any?): String? = when (value) {
    is BigInteger -> value.toString()
    is String -> if (printablePattern.matches(value)) value else null
    is Array<*> -> if (value.all { it is BigInteger }) value.joinToString(",") else null
    else -> null
}
private fun status(call: () -> Any?): String = try {
    show(call())?.let { "ok:" + it } ?: "ok:unexpected"
} catch (error: IllegalArgumentException) {
    val match = rejectedPattern.matchEntire(error.message ?: "")
    if (match != null) "rejected:" + match.groupValues[1] + ":" + match.groupValues[2] else "error:IllegalArgumentException"
} catch (error: RuntimeException) { "error:" + error.javaClass.simpleName }
private fun measure() {
    report("start", "ok")
    report("invalid-array-first", status { Api.mirrorAll(arrayOf<BigInteger>(n("10"), n("1"), n("2"))) })
    report("invalid-array-middle", status { Api.mirrorAll(arrayOf<BigInteger>(n("1"), n("10"), n("2"))) })
    report("invalid-array-last", status { Api.mirrorAll(arrayOf<BigInteger>(n("1"), n("2"), n("10"))) })
    report("invalid-list-wide", status { Api.sumHuge(arrayOf<BigInteger>(n("1"), n("1180591620717411303424"))) })
    report("invalid-option-present", status { Api.orDefault(Option.some(n("1"))) })
    report("invalid-nested-present", status { Api.present(arrayOf<Option<BigInteger>>(Option.some(n("1")), Option.none(), Option.some(n("10")))) })
    report("invalid-label-late", status { Api.label(arrayOf<String>("a", "b"), arrayOf<BigInteger>(n("1"), n("4"))) })
    report("valid-array", status { Api.mirrorAll(arrayOf<BigInteger>(n("0"), n("9"))) })
    report("valid-list-wide", status { Api.sumHuge(arrayOf<BigInteger>(n("1180591620717411303423"), n("1"))) })
    report("valid-option-absent", status { Api.orDefault(Option.none()) })
    report("valid-option-present", status { Api.orDefault(Option.some(n("0"))) })
    report("valid-nested-present", status { Api.present(arrayOf<Option<BigInteger>>(Option.some(n("1")), Option.none(), Option.some(n("9")))) })
    report("valid-label", status { Api.label(arrayOf<String>("a", "b"), arrayOf<BigInteger>(n("1"), n("3"))) })
    report("recovery-invalid-array", status { Api.mirrorAll(arrayOf<BigInteger>(n("9"), n("10"), n("0"))) })
    report("recovery-invalid-list", status { Api.sumHuge(arrayOf<BigInteger>(n("1180591620717411303424"))) })
    report("recovery-invalid-option", status { Api.orDefault(Option.some(n("1"))) })
    report("recovery-invalid-nested", status { Api.present(arrayOf<Option<BigInteger>>(Option.none(), Option.some(n("10")))) })
    report("recovery-invalid-label", status { Api.label(arrayOf<String>("a"), arrayOf<BigInteger>(n("4"))) })
    report("recovery-valid-array", status { Api.mirrorAll(arrayOf<BigInteger>()) })
    report("recovery-valid-list", status { Api.sumHuge(arrayOf<BigInteger>()) })
    report("recovery-valid-option", status { Api.orDefault(Option.none()) })
    report("recovery-valid-nested", status { Api.present(arrayOf<Option<BigInteger>>(Option.none())) })
    report("recovery-valid-label", status { Api.label(arrayOf<String>("a"), arrayOf<BigInteger>(n("0"))) })
}
