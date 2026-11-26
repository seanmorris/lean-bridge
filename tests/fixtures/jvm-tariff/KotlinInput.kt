import org.leanbridge.tariff_quotes.kotlin.*

private fun refused(code: Int, call: () -> kotlin.Unit) {
    val e = runCatching(call).exceptionOrNull()
    check(e is LeanBridgeException && e.status() == code) { "expected $code, got $e" }
}
private fun scenarios() {
    check(Api.flatQuote({a,b -> a+b},2,3)==5L); Ownership.begin()
    var calls=0; var inner=0
    val row=TariffInput(quote = { n -> n+39+(++calls) })
    check(Api.applyTariffWithHostFields(row,2)==42L && Api.applyTariffWithHostFields(row,2)==43L)
    Ownership.settled("capture")
    val nested=TariffInput { n -> Api.applyTariffWithHostFields(TariffInput.builder().quote { x -> ++inner; x+40 }.build(),n) }
    check(Api.applyTariffWithHostFields(nested,2)==42L && inner==1); Ownership.settled("reentry")
    Api.echoTariffWithHostFields(row).quote.use { refused(10) { it.invoke(1) } }
    Api.unpackQuoteWithHostFields(row).use { refused(10) { it.invoke(1) } }
    check(calls==2); Ownership.settled("expired")
    val marker=IllegalStateException("field")
    check(runCatching { Api.applyTariffWithHostFields(TariffInput { throw marker },2) }.exceptionOrNull() === marker)
    check(Api.applyTariffWithHostFields(row,2)==44L); Ownership.settled("error")
    val source=Api.makeTariff(40)
    source.quote.use { lease ->
        check(Api.applyTariffWithHostFields(TariffInput.fromLeased(source),2)==42L)
        Api.echoTariffWithHostFields(TariffInput.builder().quote(lease).build()).quote.use { kept ->
            Ownership.held(); lease.close(); check(kept.invoke(2)==42L)
            refused(4) { Api.applyTariffWithHostFields(TariffInput.fromLeased(source),2) }
        }
    }
    Ownership.settled("lease")
    check(runCatching { TariffInput.builder().build() }.exceptionOrNull() is IllegalStateException)
    check(runCatching { Api.applyTariffWithHostFields(row,-1) }.exceptionOrNull() is IllegalArgumentException)
    check(calls==3 && inner==1); Ownership.settled("validation")
}
fun main() = Ownership.run(::scenarios)
