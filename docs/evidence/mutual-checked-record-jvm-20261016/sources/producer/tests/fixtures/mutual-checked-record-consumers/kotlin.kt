// Independent installed Kotlin caller for mutually recursive checked records.
import java.lang.reflect.InvocationTargetException
import java.math.BigInteger
import java.util.IdentityHashMap
import java.util.LinkedHashMap
import org.leanbridge.mutualcheckedrecords.kotlin.*

private var checks = 0
private var rejections = 0
private var hostRejections = 0
private var calls = 0
private var snapshots = 0
private var recoveries = 0
private const val ROUNDS = 64
private data class Failure(val name: String, val message: String?)
private val failures = LinkedHashMap<String, Failure>()

private fun n(value: Long) = BigInteger.valueOf(value)
private fun envelope(value: Long, mode: Long, next: Option<Step> = Option.none()) =
    Envelope(n(value), n(mode), next)
private fun nested(outer: Long, mode: Long, inner: Long, innerMode: Long) =
    envelope(outer, mode, Option.some(StepMore(envelope(inner, innerMode))))

private fun check(condition: Boolean, label: String) {
    if (!condition) throw IllegalStateException("failed: $label")
    checks++
}

private fun record(value: Envelope?, text: StringBuilder,
    active: IdentityHashMap<Any, Boolean>) {
    if (value == null) { text.append("null"); return }
    if (active.put(value, true) != null) { text.append("#cycle"); return }
    text.append("E(").append(value.value).append(',').append(value.mode).append(',')
    if (!value.next.isSome()) text.append("none") else step(value.next.value(), text, active)
    text.append(')'); active.remove(value)
}
private fun step(value: Step?, text: StringBuilder,
    active: IdentityHashMap<Any, Boolean>) {
    if (value == null) { text.append("null-step"); return }
    if (active.put(value, true) != null) { text.append("#cycle-step"); return }
    when (value) {
        is StepStop -> text.append("stop")
        is StepMore -> { text.append("more("); record(value.packet, text, active); text.append(')') }
    }
    active.remove(value)
}
private fun snap(value: Envelope?): String = StringBuilder().also {
    record(value, it, IdentityHashMap())
}.toString()
private fun snap(values: Array<out Option<Envelope>?>?): String = values?.joinToString(
    prefix = "[", postfix = "]", separator = ";"
) { value -> if (value == null) "null-option" else if (value.isSome())
    "some(${snap(value.value())})" else "none" } ?: "null-array"

private fun <I, O> accepted(input: I, invoke: (I) -> O, snapshot: (I) -> String,
    expected: (O) -> Boolean, label: String): O {
    val before = snapshot(input); calls++
    val output = invoke(input)
    check(expected(output), label)
    check(snapshot(input) == before, "$label preserved every input")
    snapshots++; return output
}

private fun refused(invoke: () -> kotlin.Unit, snapshot: () -> String,
    expected: (Throwable) -> Boolean, label: String, host: Boolean): Throwable {
    val before = snapshot(); var failure: Throwable? = null; calls++
    try { invoke() } catch (error: Throwable) {
        failure = if (error is InvocationTargetException) error.cause ?: error else error
    }
    check(failure != null && expected(failure), "$label: $failure")
    check(snapshot() == before, "$label preserved every input")
    snapshots++
    if (host) hostRejections++ else rejections++
    failures.putIfAbsent(label, Failure(failure!!::class.java.simpleName, failure.message))
    return failure
}

private fun exact(error: Throwable, message: String) =
    error::class.java == IllegalArgumentException::class.java && error.message == message

private fun recover() {
    val valid = nested(40, 2, 80, 1)
    accepted(valid, Api::first, ::snap, { it == n(41) }, "recovery after refusal")
    recoveries++
}

private fun rejectAndRecover(invoke: () -> kotlin.Unit, snapshot: () -> String,
    expected: (Throwable) -> Boolean, label: String, host: Boolean) {
    refused(invoke, snapshot, expected, label, host); recover()
}

private fun deep(levels: Int): Envelope {
    var value = envelope(40, 2)
    repeat(levels) { value = envelope(40, 2, Option.some(StepMore(value))) }
    return value
}

