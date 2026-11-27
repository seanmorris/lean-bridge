import org.leanbridge.tariff_quotes.*;

/** Normal application calls. Ownership observes the already-loaded broker out of band. */
public final class JavaApplication {
    static void stale(PackQuoteArgument0Closure f) {
        try { f.invoke(999); throw new AssertionError("registration revived"); }
        catch (LeanBridgeException e) { Ownership.check(e.status()==10); }
    }
    static void scenarios() {
        Ownership.check(Api.flatQuote((a,b)->a+b,1,2)==3); Ownership.begin();
        int[] calls={0}; PackQuoteArgument0ClosureCallback price=n->{ ++calls[0]; return 40+n; };
        try (var expired=Api.passApplicationQuote(price)) { stale(expired); }
        Ownership.check(calls[0]==0); Ownership.settled("expired");
        var saved=new PackQuoteArgument0Closure[1];
        long forwarded;
        try (var fallback=Api.makeTariff(800).quote()) {
            forwarded=Api.visitApplicationQuote(price,(q,n)->{
                saved[0]=q.retain();
                try (var f=Api.passApplicationQuote(q.asCallback())) {
                    Ownership.check(f.invoke(0)==40); Ownership.held();
                    StagedQuoteArgument0ClosureCallback choose=ignored->f;
                    return Api.stagedQuote(OwnedCallbacks.withRecovery(choose,fallback),99,n);
                }
            },2);
            Ownership.check(forwarded==42 && calls[0]==2);
            try (var alias=saved[0]) { stale(alias); }
        }
        Ownership.settled("forward");
        var failure=new IllegalStateException("nested registration");
        long after=Api.visitApplicationQuote(price,(outer,n)->{
            try {
                Api.visitApplicationQuote(v->{throw failure;},(inner,m)->inner.invoke(m),99);
                throw new AssertionError("inner error lost");
            } catch (IllegalStateException e) { Ownership.check(e==failure); }
            return outer.invoke(n);
        },3);
        Ownership.check(after==43 && calls[0]==3); Ownership.settled("nested");
        var replies=new java.util.ArrayList<Long>();
        for (long n:new long[]{42,71}) {
            try (var input=Api.newTicket(n);var fallback=Api.newTicket(800);var reply=Api.newTicket(n+1)) {
                int[] hits={0};
                ExchangeTicketArgument1ClosureCallback exchange=t->{++hits[0];Ownership.check(Api.ticketSerial(t)==n);return reply;};
                long returned=Api.exchangeTicket(input,OwnedCallbacks.withRecovery(exchange,fallback));
                Ownership.check(returned==n+1 && hits[0]==1); replies.add(returned);
                ExchangeTicketArgument1ClosureCallback broken=t->{Ownership.check(Api.ticketSerial(t)==n);throw failure;};
                try { Api.exchangeTicket(input,OwnedCallbacks.withRecovery(broken,fallback));throw new AssertionError("fallback published"); }
                catch (IllegalStateException e) { Ownership.check(e==failure); }
                Ownership.check(Api.ticketSerial(fallback)==800 && Api.ticketSerial(input)==n);
            }
            Ownership.settled(n==42?"ticket42to43":"ticket71to72");
        }
        System.out.println("values "+forwarded+" "+after+" "+calls[0]+" "+replies.get(0)+" "+replies.get(1));
    }
    public static void main(String[] args) throws InterruptedException { Ownership.run(JavaApplication::scenarios); }
}
