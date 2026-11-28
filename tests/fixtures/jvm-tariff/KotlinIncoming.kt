import org.leanbridge.tariff_quotes.kotlin.*

private fun expired(call: () -> kotlin.Unit) {
    val e = runCatching(call).exceptionOrNull()
    check(e is LeanBridgeException && e.status() == 4) { "expired view: $e" }
}
private fun scenarios() {
    check(Api.flatQuote({a,b -> a+b}, 2, 3) == 5L)
    Ownership.begin()
    for (keep in listOf(false,true)) for (fail in listOf(false,true)) {
        lateinit var borrowed: PackQuoteArgument0Closure
        var retained: PackQuoteArgument0Closure? = null
        val original = IllegalStateException("application rejected quote")
        val result = runCatching { Api.visitQuote(40, {quote,n ->
            borrowed = quote
            check(quote.invoke(n) == 42L)
            if (keep) retained = quote.retain().also { check(quote.sameIdentity(it) && it == quote) }
            if (fail) throw original
            quote.invoke(n)
        }, 2) }
        if (fail) check(result.exceptionOrNull() === original) else check(result.getOrThrow() == 42L)
        expired { borrowed.invoke(5) }
        retained?.let { lease ->
            expired { borrowed.sameIdentity(lease) }
            if (!fail) Ownership.held()
            borrowed.close()
            lease.use { check(it.invoke(5) == 45L) }
            expired { lease.invoke(5) }
        } ?: borrowed.close()
        Ownership.settled(if (keep) { if (fail) "errorLease" else "lease" } else { if (fail) "error" else "success" })
    }
    lateinit var inner: PackQuoteArgument0Closure
    val nested = IllegalArgumentException("inner refused")
    val total = Api.visitQuote(30, {quote,n ->
        val result = runCatching { Api.visitQuote(90, {other,m ->
            check(!quote.sameIdentity(other) && other.invoke(m) == 93L)
            inner = other
            throw nested
        }, 3) }
        check(result.exceptionOrNull() === nested)
        expired { inner.invoke(1) }; inner.close()
        quote.invoke(n)
    }, 4)
    check(total == 34L); Ownership.settled("nested")
    check(Api.visitQuote(1, {q,n -> q.invoke(n)}, 5) == 6L)
    check(Api.visitQuote(60, {q,n -> q.invoke(n)}, 3) == 63L)
    Ownership.settled("fresh")
}
fun main() = Ownership.run(::scenarios)