private fun cyclic(): Envelope {
    val more = StepMore(envelope(40, 2))
    val value = envelope(40, 2, Option.some(more))
    val field = StepMore::class.java.getField("packet")
    field.isAccessible = true; field.set(more, value)
    check(more.packet === value, "cycle control")
    return value
}

private fun malformed(): Envelope {
    val more = StepMore(envelope(40, 2))
    val value = envelope(40, 2, Option.some(more))
    val field = StepMore::class.java.getField("packet")
    field.isAccessible = true; field.set(more, null)
    return value
}

private fun runChecks() {
    check(java.lang.Long.SIZE == 64 && java.nio.ByteOrder.nativeOrder()
        == java.nio.ByteOrder.LITTLE_ENDIAN, "native platform")
    check(Envelope::class.java.declaredFields.filterNot { it.isSynthetic }.map { it.name }.sorted()
        == listOf("mode", "next", "value"), "proof field is absent from the Kotlin carrier")
    check(Envelope::class.java.declaredConstructors.single().parameterCount == 3,
        "proof-free Kotlin constructor")
    check(Step::class.java.isSealed && StepStop::class.java.isAssignableFrom(StepStop::class.java)
        && Step::class.java.isAssignableFrom(StepMore::class.java), "closed typed recursive variant")

    val original = nested(40, 2, 80, 1)
    val originalSnapshot = snap(original)
    accepted(original, Api::first, ::snap, { it == n(41) }, "first")
    accepted(original, Api::second, ::snap, { it == n(42) }, "second")
    val echoed = accepted(original, Api::echo, ::snap,
        { snap(it) == snap(nested(41, 2, 81, 1)) }, "echo")
    check(echoed !== original && (echoed.next.value() as StepMore).packet !==
        (original.next.value() as StepMore).packet, "recursive result owns storage")
    val absent = envelope(40, 2)
    accepted(absent, Api::first, ::snap, { it == n(41) }, "inactive option branch")
    val stopped = envelope(40, 2, Option.some(StepStop()))
    accepted(stopped, Api::first, ::snap, { it == n(41) }, "active empty variant branch")
    var aliases = arrayOf(Option.some(original), Option.none())
    accepted(aliases, Api::groups, ::snap, { it == n(2) }, "transparent recursive alias carrier")
    val echoedGroups = accepted(aliases, Api::echoGroups, ::snap,
        { snap(it) == snap(arrayOf(Option.some(nested(42, 2, 82, 1)), Option.none())) },
        "recursive alias result")
    check(echoedGroups !== aliases && echoedGroups[0] !== aliases[0],
        "recursive array result owns storage")
    val produced = accepted(n(5), Api::produce, BigInteger::toString,
        { snap(it) == snap(nested(6, 1, 7, 2)) }, "constructor-free result")
    check(Envelope::class.java.declaredFields.none { it.name == "linked" }
        && snap(produced) == snap(nested(6, 1, 7, 2)), "erased proof absent from produced result")

    var invalid = nested(100, 2, 80, 1)
    rejectAndRecover({ Api.first(invalid) }, { snap(invalid) }, { exact(it,
        "arg0.value was rejected by MutualCheckedRecords.plusOne") }, "outer-subtype", false)
    invalid = nested(40, 2, 100, 1)
    rejectAndRecover({ Api.first(invalid) }, { snap(invalid) }, { exact(it,
        "arg0.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne") },
        "late-subtype", false)
    invalid = nested(0, 2, 80, 1)
    rejectAndRecover({ Api.first(invalid) }, { snap(invalid) }, { exact(it,
        "arg0 was rejected by MutualCheckedRecords.mkEnvelope") }, "outer-record", false)
    invalid = nested(40, 3, 80, 1)
    rejectAndRecover({ Api.first(invalid) }, { snap(invalid) }, { exact(it,
        "arg0.mode is not below its Fin 3 bound") }, "outer-fin", false)
    invalid = nested(40, 2, 80, 3)
    rejectAndRecover({ Api.first(invalid) }, { snap(invalid) }, { exact(it,
        "arg0.next?.more.packet.mode is not below its Fin 3 bound") }, "nested-fin", false)
    var invalidGroups = arrayOf(Option.some(nested(40, 2, 100, 1)))
    rejectAndRecover({ Api.groups(invalidGroups) }, { snap(invalidGroups) }, { exact(it,
        "arg0[0]?.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne") },
        "group-late-subtype", false)
    invalidGroups = arrayOf(Option.some(nested(40, 2, 95, 1)))
    rejectAndRecover({ Api.echoGroups(invalidGroups) }, { snap(invalidGroups) }, { exact(it,
        "arg0[0]?.next?.more.packet.value was rejected by MutualCheckedRecords.plusTwo") },
        "echo-group-late-subtype", false)
    invalid = nested(90, 2, 80, 1)
    rejectAndRecover({ Api.second(invalid) }, { snap(invalid) }, { exact(it,
        "arg0.value was rejected by MutualCheckedRecords.plusTwo") }, "alternate-subtype", false)

    val firstMethod = Api::class.java.getMethod("first", Envelope::class.java)
    rejectAndRecover({ firstMethod.invoke(null, null) }, { "null" }, {
        it::class.java == NullPointerException::class.java && it.message ==
            "Parameter specified as non-null is null: method org.leanbridge.mutualcheckedrecords.kotlin.Api\$Companion.first, parameter __ROUTE_PARAMETER__"
    },
        "null-record", true)
    val groupsMethod = Api::class.java.methods.single { it.name == "groups" }
    rejectAndRecover({ groupsMethod.invoke(null, null) }, { "null-array" }, {
        it::class.java == NullPointerException::class.java && it.message ==
            "Parameter specified as non-null is null: method org.leanbridge.mutualcheckedrecords.kotlin.Api\$Companion.groups, parameter __ROUTE_PARAMETER__"
    },
        "null-alias-carrier", true)
    val badActive = malformed()
    rejectAndRecover({ Api.first(badActive) }, { snap(badActive) }, { exact(it,
        "Expected copied value of type org.leanbridge.mutualcheckedrecords.kotlin.Envelope") },
        "null-active-field", true)
    val cycle = cyclic()
    rejectAndRecover({ Api.first(cycle) }, { snap(cycle) }, { exact(it, "Cyclic copied input") },
        "cycle", true)
    val tooDeep = deep(48)
    rejectAndRecover({ Api.first(tooDeep) }, { snap(tooDeep) }, {
        it::class.java.simpleName == "Limit" && it.message == "Copied graph depth or node limit exceeded"
    }, "depth", true)
    val negative = BigInteger.ONE.negate()
    rejectAndRecover({ Api.produce(negative) }, { negative.toString() }, {
        exact(it, "Nat cannot be negative")
    }, "negative-nat", true)

    repeat(ROUNDS) { round ->
        val outer = 2L + round % 80
        val inner = 3L + round % 70
        val valid = nested(outer, (round % 3).toLong(), inner, (round % 3).toLong())
        accepted(valid, Api::first, ::snap, { it == n(outer + 1) }, "round first")
        val roundLate = nested(40, 2, 100, 1)
        refused({ Api.first(roundLate) }, { snap(roundLate) }, { exact(it,
            "arg0.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne") },
            "round late subtype", false)
        accepted(valid, Api::second, ::snap, { it == n(outer + 2) }, "round alternate constructor")
        val roundAliases = arrayOf(Option.none(), Option.some(valid))
        accepted(roundAliases, Api::groups, ::snap, { it == n(2) }, "round alias carrier")
        recoveries++
    }
    check(snap(original) == originalSnapshot, "all calls preserved reused input")
}

private fun quote(value: String?): String = value?.let { text -> "\"" + text
    .replace("\\", "\\\\").replace("\"", "\\\"")
    .replace("\n", "\\n").replace("\r", "\\r") + "\"" } ?: "null"
private fun failureJson() = failures.entries.joinToString(prefix = "{", postfix = "}") {
    (label, failure) -> ("${quote(label)}:{\"name\":${quote(failure.name)},"
        + "\"message\":${quote(failure.message)}}")
}

fun main(arguments: Array<String>) {
    if (arguments.isNotEmpty()) throw IllegalStateException("Unexpected caller arguments")
    runChecks()
    println("{\"checks\":$checks,\"rejections\":$rejections,\"hostRejections\":$hostRejections,"
        + "\"calls\":$calls,\"snapshots\":$snapshots,\"recoveries\":$recoveries,"
        + "\"rounds\":$ROUNDS,\"wordBits\":64,\"failures\":${failureJson()}}")
}
