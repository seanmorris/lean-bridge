import org.leanbridge.host_null_demo.kotlin.Api
import org.leanbridge.host_null_demo.kotlin.Option
import org.leanbridge.host_null_demo.kotlin.Packet

private var checks = 0
private fun checkValue(condition: Boolean, message: String) {
    ++checks
    if (!condition) throw AssertionError(message)
}

fun main() {
    checkValue(Api.echo(null) == null, "direct null")
    checkValue(Api.echo(42L) == 42L, "direct value")
    checkValue(Api.nullableOption(null) == null, "nullable Option null")
    checkValue(Api.nullableOption(Option.none<Long>()) == Option.none<Long>(), "nullable Option none")
    checkValue(Api.nullableOption(Option.some(42L)) == Option.some(42L), "nullable Option some")
    checkValue(Api.optionalNullable(Option.none<Long?>()) == Option.none<Long?>(), "optional nullable none")
    checkValue(Api.optionalNullable(Option.some<Long?>(null)) == Option.some<Long?>(null), "optional nullable null")
    checkValue(Api.optionalNullable(Option.some<Long?>(42L)) == Option.some<Long?>(42L), "optional nullable value")

    val packet = Packet(null, Option.none(), Option.some(null))
    val echoed = Api.echoPacket(packet)
    checkValue(echoed.direct == null, "record direct null")
    checkValue(echoed.nullableOption == Option.none<Long>(), "record nullable Option")
    checkValue(echoed.optionalNullable == Option.some<Long?>(null), "record optional nullable")
    checkValue(echoed == packet, "record equality")

    var callbackCalls = 0
    checkValue(Api.callHost(null) { value ->
        ++callbackCalls
        checkValue(value == null, "callback null parameter")
        Option.none()
    } == Option.none<Long>(), "callback tagged result")
    checkValue(Api.callHost(42L) { value ->
        ++callbackCalls
        checkValue(value == 42L, "callback value parameter")
        null
    } == null, "callback null result")
    checkValue(callbackCalls == 2, "callback count")

    val closure = Api.makeClosure(Option.some(77L))
    checkValue(!closure.isClosed, "closure initially open")
    checkValue(closure.invoke(null) == Option.some(77L), "closure null parameter")
    checkValue(closure.invoke(2L) == Option.some(77L), "closure value parameter")
    closure.close()
    checkValue(closure.isClosed, "closure closed")
    var rejected = false
    try { closure.invoke(null) }
    catch (_: IllegalStateException) { rejected = true }
    checkValue(rejected, "closed closure rejected")

    println("host-null-kotlin:$checks")
}
