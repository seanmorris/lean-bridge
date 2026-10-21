// Independent Kotlin caller for proof-erased zero-payload checked records.
import java.lang.reflect.InvocationTargetException
import java.math.BigInteger
import org.leanbridge.zeropayloadcheckedrecords.Unit as LeanUnit
import org.leanbridge.zeropayloadcheckedrecords.kotlin.*

private var checks = 0
private var calls = 0
private var rejections = 0
private var recoveries = 0
private const val PREFIX = "arg0"

private fun n(value: Long) = BigInteger.valueOf(value)

private fun check(condition: Boolean, label: String) {
    if (!condition) throw IllegalStateException("failed: $label")
    checks++
}

private fun refused(call: () -> Unit, expected: String): Boolean {
    calls++
    try { call() }
    catch (error: IllegalArgumentException) {
        return error::class.java == IllegalArgumentException::class.java
            && error.message == expected
    }
    return false
}

private fun nullApiRefused(name: String, type: Class<*>): Boolean {
    calls++
    try { Api::class.java.getMethod(name, type).invoke(null, null) }
    catch (error: InvocationTargetException) {
        return error.cause?.javaClass == NullPointerException::class.java
    }
    return false
}

private fun nullNestedRefused(): Boolean {
    calls++
    try { MarkMarked::class.java.getConstructor(Witness::class.java).newInstance(null) }
    catch (error: InvocationTargetException) {
        return error.cause?.javaClass == NullPointerException::class.java
    }
    return false
}

private fun recover(): Boolean {
    val value = Witness()
    calls++
    if (Api.witnessCount(value) != n(1) || value != Witness()) return false
    recoveries++
    return true
}

fun main(arguments: Array<String>) {
    if (arguments.isNotEmpty())
        throw IllegalStateException("Unexpected caller arguments")
    runChecks()
    println("{\"calls\":$calls,\"checks\":$checks,\"recoveries\":$recoveries,"
        + "\"rejections\":$rejections}")
}

private fun runChecks() {
    calls++
    val witness = Api.produceWitness()
    check(witness == Witness() && witness.hashCode() == Witness().hashCode(),
        "proof-only Witness is a real empty value")
    calls++
    val token = Api.produceToken()
    check(token == Token(LeanUnit.INSTANCE) && token.tag === LeanUnit.INSTANCE,
        "Token retains its Unit payload")
    calls++
    val values = Api.witnesses(n(3))
    check(values.size == 3 && values[0] !== values[1]
        && values[0] == values[1] && values[1] == values[2],
        "Witness array retains length and independent values")
    calls++
    val none = Api.maybeWitness(false)
    check(!none.isSome(), "absent Witness remains Option.None")
    calls++
    val some = Api.maybeWitness(true)
    check(some.isSome() && some.value() == Witness(),
        "present empty Witness remains Option.Some")
    calls++
    val marker = Api.produceMarker()
    check(marker == Marker() && marker::class.java != witness::class.java,
        "plain Marker stays nominally distinct from checked Witness")
    calls++
    val blank = Api.produceMark(false)
    check(blank == MarkBlank(), "inactive branch remains blank")
    calls++
    val marked = Api.produceMark(true)
    check(marked == MarkMarked(Witness()),
        "active branch retains its empty Witness carrier")

    calls++
    check(Api.witnessCount(witness) == n(1) && witness == Witness(),
        "accepted nullary checked record")
    check(refused({ Api.absentCount(witness) },
        "$PREFIX was rejected by ZeroPayloadCheckedRecords.mkAbsent")
        && witness == Witness(), "refusal preserves Witness")
    rejections++; check(recover(), "recover after constructor refusal")
    calls++; Api.tokenTag(token)
    check(token == Token(LeanUnit.INSTANCE), "Unit Token is preserved")
    calls++
    check(Api.markerCount(marker) == n(0) && marker == Marker(),
        "plain empty Marker input")
    calls++
    check(Api.markCount(blank) == n(0) && blank == MarkBlank(),
        "inactive variant input")
    calls++
    check(Api.markCount(marked) == n(1) && marked == MarkMarked(Witness()),
        "active variant checks its nested Witness")
    check(nullApiRefused("witnessCount", Witness::class.java),
        "null Witness is not an empty carrier")
    rejections++; check(recover(), "recover after null Witness refusal")
    check(nullApiRefused("markerCount", Marker::class.java),
        "null Marker is not a plain empty record")
    rejections++; check(recover(), "recover after null Marker refusal")
    check(nullNestedRefused(),
        "null nested Witness is refused by the public carrier")
    rejections++; check(recover(), "recover after null nested refusal")

    check(calls == (if (rejections == 0) 8 else 21)
        && recoveries == rejections && (rejections == 0 || rejections == 4),
        "exact totals")
}
