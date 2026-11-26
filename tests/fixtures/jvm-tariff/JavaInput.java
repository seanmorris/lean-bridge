import org.leanbridge.tariff_quotes.*;

public final class JavaInput {
    private static void refused(int code, Runnable call) {
        try { call.run(); throw new AssertionError("accepted invalid borrow"); }
        catch (LeanBridgeException e) { Ownership.check(e.status() == code); }
    }
    private static void scenarios() {
        Ownership.check(Api.flatQuote((a,b) -> a+b, 2, 3) == 5);
        Ownership.begin();
        int[] calls={0}, inner={0};
        var row = new TariffInput(n -> n + 39 + ++calls[0]);
        Ownership.check(Api.applyTariffWithHostFields(row,2)==42 && Api.applyTariffWithHostFields(row,2)==43);
        Ownership.settled("capture");
        var nested = new TariffInput(n -> Api.applyTariffWithHostFields(
            TariffInput.builder().quote(x -> { ++inner[0]; return x+40; }).build(),n));
        Ownership.check(Api.applyTariffWithHostFields(nested,2)==42 && inner[0]==1);
        Ownership.settled("reentry");
        try (var echoed = Api.echoTariffWithHostFields(row).quote();
             var unpacked = Api.unpackQuoteWithHostFields(row)) {
            refused(10, () -> echoed.invoke(1)); refused(10, () -> unpacked.invoke(1));
        }
        Ownership.check(calls[0]==2); Ownership.settled("expired");
        var marker=new IllegalStateException("field");
        try { Api.applyTariffWithHostFields(new TariffInput(x -> { throw marker; }),2); throw new AssertionError(); }
        catch (IllegalStateException e) { Ownership.check(e==marker); }
        Ownership.check(Api.applyTariffWithHostFields(row,2)==44); Ownership.settled("error");
        var source=Api.makeTariff(40);
        try (var lease=source.quote()) {
            Ownership.check(Api.applyTariffWithHostFields(TariffInput.fromLeased(source),2)==42);
            try (var kept=Api.echoTariffWithHostFields(TariffInput.builder().quote(lease).build()).quote()) {
                Ownership.held(); lease.close();
                Ownership.check(kept.invoke(2)==42);
                refused(4, () -> Api.applyTariffWithHostFields(TariffInput.fromLeased(source),2));
            }
        }
        Ownership.settled("lease");
        try { TariffInput.builder().build(); throw new AssertionError(); } catch (IllegalStateException expected) {}
        try { Api.applyTariffWithHostFields(row,-1); throw new AssertionError(); } catch (IllegalArgumentException expected) {}
        Ownership.check(calls[0]==3 && inner[0]==1); Ownership.settled("validation");
    }
    public static void main(String[] args) throws InterruptedException { Ownership.run(JavaInput::scenarios); }
}
