import org.leanbridge.tariff_quotes.kotlin.*

private fun stale(f: PackQuoteArgument0Closure) {
    val error=runCatching { f.invoke(999) }.exceptionOrNull()
    check(error is LeanBridgeException && error.status()==10)
}
private fun scenarios() {
    check(Api.flatQuote({a,b -> a+b},1,2)==3L); Ownership.begin()
    var calls=0
    val price=PackQuoteArgument0ClosureCallback { n -> ++calls; 40+n }
    Api.passApplicationQuote(price).use { stale(it) }
    check(calls==0); Ownership.settled("expired")
    lateinit var saved: PackQuoteArgument0Closure
    val forwarded=Api.makeTariff(800).quote.use { fallback ->
        val value=Api.visitApplicationQuote(price,{q,n ->
            saved=q.retain()
            Api.passApplicationQuote(q.asCallback()).use { f ->
                check(f.invoke(0)==40L); Ownership.held()
                val choose=StagedQuoteArgument0ClosureCallback { f }
                Api.stagedQuote(OwnedCallbacks.withRecovery(choose,fallback),99,n)
            }
        },2)
        check(value==42L && calls==2); saved.use { stale(it) }; value
    }
    Ownership.settled("forward")
    val failure=IllegalStateException("nested registration")
    val after=Api.visitApplicationQuote(price,{outer,n ->
        val result=runCatching { Api.visitApplicationQuote({throw failure},{inner,m -> inner.invoke(m)},99) }
        check(result.exceptionOrNull()===failure); outer.invoke(n)
    },3)
    check(after==43L && calls==3)
    Ownership.settled("nested")
    val replies=mutableListOf<Long>()
    for (n in listOf(42L,71L)) {
        Api.newTicket(n).use { input -> Api.newTicket(800).use { fallback -> Api.newTicket(n+1).use { reply ->
            var hits=0
            val exchange=ExchangeTicketArgument1ClosureCallback { t -> ++hits; check(Api.ticketSerial(t)==n); reply }
            val returned=Api.exchangeTicket(input,OwnedCallbacks.withRecovery(exchange,fallback))
            check(returned==n+1 && hits==1); replies.add(returned)
            val broken=ExchangeTicketArgument1ClosureCallback { t -> check(Api.ticketSerial(t)==n); throw failure }
            check(runCatching { Api.exchangeTicket(input,OwnedCallbacks.withRecovery(broken,fallback)) }.exceptionOrNull()===failure)
            check(Api.ticketSerial(fallback)==800L && Api.ticketSerial(input)==n)
        } } }
        Ownership.settled(if(n==42L) "ticket42to43" else "ticket71to72")
    }
    println("values $forwarded $after $calls ${replies[0]} ${replies[1]}")
}
fun main() = Ownership.run(::scenarios)
