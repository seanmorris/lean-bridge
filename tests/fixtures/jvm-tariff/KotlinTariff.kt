import org.leanbridge.tariff_quotes.kotlin.*

private fun refused(code: Int, action: () -> kotlin.Unit) {
    val error = runCatching(action).exceptionOrNull()
    check(error is LeanBridgeException && error.status() == code) { "expected status $code, got $error" }
}

private fun scenarios() {
    check(Api.flatQuote({ a, b -> a + b }, 2, 3) == 5L)
    Ownership.begin()
    val source = Api.makeTariff(40)
    source.quote.retain().use { kept ->
        Ownership.held(); source.quote.close()
        check(kept.invoke(2) == 42L && Api.applyTariff(Tariff(kept), 3) == 43L)
    }
    Ownership.settled("retain")
    val input = Tariff(Api.makeTariff(20).quote)
    val echoed = Api.echoTariff(input)
    input.quote.close()
    echoed.quote.use { check(it.invoke(22) == 42L && Api.applyTariff(echoed, 5) == 25L) }
    Ownership.settled("echo")
    val original = Api.makeTariff(36)
    val unpacked = Api.unpackQuote(original)
    original.quote.close()
    val repacked = Api.packQuote(unpacked.asCallback()); unpacked.close()
    repacked.quote.use { check(it.invoke(6) == 42L) }
    Ownership.settled("repack")
    var entries = 0
    val expired = Api.packQuote { n -> ++entries; n }
    expired.quote.use {
        refused(10) { it.invoke(1) }; refused(10) { Api.applyTariff(expired, 1) }; check(entries == 0)
    }
    Ownership.settled("expired")
    val closed = Api.makeTariff(7); closed.quote.close()
    refused(4) { Api.echoTariff(closed) }; Ownership.settled("closed")
    Api.makeTariff(39).quote.use { kept ->
        Api.makeTariff(1000).quote.use { recovery ->
            val make = StagedQuoteArgument0ClosureCallback { n -> check(n == 9L); kept }
            check(Api.stagedQuote(OwnedCallbacks.withRecovery(make, recovery), 9, 3) == 42L)
            val marker = IllegalStateException("price unavailable")
            val broken = StagedQuoteArgument0ClosureCallback { n ->
                Api.makeTariff(n).quote.use { check(it.invoke(2) == 11L) }
                throw marker
            }
            check(runCatching { Api.stagedQuote(OwnedCallbacks.withRecovery(broken, recovery), 9, 3) }.exceptionOrNull() === marker)
            check(kept.invoke(4) == 43L && recovery.invoke(1) == 1001L)
        }
    }
    check(Api.flatQuote({ a, b -> a * b }, 6, 7) == 42L)
    Ownership.settled("afterCallbackFailure")
}
fun main() { Ownership.run(::scenarios) }
