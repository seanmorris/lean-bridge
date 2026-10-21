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


    check(calls == (if (rejections == 0) 8 else 21)
        && recoveries == rejections && (rejections == 0 || rejections == 4),
        "exact totals")
}
