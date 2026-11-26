import org.leanbridge.tariff_quotes.*;

public final class JavaTariff {
    static void refused(int code, Runnable action) {
        try { action.run(); } catch (LeanBridgeException error) {
            if (error.status() == code) return;
            throw error;
        }
        throw new AssertionError("expected status " + code);
    }
    static void scenarios() {
        Ownership.check(Api.flatQuote((a,b) -> a + b, 2, 3) == 5);
        Ownership.begin();
        var source = Api.makeTariff(40);
        try (var kept = source.quote().retain()) {
            Ownership.held(); source.quote().close();
            Ownership.check(kept.invoke(2) == 42 && Api.applyTariff(new Tariff(kept), 3) == 43);
        }
        Ownership.settled("retain");
        var input = new Tariff(Api.makeTariff(20).quote());
        var echoed = Api.echoTariff(input);
        input.quote().close();
        try (var output = echoed.quote()) {
            Ownership.check(output.invoke(22) == 42 && Api.applyTariff(echoed, 5) == 25);
        }
        Ownership.settled("echo");
        var original = Api.makeTariff(36);
        var unpacked = Api.unpackQuote(original); original.quote().close();
        var repacked = Api.packQuote(unpacked.asCallback()); unpacked.close();
        try (var quote = repacked.quote()) { Ownership.check(quote.invoke(6) == 42); }
        Ownership.settled("repack");
        int[] entries = {0};
        var expired = Api.packQuote(n -> { ++entries[0]; return n; });
        try (var quote = expired.quote()) {
            refused(10, () -> quote.invoke(1)); refused(10, () -> Api.applyTariff(expired, 1));
            Ownership.check(entries[0] == 0);
        }
        Ownership.settled("expired");
        var closed = Api.makeTariff(7); closed.quote().close();
        refused(4, () -> Api.echoTariff(closed)); Ownership.settled("closed");
        try (var kept = Api.makeTariff(39).quote(); var recovery = Api.makeTariff(1000).quote()) {
            StagedQuoteArgument0ClosureCallback make = n -> { Ownership.check(n == 9); return kept; };
            Ownership.check(Api.stagedQuote(OwnedCallbacks.withRecovery(make, recovery), 9, 3) == 42);
            var marker = new IllegalStateException("price unavailable");
            StagedQuoteArgument0ClosureCallback broken = n -> {
                try (var tmp = Api.makeTariff(n).quote()) { Ownership.check(tmp.invoke(2) == 11); }
                throw marker;
            };
            try { Api.stagedQuote(OwnedCallbacks.withRecovery(broken, recovery), 9, 3); throw new AssertionError(); }
            catch (IllegalStateException error) { Ownership.check(error == marker); }
            Ownership.check(kept.invoke(4) == 43 && recovery.invoke(1) == 1001);
        }
        Ownership.check(Api.flatQuote((a,b) -> a * b, 6, 7) == 42);
        Ownership.settled("afterCallbackFailure");
    }
    public static void main(String[] args) throws InterruptedException { Ownership.run(JavaTariff::scenarios); }
}
