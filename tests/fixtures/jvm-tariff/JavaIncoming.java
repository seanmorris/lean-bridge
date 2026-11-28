import org.leanbridge.tariff_quotes.*;

public final class JavaIncoming {
    private static void expired(Runnable call) {
        try { call.run(); throw new AssertionError("expired view still works"); }
        catch (LeanBridgeException e) { Ownership.check(e.status() == 4); }
    }
    private static void scenarios() {
        Ownership.check(Api.flatQuote((a,b) -> a+b, 2, 3) == 5);
        Ownership.begin();
        for (boolean keep : new boolean[]{false,true}) for (boolean fail : new boolean[]{false,true}) {
            var views = new PackQuoteArgument0Closure[2];
            var original = new IllegalStateException("application rejected quote");
            try {
                long total = Api.visitQuote(40, (quote,n) -> {
                    views[0] = quote;
                    Ownership.check(quote.invoke(n) == 42);
                    if (keep) {
                        views[1] = quote.retain();
                        Ownership.check(quote.sameIdentity(views[1]) && views[1].equals(quote));
                    }
                    if (fail) throw original;
                    return quote.invoke(n);
                }, 2);
                Ownership.check(!fail && total == 42);
            } catch (IllegalStateException e) { Ownership.check(fail && e == original); }
            expired(() -> views[0].invoke(5));
            if (keep) {
                expired(() -> views[0].sameIdentity(views[1]));
                if (!fail) Ownership.held();
                views[0].close();
                Ownership.check(views[1].invoke(5) == 45);
                views[1].close();
                expired(() -> views[1].invoke(5));
            } else views[0].close();
            Ownership.settled(keep ? (fail ? "errorLease" : "lease") : (fail ? "error" : "success"));
        }
        var inner = new PackQuoteArgument0Closure[1];
        var nested = new IllegalArgumentException("inner refused");
        long outer = Api.visitQuote(30, (quote,n) -> {
            try {
                Api.visitQuote(90, (other,m) -> {
                    Ownership.check(!quote.sameIdentity(other) && other.invoke(m) == 93);
                    inner[0] = other;
                    throw nested;
                }, 3);
                throw new AssertionError("lost inner error");
            } catch (IllegalArgumentException e) { Ownership.check(e == nested); }
            expired(() -> inner[0].invoke(1)); inner[0].close();
            return quote.invoke(n);
        }, 4);
        Ownership.check(outer == 34); Ownership.settled("nested");
        Ownership.check(Api.visitQuote(1, (q,n) -> q.invoke(n), 5) == 6);
        Ownership.check(Api.visitQuote(60, (q,n) -> q.invoke(n), 3) == 63);
        Ownership.settled("fresh");
    }
    public static void main(String[] args) throws InterruptedException { Ownership.run(JavaIncoming::scenarios); }
}
